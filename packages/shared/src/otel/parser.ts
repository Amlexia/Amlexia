import { generateId } from '../utils.js';
import type { IngestEventPayload } from '../types.js';
import { detectProviderFromHints } from '../providers/registry.js';

export interface TraceParent {
  version: string;
  traceId: string;
  parentSpanId: string;
  flags: string;
}

export function parseTraceParent(header: string | null): TraceParent | null {
  if (!header) return null;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;
  const [version, traceId, parentSpanId, flags] = parts;
  if (version !== '00' || traceId.length !== 32 || parentSpanId.length !== 16) return null;
  return { version, traceId, parentSpanId, flags };
}

export function parseBaggage(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const pair of header.split(',')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key) out[key.trim()] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano: string;
  endTimeUnixNano?: string;
  status?: { code?: number; message?: string };
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }>;
}

export interface OtelResourceSpans {
  resource?: { attributes?: OtelSpan['attributes'] };
  scopeSpans?: Array<{
    scope?: { name?: string };
    spans?: OtelSpan[];
  }>;
}

export function otelSpansToAmlexiaEvents(
  resourceSpans: OtelResourceSpans[],
  defaults: { serviceName?: string; environment?: string },
): Array<IngestEventPayload & { trace_id: string; span_id: string; parent_span_id?: string }> {
  const events: Array<IngestEventPayload & { trace_id: string; span_id: string; parent_span_id?: string }> = [];

  for (const rs of resourceSpans) {
    const resourceAttrs = attrsToRecord(rs.resource?.attributes);
    const serviceName =
      (resourceAttrs['service.name'] as string) ?? defaults.serviceName ?? 'unknown';

    for (const scopeSpan of rs.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        const attrs = attrsToRecord(span.attributes);
        const startSec = Math.floor(Number(span.startTimeUnixNano) / 1e9);
        const endSec = span.endTimeUnixNano
          ? Math.floor(Number(span.endTimeUnixNano) / 1e9)
          : startSec;
        const latencyMs = Math.max(0, (endSec - startSec) * 1000 || Number(attrs['http.duration_ms'] ?? 0));
        const httpUrl = (attrs['http.url'] as string) ?? (attrs['url.full'] as string) ?? span.name;
        const method = (attrs['http.method'] as string) ?? 'OTEL';
        const statusCode =
          span.status?.code === 2 ? 500 : Number(attrs['http.status_code'] ?? 200);
        const host = typeof httpUrl === 'string' ? safeHost(httpUrl) : undefined;
        const detected = detectProviderFromHints({
          endpoint: span.name,
          host,
          metadata: attrs,
        });

        events.push({
          endpoint: span.name,
          method: method.toUpperCase(),
          status_code: statusCode,
          latency_ms: latencyMs || 1,
          timestamp: startSec,
          provider: detected.name !== 'unknown' ? detected.name : null,
          error_message: span.status?.message ?? null,
          metadata: {
            ...attrs,
            otel: true,
            service_name: serviceName,
            environment: defaults.environment,
            provider_category: detected.category,
            model_name: detected.modelName,
          },
          trace_id: span.traceId,
          span_id: span.spanId,
          parent_span_id: span.parentSpanId || undefined,
          service_name: serviceName,
          operation_name: span.name,
          provider_category: detected.category,
          provider_name: detected.name,
          model_name: detected.modelName,
        });
      }
    }
  }

  return events;
}

function attrsToRecord(
  attributes?: OtelSpan['attributes'],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const attr of attributes ?? []) {
    const v = attr.value;
    if (v.stringValue !== undefined) out[attr.key] = v.stringValue;
    else if (v.intValue !== undefined) out[attr.key] = Number(v.intValue);
    else if (v.doubleValue !== undefined) out[attr.key] = v.doubleValue;
    else if (v.boolValue !== undefined) out[attr.key] = v.boolValue;
  }
  return out;
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function newTraceId(): string {
  return generateId().replace(/-/g, '');
}

export function newSpanId(): string {
  return generateId().replace(/-/g, '').slice(0, 16);
}
