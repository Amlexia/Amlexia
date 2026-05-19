import { enrichEventCost } from '@amlexiahq/shared';
import type { AmlexiaClient } from '../client.js';

export interface AnthropicUsageShape {
  input_tokens?: number;
  output_tokens?: number;
}

export function trackAnthropicMessage(
  client: AmlexiaClient,
  input: {
    model: string;
    statusCode: number;
    latencyMs: number;
    usage?: AnthropicUsageShape;
    costUsd?: number;
    errorMessage?: string | null;
    traceId?: string;
  },
): void {
  const tokensInput = input.usage?.input_tokens;
  const tokensOutput = input.usage?.output_tokens;
  const { cost_usd } = enrichEventCost({
    cost_usd: input.costUsd,
    model_name: input.model,
    provider: 'anthropic',
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
  });

  client.track({
    endpoint: '/v1/messages',
    method: 'POST',
    statusCode: input.statusCode,
    latencyMs: input.latencyMs,
    provider: 'anthropic',
    modelName: input.model,
    tokensInput,
    tokensOutput,
    costUsd: cost_usd,
    errorMessage: input.errorMessage,
    traceId: input.traceId,
  });
}
