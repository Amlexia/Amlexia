import type { AmlexiaClient } from './client.js';
import { createTraceContext, childSpan, applyTraceToEvent } from './tracing.js';
import { detectProviderFromHints } from '@amlexiahq/shared';

type NextHandler = (
  request: Request,
  context?: { params?: Record<string, string> },
) => Promise<Response> | Response;

export function withAmlexia(
  client: AmlexiaClient,
  handler: NextHandler,
  options?: { route?: string; serviceName?: string },
): NextHandler {
  return async (request, context) => {
    const trace = createTraceContext();
    const span = childSpan(trace);
    const start = Date.now();
    const url = new URL(request.url);
    const route =
      options?.route ??
      url.pathname.replace(/\/[0-9a-f-]{36}/gi, '/[id]').replace(/\/\d+/g, '/[id]');

    let response: Response | undefined;
    let caughtError: Error | undefined;

    try {
      response = await handler(request, context);
      return response;
    } catch (e) {
      caughtError = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const latencyMs = Date.now() - start;
      const statusCode = caughtError ? 500 : (response?.status ?? 500);
      const detected = detectProviderFromHints({ endpoint: route });

      client.track(
        applyTraceToEvent(
          {
            endpoint: `${request.method} ${route}`,
            method: request.method,
            statusCode,
            latencyMs,
            serviceName: options?.serviceName ?? 'nextjs',
            operationName: route,
            provider: detected.name !== 'unknown' ? detected.name : undefined,
            providerCategory: detected.category,
            errorMessage: caughtError?.message ?? (statusCode >= 400 ? `HTTP ${statusCode}` : null),
          },
          span,
        ),
      );
    }
  };
}
