import { newSpanId, newTraceId } from '@amlexiahq/shared';
import type { TrackEvent } from './types.js';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sessionId?: string;
  userId?: string;
  environment?: string;
  releaseVersion?: string;
}

export function createTraceContext(options?: Partial<TraceContext>): TraceContext {
  return {
    traceId: options?.traceId ?? newTraceId(),
    spanId: options?.spanId ?? newSpanId(),
    parentSpanId: options?.parentSpanId,
    sessionId: options?.sessionId,
    userId: options?.userId,
    environment: options?.environment ?? process.env.NODE_ENV,
    releaseVersion: options?.releaseVersion ?? process.env.AMLEXIA_RELEASE,
  };
}

export function childSpan(parent: TraceContext): TraceContext {
  return {
    ...parent,
    spanId: newSpanId(),
    parentSpanId: parent.spanId,
  };
}

export function applyTraceToEvent(event: TrackEvent, ctx: TraceContext): TrackEvent {
  return {
    ...event,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: ctx.parentSpanId,
    sessionId: ctx.sessionId ?? event.sessionId,
    userId: ctx.userId ?? event.userId,
    environment: ctx.environment ?? event.environment,
    releaseVersion: ctx.releaseVersion ?? event.releaseVersion,
  };
}
