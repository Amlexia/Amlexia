import type {
  EventsSummaryResponse,
  LatencyRow,
  ErrorRow,
  CostRow,
  TimeRange,
} from '../types.js';

export interface ProviderHealthRow {
  provider: string;
  providerCategory: string;
  uptimePercent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  retryRate: number;
  timeoutRate: number;
  totalRequests: number;
  totalCostUsd: number;
}

export interface ModelMetricsRow {
  provider: string;
  modelName: string;
  totalRequests: number;
  tokensInput: number;
  tokensOutput: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalCostUsd: number;
  cacheHitRate: number;
}

export interface TraceSummary {
  id: string;
  traceId: string;
  sessionId: string | null;
  rootEndpoint: string;
  startedAt: number;
  completedAt: number | null;
  totalDurationMs: number | null;
  status: string;
  spanCount?: number;
}

export interface SpanRecord {
  id: string;
  spanId: string;
  parentSpanId: string | null;
  provider: string | null;
  serviceName: string | null;
  operationName: string | null;
  endpoint: string | null;
  method: string | null;
  latencyMs: number;
  statusCode: number | null;
  costUsd: number | null;
  modelName: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  startedAt: number;
  endedAt: number;
  metadata: Record<string, unknown> | null;
}

export interface AnomalyRecord {
  id: string;
  anomalyType: string;
  severity: string;
  provider: string | null;
  description: string;
  detectedAt: number;
  resolvedAt: number | null;
}

export interface InsightRecord {
  id: string;
  insightType: string;
  title: string;
  description: string;
  severity: string;
  provider: string | null;
  createdAt: number;
}

/** Storage abstraction — swap D1 for ClickHouse/Tinybird without changing services */
export interface AnalyticsStore {
  getEventsSummary(projectId: string, range: TimeRange): Promise<EventsSummaryResponse>;
  getLatencyRows(projectId: string, range: TimeRange, page: number, limit: number): Promise<{ rows: LatencyRow[]; total: number }>;
  getErrorRows(projectId: string, range: TimeRange, page: number, limit: number): Promise<{ rows: ErrorRow[]; total: number }>;
  getCostRows(projectId: string, range: TimeRange, page: number, limit: number): Promise<{ rows: CostRow[] }>;
  getProviderHealth(projectId: string, range: TimeRange): Promise<ProviderHealthRow[]>;
  getModelMetrics(projectId: string, range: TimeRange): Promise<ModelMetricsRow[]>;
  listTraces(projectId: string, range: TimeRange, limit: number, offset: number): Promise<TraceSummary[]>;
  getTraceWithSpans(projectId: string, traceId: string): Promise<{ trace: TraceSummary; spans: SpanRecord[] } | null>;
  listSessions(projectId: string, range: TimeRange, limit: number): Promise<Array<{ sessionId: string; traceCount: number; lastSeen: number; hasErrors: boolean }>>;
  listAnomalies(projectId: string, unresolvedOnly: boolean): Promise<AnomalyRecord[]>;
  listInsights(projectId: string, limit: number): Promise<InsightRecord[]>;
  getInfrastructureStats(projectId: string, range: TimeRange): Promise<{
    webhookFailures: number;
    retryStorms: number;
    timeoutRate: number;
    providerOutages: number;
  }>;
}
