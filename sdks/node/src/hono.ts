import type { Context, MiddlewareHandler } from 'hono';
import { AmlexiaClient } from './client.js';
import { createTraceContext, childSpan, applyTraceToEvent } from './tracing.js';
import { detectProviderFromHints } from '@amlexiahq/shared';

export function amlexiaHonoMiddleware(
  client: AmlexiaClient,
  options?: { serviceName?: string },
): MiddlewareHandler {
  return async (c: Context, next) => {
    const trace = createTraceContext({
      sessionId: c.req.header('x-session-id') ?? undefined,
      userId: c.req.header('x-user-id') ?? undefined,
    });
    const span = childSpan(trace);
    const start = Date.now();
    c.header('traceparent', `00-${trace.traceId}-${span.spanId}-01`);

    await next();

    const latencyMs = Date.now() - start;
    const path = c.req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id').replace(/\/\d+/g, '/:id');
    const detected = detectProviderFromHints({ endpoint: path });

    client.track(
      applyTraceToEvent(
        {
          endpoint: `${c.req.method} ${path}`,
          method: c.req.method,
          statusCode: c.res.status,
          latencyMs,
          serviceName: options?.serviceName ?? 'api',
          operationName: path,
          provider: detected.name !== 'unknown' ? detected.name : undefined,
          providerCategory: detected.category,
          errorMessage: c.res.status >= 400 ? `HTTP ${c.res.status}` : null,
        },
        span,
      ),
    );
  };
}
