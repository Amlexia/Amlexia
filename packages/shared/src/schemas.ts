import { z } from 'zod';

const aiFields = {
  model_name: z.string().max(128).optional(),
  tokens_input: z.number().int().nonnegative().optional().nullable(),
  tokens_output: z.number().int().nonnegative().optional().nullable(),
  total_tokens: z.number().int().nonnegative().optional().nullable(),
  streaming_latency_ms: z.number().int().nonnegative().optional().nullable(),
  first_token_latency_ms: z.number().int().nonnegative().optional().nullable(),
  cache_hit: z.boolean().optional(),
};

const traceFields = {
  trace_id: z.string().max(64).optional(),
  span_id: z.string().max(32).optional(),
  parent_span_id: z.string().max(32).optional(),
  session_id: z.string().max(128).optional(),
  user_id: z.string().max(128).optional(),
  environment: z.string().max(64).optional(),
  release_version: z.string().max(64).optional(),
  service_name: z.string().max(128).optional(),
  operation_name: z.string().max(256).optional(),
  provider_category: z.string().max(64).optional(),
  provider_name: z.string().max(128).optional(),
};

export const ingestEventSchema = z.object({
  endpoint: z.string().min(1).max(512),
  method: z.string().min(1).max(16),
  status_code: z.number().int().min(100).max(599),
  latency_ms: z.number().int().min(0).max(3_600_000),
  timestamp: z.number().int().positive().optional(),
  request_size_bytes: z.number().int().nonnegative().nullable().optional(),
  response_size_bytes: z.number().int().nonnegative().nullable().optional(),
  cost_usd: z.number().nonnegative().nullable().optional(),
  provider: z.string().max(128).nullable().optional(),
  error_message: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotency_key: z.string().max(128).optional(),
  retry_count: z.number().int().nonnegative().optional(),
  is_webhook: z.boolean().optional(),
  ...traceFields,
  ...aiFields,
});

export const ingestRequestSchema = z.object({
  sdk_key: z.string().min(16).max(128),
  events: z.array(ingestEventSchema).min(1).max(100),
});

export const ingestSpanSchema = z.object({
  span_id: z.string().min(1).max(32),
  parent_span_id: z.string().max(32).optional(),
  provider: z.string().max(128).optional(),
  service_name: z.string().max(128).optional(),
  operation_name: z.string().max(256).optional(),
  endpoint: z.string().max(512).optional(),
  method: z.string().max(16).optional(),
  latency_ms: z.number().int().min(0),
  status_code: z.number().int().optional(),
  cost_usd: z.number().nonnegative().optional(),
  ...aiFields,
  retry_count: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
  started_at: z.number().int().positive(),
  ended_at: z.number().int().positive(),
});

export const ingestTraceSchema = z.object({
  sdk_key: z.string().min(16).max(128),
  trace_id: z.string().min(1).max(64),
  session_id: z.string().max(128).optional(),
  user_id: z.string().max(128).optional(),
  environment: z.string().max(64).optional(),
  release_version: z.string().max(64).optional(),
  root_endpoint: z.string().min(1).max(512),
  started_at: z.number().int().positive(),
  completed_at: z.number().int().positive().optional(),
  status: z.enum(['in_progress', 'ok', 'error']).optional(),
  spans: z.array(ingestSpanSchema).min(1).max(200),
});

export const otelIngestSchema = z.object({
  sdk_key: z.string().min(16).max(128),
  resourceSpans: z.array(z.record(z.unknown())).min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(128),
  organizationId: z.string().uuid().optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(128),
  clerkOrgId: z.string().min(1),
});

export const createAlertSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(128),
  conditionType: z.enum([
    'latency',
    'error_rate',
    'cost',
    'anomaly',
    'provider_outage',
    'retry_storm',
    'cost_explosion',
    'token_spike',
    'webhook_degradation',
  ]),
  thresholdValue: z.number().positive().optional(),
  channel: z.enum(['email', 'slack', 'webhook']),
  slackWebhookUrl: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  cooldownMinutes: z.number().int().min(1).max(1440).default(30),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  alertGroup: z.string().max(64).optional(),
});

export const updateAlertSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  thresholdValue: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  slackWebhookUrl: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export const timeRangeSchema = z.enum(['1h', '24h', '7d', '30d']);

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(128),
});

export const projectSettingsSchema = z.object({
  retentionRawDays: z.number().int().min(1).max(90).optional(),
  retentionHourlyDays: z.number().int().min(7).max(365).optional(),
  retentionDailyDays: z.number().int().min(30).max(730).optional(),
  piiMaskingEnabled: z.boolean().optional(),
  metadataMaxBytes: z.number().int().min(1024).max(65536).optional(),
});

export const replayEventSchema = z.object({
  projectId: z.string().uuid(),
  captureId: z.string().uuid(),
});
