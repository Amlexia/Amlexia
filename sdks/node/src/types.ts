export interface AmlexiaClientOptions {
  sdkKey: string;
  ingestUrl?: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  environment?: string;
  releaseVersion?: string;
  defaultSessionId?: string;
  /** 0–1 — fraction of events to send (default 1). */
  sampleRate?: number;
  /** Log buffer/flush diagnostics to stderr. */
  diagnostic?: boolean;
}

export interface TrackEvent {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp?: number;
  requestSizeBytes?: number | null;
  responseSizeBytes?: number | null;
  costUsd?: number | null;
  provider?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  userId?: string;
  environment?: string;
  releaseVersion?: string;
  serviceName?: string;
  operationName?: string;
  providerCategory?: string;
  modelName?: string;
  tokensInput?: number;
  tokensOutput?: number;
  totalTokens?: number;
  streamingLatencyMs?: number;
  firstTokenLatencyMs?: number;
  cacheHit?: boolean;
  retryCount?: number;
  isWebhook?: boolean;
}

export interface IngestPayload {
  sdk_key: string;
  events: Array<Record<string, unknown>>;
}
