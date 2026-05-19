import type { AmlexiaClient } from './client.js';
import type { TrackEvent } from './types.js';
import { applyTraceToEvent, createTraceContext } from './tracing.js';

export interface OtelSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: string;
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  status?: { code?: number; message?: string };
  attributes?: Record<string, string | number | boolean>;
}

export function exportOtelSpans(client: AmlexiaClient, spans: OtelSpanInput[]): void {
  const trace = createTraceContext({ traceId: spans[0]?.traceId });

  for (const span of spans) {
    const startSec = Math.floor(Number(span.startTimeUnixNano) / 1e9);
    const endSec = span.endTimeUnixNano
      ? Math.floor(Number(span.endTimeUnixNano) / 1e9)
      : startSec;
    const latencyMs = Math.max(1, (endSec - startSec) * 1000);
    const statusCode = span.status?.code === 2 ? 500 : Number(span.attributes?.['http.status_code'] ?? 200);

    const event: TrackEvent = {
      endpoint: span.name,
      method: String(span.attributes?.['http.method'] ?? 'OTEL'),
      statusCode,
      latencyMs,
      timestamp: startSec,
      metadata: { ...span.attributes, otel: true },
      errorMessage: span.status?.message ?? null,
    };

    client.track(
      applyTraceToEvent(event, {
        ...trace,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
      }),
    );
  }
}
