export type MemberRole = 'owner' | 'admin' | 'member';
export type AlertConditionType =
  | 'latency'
  | 'error_rate'
  | 'cost'
  | 'anomaly'
  | 'provider_outage'
  | 'retry_storm'
  | 'cost_explosion'
  | 'token_spike'
  | 'webhook_degradation';
export type AlertChannel = 'email' | 'slack';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TimeRange = '1h' | '24h' | '7d' | '30d';
export type TraceStatus = 'in_progress' | 'ok' | 'error';
export type AnomalyType =
  | 'latency_spike'
  | 'error_spike'
  | 'cost_spike'
  | 'provider_degradation'
  | 'retry_storm'
  | 'webhook_failure'
  | 'provider_outage'
  | 'token_spike';

export interface Organization {
  id: string;
  name: string;
  clerk_org_id: string;
  created_at: number;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  clerk_user_id: string;
  role: MemberRole;
  created_at: number;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  sdk_key: string;
  created_at: number;
}

export interface ApiEvent {
  id: string;
  project_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  request_size_bytes: number | null;
  response_size_bytes: number | null;
  cost_usd: number | null;
  provider: string | null;
  error_message: string | null;
  timestamp: number;
  metadata: string | null;
}

export interface IngestEventPayload {
  endpoint: string;
  method: string;
  status_code: number;
  latency_ms: number;
  timestamp: number;
  request_size_bytes?: number | null;
  response_size_bytes?: number | null;
  cost_usd?: number | null;
  provider?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  idempotency_key?: string;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  session_id?: string;
  user_id?: string;
  environment?: string;
  release_version?: string;
  service_name?: string;
  operation_name?: string;
  provider_category?: string;
  provider_name?: string;
  model_name?: string;
  tokens_input?: number | null;
  tokens_output?: number | null;
  total_tokens?: number | null;
  streaming_latency_ms?: number | null;
  first_token_latency_ms?: number | null;
  cache_hit?: boolean;
  retry_count?: number;
  is_webhook?: boolean;
}

export interface IngestRequest {
  sdk_key: string;
  events: IngestEventPayload[];
}

export interface QueueEventMessage {
  type: 'events';
  project_id: string;
  events: Array<IngestEventPayload & { id: string }>;
}

export interface QueueProcessMessage {
  type: 'process';
  project_id: string;
  hour_bucket: number;
}

export interface QueueAnomalyMessage {
  type: 'anomaly';
  project_id: string;
}

export interface QueueInsightMessage {
  type: 'insight';
  project_id: string;
}

export type QueueMessage =
  | QueueEventMessage
  | QueueProcessMessage
  | QueueAnomalyMessage
  | QueueInsightMessage;

export interface IngestTracePayload {
  sdk_key: string;
  trace_id: string;
  session_id?: string;
  user_id?: string;
  environment?: string;
  release_version?: string;
  root_endpoint: string;
  started_at: number;
  completed_at?: number;
  status?: TraceStatus;
  spans: Array<{
    span_id: string;
    parent_span_id?: string;
    provider?: string;
    service_name?: string;
    operation_name?: string;
    endpoint?: string;
    method?: string;
    latency_ms: number;
    status_code?: number;
    cost_usd?: number;
    model_name?: string;
    tokens_input?: number;
    tokens_output?: number;
    streaming_latency_ms?: number;
    first_token_latency_ms?: number;
    retry_count?: number;
    metadata?: Record<string, unknown>;
    started_at: number;
    ended_at: number;
  }>;
}

export interface LiveEvent {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  provider: string | null;
  timestamp: number;
  traceId?: string;
}

export interface EventsSummaryResponse {
  totalRequests: number;
  avgLatencyMs: number;
  errorRate: number;
  totalCostUsd: number;
  timeSeries: Array<{
    bucket: number;
    requests: number;
    avgLatencyMs: number;
    errorRate: number;
    costUsd: number;
  }>;
}

export interface LatencyRow {
  endpoint: string;
  method: string;
  p50: number;
  p95: number;
  p99: number;
  requestCount: number;
}

export interface ErrorRow {
  endpoint: string;
  statusCode: number;
  errorMessage: string | null;
  count: number;
  lastSeen: number;
}

export interface CostRow {
  provider: string;
  totalRequests: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
}

export interface AlertRecord {
  id: string;
  project_id: string;
  name: string;
  condition_type: AlertConditionType;
  threshold_value: number;
  channel: AlertChannel;
  slack_webhook_url: string | null;
  email: string | null;
  cooldown_minutes: number;
  is_active: number;
  created_at: number;
}
