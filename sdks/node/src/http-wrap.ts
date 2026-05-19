import type { AmlexiaClient } from './client.js';
import type { TrackEvent } from './types.js';

export interface FetchWrapOptions {
  provider?: string;
  operationName?: string;
}

export function wrapFetch(
  client: AmlexiaClient,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const start = Date.now();
    let statusCode = 0;
    let errorMessage: string | undefined;
    try {
      const res = await baseFetch(input, init);
      statusCode = res.status;
      return res;
    } catch (err) {
      statusCode = 0;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      client.track({
        endpoint: url,
        method,
        statusCode: statusCode || 500,
        latencyMs: Date.now() - start,
        errorMessage: errorMessage ?? null,
        provider: tryProviderFromUrl(url),
      });
    }
  };
}

function tryProviderFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (host.includes('openai')) return 'openai';
    if (host.includes('anthropic')) return 'anthropic';
    if (host.includes('stripe')) return 'stripe';
    return null;
  } catch {
    return null;
  }
}

export function trackHttpCall(
  client: AmlexiaClient,
  event: Omit<TrackEvent, 'latencyMs'> & { latencyMs?: number },
): void {
  client.track({
    ...event,
    latencyMs: event.latencyMs ?? 0,
  });
}
