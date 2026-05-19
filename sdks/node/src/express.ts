import type { Request, Response, NextFunction } from 'express';
import { detectProviderFromHints } from '@amlexiahq/shared';
import { AmlexiaClient } from './client.js';
import { applyTraceToEvent, childSpan, createTraceContext } from './tracing.js';

export function AmlexiaMiddleware(
  client: AmlexiaClient,
  options?: { serviceName?: string },
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const trace = createTraceContext({
      sessionId: (req.headers['x-session-id'] as string | undefined) ?? undefined,
      userId: (req.headers['x-user-id'] as string | undefined) ?? undefined,
    });
    const span = childSpan(trace);
    res.setHeader('traceparent', `00-${trace.traceId}-${span.spanId}-01`);

    const start = Date.now();
    const endpoint = normalizePath(req.route?.path ?? req.path, req.baseUrl);

    res.on('finish', () => {
      const latencyMs = Date.now() - start;
      const detected = detectProviderFromHints({ endpoint });

      client.track(
        applyTraceToEvent(
          {
            endpoint: `${req.method} ${endpoint}`,
            method: req.method,
            statusCode: res.statusCode,
            latencyMs,
            serviceName: options?.serviceName ?? 'api',
            operationName: endpoint,
            provider: detected.name !== 'unknown' ? detected.name : undefined,
            providerCategory: detected.category,
            requestSizeBytes: parseInt(req.headers['content-length'] ?? '0', 10) || null,
            errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null,
          },
          span,
        ),
      );
    });

    next();
  };
}

function normalizePath(path: string, baseUrl: string): string {
  const full = `${baseUrl}${path}`.replace(/\/+/g, '/');
  return full
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}
