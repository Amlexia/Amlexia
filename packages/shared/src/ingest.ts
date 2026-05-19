import { enrichEventCost, type CostEnrichment } from './pricing/estimate.js';

export interface IngestEventLike {
  timestamp?: number;
  cost_usd?: number | null;
  cost_source?: 'reported' | 'estimated' | null;
  model_name?: string | null;
  provider?: string | null;
  provider_name?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  total_tokens?: number | null;
  [key: string]: unknown;
}

export function applyIngestDefaults<T extends IngestEventLike>(event: T): T & { timestamp: number } {
  return {
    ...event,
    timestamp: event.timestamp ?? Math.floor(Date.now() / 1000),
  };
}

export function applyIngestCostEnrichment<T extends IngestEventLike>(
  event: T,
): T & CostEnrichment {
  const withDefaults = applyIngestDefaults(event);
  const { cost_usd, cost_source } = enrichEventCost(withDefaults);
  return { ...withDefaults, cost_usd, cost_source };
}
