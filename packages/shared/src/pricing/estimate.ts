import { resolveModelPrice } from './table.js';

export type CostSource = 'reported' | 'estimated';

export interface CostEstimateInput {
  cost_usd?: number | null;
  model_name?: string | null;
  provider?: string | null;
  provider_name?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  total_tokens?: number | null;
}

export interface CostEnrichment {
  cost_usd: number | null;
  cost_source: CostSource | null;
}

export function estimateEventCostUsd(input: CostEstimateInput): number | null {
  if (input.cost_usd != null && input.cost_usd > 0) return input.cost_usd;

  const price = resolveModelPrice(
    input.model_name,
    input.provider_name ?? input.provider,
  );
  if (!price) return null;

  const inTok = input.tokens_input ?? 0;
  const outTok = input.tokens_output ?? 0;
  if (inTok === 0 && outTok === 0) {
    const total = input.total_tokens;
    if (total == null || total <= 0) return null;
    const blended = (price.inputPer1M + price.outputPer1M) / 2;
    return (total / 1_000_000) * blended;
  }

  return (inTok / 1_000_000) * price.inputPer1M + (outTok / 1_000_000) * price.outputPer1M;
}

export function enrichEventCost(input: CostEstimateInput): CostEnrichment {
  if (input.cost_usd != null && input.cost_usd > 0) {
    return { cost_usd: input.cost_usd, cost_source: 'reported' };
  }
  const estimated = estimateEventCostUsd(input);
  if (estimated != null && estimated > 0) {
    return { cost_usd: Math.round(estimated * 1e8) / 1e8, cost_source: 'estimated' };
  }
  return { cost_usd: input.cost_usd ?? null, cost_source: null };
}
