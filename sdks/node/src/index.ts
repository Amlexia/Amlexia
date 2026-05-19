export { AmlexiaClient } from './client.js';
export type { AmlexiaClientOptions, TrackEvent } from './types.js';
export { createTraceContext, childSpan, applyTraceToEvent } from './tracing.js';
export type { TraceContext } from './tracing.js';
export { exportOtelSpans } from './otel-bridge.js';
export { withAmlexia } from './next.js';
