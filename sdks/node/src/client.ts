import { enrichEventCost } from '@amlexiahq/shared';
import type { AmlexiaClientOptions, TrackEvent, IngestPayload } from './types.js';
import { shouldSample } from './sampling.js';
import { createDiagnosticState, type DiagnosticState } from './diagnostic.js';

const DEFAULT_INGEST_URL = 'https://ingest.amlexia.com';
const DEFAULT_FLUSH_MS = 5000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_RETRIES = 5;

export class AmlexiaClient {
  private readonly sdkKey: string;
  private readonly ingestUrl: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxRetries: number;
  private readonly sampleRate: number;
  private readonly environment?: string;
  private readonly releaseVersion?: string;
  private readonly defaultSessionId?: string;
  readonly diagnostic: DiagnosticState;
  private buffer: TrackEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  static fromEnv(): AmlexiaClient {
    const sdkKey = process.env.AMLEXIA_SDK_KEY;
    if (!sdkKey) throw new Error('AMLEXIA_SDK_KEY environment variable is required');
    return new AmlexiaClient({
      sdkKey,
      ingestUrl: process.env.AMLEXIA_INGEST_URL,
      environment: process.env.AMLEXIA_ENVIRONMENT,
      releaseVersion: process.env.AMLEXIA_RELEASE,
    });
  }

  constructor(options: AmlexiaClientOptions) {
    this.sdkKey = options.sdkKey;
    this.ingestUrl = (options.ingestUrl ?? DEFAULT_INGEST_URL).replace(/\/$/, '');
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_BATCH_SIZE;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.sampleRate = options.sampleRate ?? 1;
    this.environment = options.environment;
    this.releaseVersion = options.releaseVersion;
    this.defaultSessionId = options.defaultSessionId;
    this.diagnostic = createDiagnosticState(options.diagnostic ?? false);
    this.startFlushTimer();
  }

  track(event: TrackEvent): void {
    if (!shouldSample(this.sampleRate)) return;

    const enriched = enrichEventCost({
      cost_usd: event.costUsd,
      model_name: event.modelName,
      provider: event.provider,
      tokens_input: event.tokensInput,
      tokens_output: event.tokensOutput,
      total_tokens: event.totalTokens,
    });

    this.buffer.push({
      ...event,
      environment: event.environment ?? this.environment,
      releaseVersion: event.releaseVersion ?? this.releaseVersion,
      sessionId: event.sessionId ?? this.defaultSessionId,
      costUsd: enriched.cost_usd ?? event.costUsd,
    });
  }

  getDiagnosticSnapshot(): DiagnosticState {
    return { ...this.diagnostic, eventsBuffered: this.buffer.length };
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const events = this.buffer.splice(0, this.maxBatchSize);

    const payload: IngestPayload = {
      sdk_key: this.sdkKey,
      events: events.map((e) => mapTrackEvent(e)),
    };

    try {
      await this.sendWithRetry(payload);
      this.diagnostic.lastFlushAt = Date.now();
      this.diagnostic.lastError = null;
      if (this.diagnostic.enabled) {
        console.error(`[amlexia] flushed ${events.length} events`);
      }
    } catch (err) {
      this.buffer.unshift(...events);
      this.diagnostic.lastError = err instanceof Error ? err.message : String(err);
      if (this.diagnostic.enabled) {
        console.error(`[amlexia] flush failed: ${this.diagnostic.lastError}`);
      }
      throw err;
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private async sendWithRetry(payload: IngestPayload): Promise<void> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const response = await fetch(`${this.ingestUrl}/v1/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) return;
        if (response.status === 401) {
          throw new Error('Invalid SDK key');
        }
        if (response.status === 402) {
          const body = await response.json().catch(() => ({}));
          throw new Error(`Usage limit exceeded: ${JSON.stringify(body)}`);
        }
        if (response.status >= 400 && response.status < 500) {
          const body = await response.text();
          throw new Error(`Ingestion failed: ${response.status} ${body}`);
        }
      } catch (err) {
        if (attempt === this.maxRetries - 1) throw err;
      }
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      await sleep(delay);
      attempt += 1;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapTrackEvent(e: TrackEvent): Record<string, unknown> {
  return {
    endpoint: e.endpoint,
    method: e.method,
    status_code: e.statusCode,
    latency_ms: e.latencyMs,
    request_size_bytes: e.requestSizeBytes,
    response_size_bytes: e.responseSizeBytes,
    cost_usd: e.costUsd,
    provider: e.provider,
    error_message: e.errorMessage,
    metadata: e.metadata,
    trace_id: e.traceId,
    span_id: e.spanId,
    parent_span_id: e.parentSpanId,
    session_id: e.sessionId,
    user_id: e.userId,
    environment: e.environment,
    release_version: e.releaseVersion,
    service_name: e.serviceName,
    operation_name: e.operationName,
    provider_category: e.providerCategory,
    model_name: e.modelName,
    tokens_input: e.tokensInput,
    tokens_output: e.tokensOutput,
    total_tokens: e.totalTokens,
    streaming_latency_ms: e.streamingLatencyMs,
    first_token_latency_ms: e.firstTokenLatencyMs,
    cache_hit: e.cacheHit,
    retry_count: e.retryCount,
    is_webhook: e.isWebhook,
  };
}
