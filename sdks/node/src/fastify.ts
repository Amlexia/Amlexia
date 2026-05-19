import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { detectProviderFromHints } from '@amlexiahq/shared';
import { AmlexiaClient } from './client.js';
import { applyTraceToEvent, childSpan, createTraceContext } from './tracing.js';

export function amlexiaPlugin(
  client: AmlexiaClient,
  options?: { serviceName?: string },
) {
  return async function plugin(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const trace = createTraceContext({
        sessionId: (request.headers['x-session-id'] as string | undefined) ?? undefined,
        userId: (request.headers['x-user-id'] as string | undefined) ?? undefined,
      });
      const span = childSpan(trace);
      const req = request as FastifyRequest & {
        amlexiaStart?: number;
        amlexiaSpan?: ReturnType<typeof childSpan>;
      };
      req.amlexiaStart = Date.now();
      req.amlexiaSpan = span;
      reply.header('traceparent', `00-${trace.traceId}-${span.spanId}-01`);
    });

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as FastifyRequest & {
        amlexiaStart?: number;
        amlexiaSpan?: ReturnType<typeof childSpan>;
      };
      if (req.amlexiaStart === undefined || !req.amlexiaSpan) return;

      const latencyMs = Date.now() - req.amlexiaStart;
      const routePath = request.routeOptions?.url ?? request.url.split('?')[0];
      const endpoint = normalizePath(routePath);
      const detected = detectProviderFromHints({ endpoint });

      client.track(
        applyTraceToEvent(
          {
            endpoint: `${request.method} ${endpoint}`,
            method: request.method,
            statusCode: reply.statusCode,
            latencyMs,
            serviceName: options?.serviceName ?? 'api',
            operationName: endpoint,
            provider: detected.name !== 'unknown' ? detected.name : undefined,
            providerCategory: detected.category,
            errorMessage: reply.statusCode >= 400 ? `HTTP ${reply.statusCode}` : null,
          },
          req.amlexiaSpan,
        ),
      );
    });
  };
}

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}
