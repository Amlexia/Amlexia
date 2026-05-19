import { enrichEventCost } from '@amlexiahq/shared';
import type { AmlexiaClient } from '../client.js';

export interface OpenAiUsageShape {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export function trackOpenAiCompletion(
  client: AmlexiaClient,
  input: {
    model: string;
    endpoint?: string;
    statusCode: number;
    latencyMs: number;
    usage?: OpenAiUsageShape;
    costUsd?: number;
    errorMessage?: string | null;
    traceId?: string;
    spanId?: string;
  },
): void {
  const tokensInput = input.usage?.prompt_tokens;
  const tokensOutput = input.usage?.completion_tokens;
  const { cost_usd } = enrichEventCost({
    cost_usd: input.costUsd,
    model_name: input.model,
    provider: 'openai',
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    total_tokens: input.usage?.total_tokens,
  });

  client.track({
    endpoint: input.endpoint ?? '/v1/chat/completions',
    method: 'POST',
    statusCode: input.statusCode,
    latencyMs: input.latencyMs,
    provider: 'openai',
    modelName: input.model,
    tokensInput,
    tokensOutput,
    totalTokens: input.usage?.total_tokens,
    costUsd: cost_usd,
    errorMessage: input.errorMessage,
    traceId: input.traceId,
    spanId: input.spanId,
  });
}
