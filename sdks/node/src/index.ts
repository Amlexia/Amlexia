export { AmlexiaClient } from './client.js';
export type { DiagnosticState } from './diagnostic.js';
export type { AmlexiaClientOptions, TrackEvent } from './types.js';
export { createTraceContext, childSpan, applyTraceToEvent } from './tracing.js';
export type { TraceContext } from './tracing.js';
export { exportOtelSpans } from './otel-bridge.js';
export { withAmlexia } from './next.js';
export { checkIngestHealth } from './health.js';
export { wrapFetch, trackHttpCall } from './http-wrap.js';
export { shouldSample } from './sampling.js';
export { trackOpenAiCompletion } from './ai/openai.js';
export { trackAnthropicMessage } from './ai/anthropic.js';
export {
  estimateEventCostUsd,
  enrichEventCost,
  MODEL_PRICES,
  PLAN_LIMITS,
} from '@amlexiahq/shared';
