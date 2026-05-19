import { rangeToSeconds } from '../utils.js';
import type { TimeRange, EventsSummaryResponse, LatencyRow, ErrorRow, CostRow } from '../types.js';
import {
  apiEventsEnvSql,
  normalizeEnvironmentFilter,
  type EnvironmentFilter,
} from './env-filter.js';
import type {
  AnalyticsStore,
  ProviderHealthRow,
  ModelMetricsRow,
  TraceSummary,
  SpanRecord,
  AnomalyRecord,
  InsightRecord,
} from './types.js';

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

export class D1AnalyticsStore implements AnalyticsStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async getEventsSummary(
    projectId: string,
    range: TimeRange,
    environment: EnvironmentFilter = 'all',
  ): Promise<EventsSummaryResponse> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);
    const env = normalizeEnvironmentFilter(environment);
    if (env !== 'all') {
      return this.getEventsSummaryFromRawEvents(projectId, range, since, env);
    }

    const summary = await this.db
      .prepare(
        `SELECT COUNT(*) as total_requests, AVG(latency_ms) as avg_latency_ms,
         SUM(CASE WHEN status_code >= 400 THEN 1.0 ELSE 0 END) / COUNT(*) as error_rate,
         COALESCE(SUM(cost_usd), 0) as total_cost_usd,
         COALESCE(SUM(CASE WHEN cost_source = 'reported' THEN cost_usd ELSE 0 END), 0) as reported_cost_usd,
         COALESCE(SUM(CASE WHEN cost_source = 'estimated' THEN cost_usd ELSE 0 END), 0) as estimated_cost_usd
         FROM api_events WHERE project_id = ? AND timestamp >= ?`,
      )
      .bind(projectId, since)
      .first<{
        total_requests: number;
        avg_latency_ms: number;
        error_rate: number;
        total_cost_usd: number;
        reported_cost_usd: number;
        estimated_cost_usd: number;
      }>();

    const daily = await this.db
      .prepare(
        `SELECT day_bucket as bucket, total_requests as requests, avg_latency_ms,
         error_rate, total_cost_usd as cost_usd
         FROM daily_project_metrics WHERE project_id = ? AND day_bucket >= ?
         ORDER BY day_bucket ASC`,
      )
      .bind(projectId, since)
      .all<{ bucket: number; requests: number; avg_latency_ms: number; error_rate: number; cost_usd: number }>();

    if (daily.results.length > 0) {
      return {
        totalRequests: summary?.total_requests ?? 0,
        avgLatencyMs: summary?.avg_latency_ms ?? 0,
        errorRate: summary?.error_rate ?? 0,
        totalCostUsd: summary?.total_cost_usd ?? 0,
        reportedCostUsd: summary?.reported_cost_usd ?? 0,
        estimatedCostUsd: summary?.estimated_cost_usd ?? 0,
        timeSeries: daily.results.map((d) => ({
          bucket: d.bucket,
          requests: d.requests,
          avgLatencyMs: d.avg_latency_ms,
          errorRate: d.error_rate,
          costUsd: d.cost_usd,
        })),
      };
    }

    const hourly = await this.db
      .prepare(
        `SELECT hour_bucket as bucket, SUM(total_requests) as requests,
         AVG(avg_latency_ms) as avg_latency_ms, AVG(error_rate) as error_rate,
         SUM(total_cost_usd) as cost_usd
         FROM hourly_endpoint_metrics WHERE project_id = ? AND hour_bucket >= ?
         GROUP BY hour_bucket ORDER BY hour_bucket ASC`,
      )
      .bind(projectId, since)
      .all<{ bucket: number; requests: number; avg_latency_ms: number; error_rate: number; cost_usd: number }>();

    return {
      totalRequests: summary?.total_requests ?? 0,
      avgLatencyMs: summary?.avg_latency_ms ?? 0,
      errorRate: summary?.error_rate ?? 0,
      totalCostUsd: summary?.total_cost_usd ?? 0,
      reportedCostUsd: summary?.reported_cost_usd ?? 0,
      estimatedCostUsd: summary?.estimated_cost_usd ?? 0,
      timeSeries: hourly.results.map((d) => ({
        bucket: d.bucket,
        requests: d.requests,
        avgLatencyMs: d.avg_latency_ms,
        errorRate: d.error_rate,
        costUsd: d.cost_usd,
      })),
    };
  }

  async listEventsByTrace(
    projectId: string,
    traceId: string,
    limit = 100,
  ): Promise<
    Array<{
      id: string;
      endpoint: string;
      method: string;
      statusCode: number;
      latencyMs: number;
      costUsd: number | null;
      costSource: string | null;
      timestamp: number;
      spanId: string | null;
    }>
  > {
    const rows = await this.db
      .prepare(
        `SELECT id, endpoint, method, status_code, latency_ms, cost_usd, cost_source, timestamp, span_id
         FROM api_events WHERE project_id = ? AND trace_id = ?
         ORDER BY timestamp ASC LIMIT ?`,
      )
      .bind(projectId, traceId, limit)
      .all<{
        id: string;
        endpoint: string;
        method: string;
        status_code: number;
        latency_ms: number;
        cost_usd: number | null;
        cost_source: string | null;
        timestamp: number;
        span_id: string | null;
      }>();

    return rows.results.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      method: r.method,
      statusCode: r.status_code,
      latencyMs: r.latency_ms,
      costUsd: r.cost_usd,
      costSource: r.cost_source,
      timestamp: r.timestamp,
      spanId: r.span_id,
    }));
  }

  async getOpsMetrics(
    projectId: string,
    range: TimeRange,
    environment: EnvironmentFilter = 'all',
  ): Promise<{
    slo: { availability: number; latencyP95Ms: number; targetAvailability: number };
    spendForecastUsd: number;
    incidents: Array<{ type: string; at: number; detail: string }>;
    providerStatus: Array<{ provider: string; healthy: boolean; errorRate: number }>;
  }> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);
    const { clause, bind } = apiEventsEnvSql(normalizeEnvironmentFilter(environment));

    const base = await this.db
      .prepare(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN status_code < 400 THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) as availability,
         COALESCE(SUM(cost_usd), 0) as cost
         FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}`,
      )
      .bind(projectId, since, ...(bind ? [bind] : []))
      .first<{ total: number; availability: number; cost: number }>();

    const p95 = await this.db
      .prepare(
        `SELECT MAX(p95_latency_ms) as p95 FROM hourly_endpoint_metrics
         WHERE project_id = ? AND hour_bucket >= ?`,
      )
      .bind(projectId, since)
      .first<{ p95: number }>();

    const providers = await this.getProviderHealth(projectId, range);
    const providerStatus = providers.map((p) => ({
      provider: p.provider,
      healthy: p.errorRate < 0.05,
      errorRate: p.errorRate,
    }));

    const days = Math.max(1, rangeToSeconds(range) / 86400);
    const dailyAvg = (base?.cost ?? 0) / days;
    const spendForecastUsd = dailyAvg * 30;

    const incidents = await this.db
      .prepare(
        `SELECT anomaly_type, detected_at, severity FROM anomalies
         WHERE project_id = ? AND detected_at >= ? ORDER BY detected_at DESC LIMIT 20`,
      )
      .bind(projectId, since)
      .all<{ anomaly_type: string; detected_at: number; severity: string }>();

    return {
      slo: {
        availability: base?.availability ?? 1,
        latencyP95Ms: p95?.p95 ?? 0,
        targetAvailability: 0.99,
      },
      spendForecastUsd,
      incidents: incidents.results.map((i) => ({
        type: i.anomaly_type,
        at: i.detected_at,
        detail: i.severity,
      })),
      providerStatus,
    };
  }

  async compareEnvironments(
    projectId: string,
    range: TimeRange,
    envA: string,
    envB: string,
  ): Promise<{
    envA: EventsSummaryResponse & { environment: string };
    envB: EventsSummaryResponse & { environment: string };
  }> {
    const [a, b] = await Promise.all([
      this.getEventsSummary(projectId, range, envA),
      this.getEventsSummary(projectId, range, envB),
    ]);
    return {
      envA: { ...a, environment: envA },
      envB: { ...b, environment: envB },
    };
  }

  private async getEventsSummaryFromRawEvents(
    projectId: string,
    range: TimeRange,
    since: number,
    environment: string,
  ): Promise<EventsSummaryResponse> {
    const { clause, bind } = apiEventsEnvSql(environment);
    const bucketSize = range === '1h' || range === '24h' ? 3600 : 86400;
    const summary = await this.db
      .prepare(
        `SELECT COUNT(*) as total_requests, AVG(latency_ms) as avg_latency_ms,
         SUM(CASE WHEN status_code >= 400 THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) as error_rate,
         COALESCE(SUM(cost_usd), 0) as total_cost_usd,
         COALESCE(SUM(CASE WHEN cost_source = 'reported' THEN cost_usd ELSE 0 END), 0) as reported_cost_usd,
         COALESCE(SUM(CASE WHEN cost_source = 'estimated' THEN cost_usd ELSE 0 END), 0) as estimated_cost_usd
         FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}`,
      )
      .bind(projectId, since, ...(bind ? [bind] : []))
      .first<{
        total_requests: number;
        avg_latency_ms: number;
        error_rate: number;
        total_cost_usd: number;
        reported_cost_usd: number;
        estimated_cost_usd: number;
      }>();

    const series = await this.db
      .prepare(
        `SELECT (timestamp / ?) * ? as bucket,
         COUNT(*) as requests,
         AVG(latency_ms) as avg_latency_ms,
         SUM(CASE WHEN status_code >= 400 THEN 1.0 ELSE 0 END) / NULLIF(COUNT(*), 0) as error_rate,
         COALESCE(SUM(cost_usd), 0) as cost_usd
         FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}
         GROUP BY bucket ORDER BY bucket ASC`,
      )
      .bind(bucketSize, bucketSize, projectId, since, ...(bind ? [bind] : []))
      .all<{
        bucket: number;
        requests: number;
        avg_latency_ms: number;
        error_rate: number;
        cost_usd: number;
      }>();

    return {
      totalRequests: summary?.total_requests ?? 0,
      avgLatencyMs: summary?.avg_latency_ms ?? 0,
      errorRate: summary?.error_rate ?? 0,
      totalCostUsd: summary?.total_cost_usd ?? 0,
      reportedCostUsd: summary?.reported_cost_usd ?? 0,
      estimatedCostUsd: summary?.estimated_cost_usd ?? 0,
      timeSeries: series.results.map((d) => ({
        bucket: d.bucket,
        requests: d.requests,
        avgLatencyMs: d.avg_latency_ms,
        errorRate: d.error_rate,
        costUsd: d.cost_usd,
      })),
    };
  }

  async getLatencyRows(
    projectId: string,
    range: TimeRange,
    page: number,
    limit: number,
    environment: EnvironmentFilter = 'all',
  ): Promise<{ rows: LatencyRow[]; total: number }> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);
    const offset = (page - 1) * limit;
    const env = normalizeEnvironmentFilter(environment);

    if (env !== 'all') {
      const { clause, bind } = apiEventsEnvSql(env);
      const rows = await this.db
        .prepare(
          `SELECT endpoint, method,
           AVG(latency_ms) as p50,
           MAX(latency_ms) as p95,
           MAX(latency_ms) as p99,
           COUNT(*) as request_count
           FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}
           GROUP BY endpoint, method ORDER BY request_count DESC LIMIT ? OFFSET ?`,
        )
        .bind(projectId, since, ...(bind ? [bind] : []), limit, offset)
        .all<{
          endpoint: string;
          method: string;
          p50: number;
          p95: number;
          p99: number;
          request_count: number;
        }>();
      const total = await this.db
        .prepare(
          `SELECT COUNT(DISTINCT endpoint || '|' || method) as cnt
           FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}`,
        )
        .bind(projectId, since, ...(bind ? [bind] : []))
        .first<{ cnt: number }>();
      return {
        rows: rows.results.map((r) => ({
          endpoint: r.endpoint,
          method: r.method,
          p50: r.p50,
          p95: r.p95,
          p99: r.p99,
          requestCount: r.request_count,
        })),
        total: total?.cnt ?? 0,
      };
    }

    const rows = await this.db
      .prepare(
        `SELECT endpoint, method, AVG(p50_latency_ms) as p50, AVG(p95_latency_ms) as p95,
         AVG(p99_latency_ms) as p99, SUM(total_requests) as request_count
         FROM hourly_endpoint_metrics
         WHERE project_id = ? AND hour_bucket >= ?
         GROUP BY endpoint, method
         ORDER BY request_count DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(projectId, since, limit, offset)
      .all<{ endpoint: string; method: string; p50: number; p95: number; p99: number; request_count: number }>();

    const total = await this.db
      .prepare(
        `SELECT COUNT(DISTINCT endpoint || method) as cnt FROM hourly_endpoint_metrics
         WHERE project_id = ? AND hour_bucket >= ?`,
      )
      .bind(projectId, since)
      .first<{ cnt: number }>();

    return {
      rows: rows.results.map((r) => ({
        endpoint: r.endpoint,
        method: r.method,
        p50: r.p50,
        p95: r.p95,
        p99: r.p99,
        requestCount: r.request_count,
      })),
      total: total?.cnt ?? 0,
    };
  }

  async getErrorRows(
    projectId: string,
    range: TimeRange,
    page: number,
    limit: number,
    environment: EnvironmentFilter = 'all',
  ): Promise<{ rows: ErrorRow[]; total: number }> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);
    const offset = (page - 1) * limit;
    const { clause, bind } = apiEventsEnvSql(normalizeEnvironmentFilter(environment));

    const result = await this.db
      .prepare(
        `SELECT endpoint, status_code, error_message, COUNT(*) as count, MAX(timestamp) as last_seen
         FROM api_events WHERE project_id = ? AND timestamp >= ? AND status_code >= 400${clause}
         GROUP BY endpoint, status_code, error_message ORDER BY count DESC LIMIT ? OFFSET ?`,
      )
      .bind(projectId, since, ...(bind ? [bind] : []), limit, offset)
      .all<{
        endpoint: string;
        status_code: number;
        error_message: string | null;
        count: number;
        last_seen: number;
      }>();

    const total = await this.db
      .prepare(
        `SELECT COUNT(DISTINCT endpoint || status_code || COALESCE(error_message,'')) as cnt
         FROM api_events WHERE project_id = ? AND timestamp >= ? AND status_code >= 400${clause}`,
      )
      .bind(projectId, since, ...(bind ? [bind] : []))
      .first<{ cnt: number }>();

    return {
      rows: result.results.map((r) => ({
        endpoint: r.endpoint,
        statusCode: r.status_code,
        errorMessage: r.error_message,
        count: r.count,
        lastSeen: r.last_seen,
      })),
      total: total?.cnt ?? 0,
    };
  }

  async getCostRows(
    projectId: string,
    range: TimeRange,
    page: number,
    limit: number,
    environment: EnvironmentFilter = 'all',
  ): Promise<{ rows: CostRow[] }> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);
    const offset = (page - 1) * limit;
    const env = normalizeEnvironmentFilter(environment);

    if (env !== 'all') {
      const { clause, bind } = apiEventsEnvSql(env);
      const result = await this.db
        .prepare(
          `SELECT COALESCE(provider_name, provider, 'unknown') as provider,
           COUNT(*) as total_requests, COALESCE(SUM(cost_usd), 0) as total_cost_usd
           FROM api_events WHERE project_id = ? AND timestamp >= ?${clause}
           GROUP BY provider ORDER BY total_cost_usd DESC LIMIT ? OFFSET ?`,
        )
        .bind(projectId, since, ...(bind ? [bind] : []), limit, offset)
        .all<{ provider: string; total_requests: number; total_cost_usd: number }>();
      return {
        rows: result.results.map((r) => ({
          provider: r.provider,
          totalRequests: r.total_requests,
          totalCostUsd: r.total_cost_usd,
          avgCostPerRequest: r.total_requests > 0 ? r.total_cost_usd / r.total_requests : 0,
        })),
      };
    }

    const result = await this.db
      .prepare(
        `SELECT COALESCE(provider_name, provider, 'unknown') as provider,
         SUM(total_requests) as total_requests, SUM(total_cost_usd) as total_cost_usd
         FROM provider_hourly_metrics WHERE project_id = ? AND hour_bucket >= ?
         GROUP BY provider ORDER BY total_cost_usd DESC LIMIT ? OFFSET ?`,
      )
      .bind(projectId, since, limit, offset)
      .all<{ provider: string; total_requests: number; total_cost_usd: number }>();

    return {
      rows: result.results.map((r) => ({
        provider: r.provider,
        totalRequests: r.total_requests,
        totalCostUsd: r.total_cost_usd,
        avgCostPerRequest: r.total_requests > 0 ? r.total_cost_usd / r.total_requests : 0,
      })),
    };
  }

  async getProviderHealth(projectId: string, range: TimeRange): Promise<ProviderHealthRow[]> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);

    const rows = await this.db
      .prepare(
        `SELECT provider, provider_category,
         SUM(total_requests) as total_requests,
         SUM(error_count) as error_count,
         SUM(timeout_count) as timeout_count,
         SUM(retry_count) as retry_count,
         AVG(avg_latency_ms) as avg_latency_ms,
         AVG(p95_latency_ms) as p95_latency_ms,
         SUM(total_cost_usd) as total_cost_usd
         FROM provider_hourly_metrics
         WHERE project_id = ? AND hour_bucket >= ?
         GROUP BY provider, provider_category
         ORDER BY total_requests DESC`,
      )
      .bind(projectId, since)
      .all<{
        provider: string;
        provider_category: string;
        total_requests: number;
        error_count: number;
        timeout_count: number;
        retry_count: number;
        avg_latency_ms: number;
        p95_latency_ms: number;
        total_cost_usd: number;
      }>();

    return rows.results.map((r) => {
      const errorRate = r.total_requests > 0 ? r.error_count / r.total_requests : 0;
      return {
        provider: r.provider,
        providerCategory: r.provider_category,
        uptimePercent: Math.max(0, (1 - errorRate) * 100),
        avgLatencyMs: r.avg_latency_ms,
        p95LatencyMs: r.p95_latency_ms,
        errorRate,
        retryRate: r.total_requests > 0 ? r.retry_count / r.total_requests : 0,
        timeoutRate: r.total_requests > 0 ? r.timeout_count / r.total_requests : 0,
        totalRequests: r.total_requests,
        totalCostUsd: r.total_cost_usd,
      };
    });
  }

  async getModelMetrics(projectId: string, range: TimeRange): Promise<ModelMetricsRow[]> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);

    const rows = await this.db
      .prepare(
        `SELECT provider, model_name, SUM(total_requests) as total_requests,
         SUM(tokens_input) as tokens_input, SUM(tokens_output) as tokens_output,
         AVG(avg_latency_ms) as avg_latency_ms, AVG(p95_latency_ms) as p95_latency_ms,
         SUM(total_cost_usd) as total_cost_usd, AVG(cache_hit_rate) as cache_hit_rate
         FROM model_hourly_metrics WHERE project_id = ? AND hour_bucket >= ?
         GROUP BY provider, model_name ORDER BY total_requests DESC`,
      )
      .bind(projectId, since)
      .all<{
        provider: string;
        model_name: string;
        total_requests: number;
        tokens_input: number;
        tokens_output: number;
        avg_latency_ms: number;
        p95_latency_ms: number;
        total_cost_usd: number;
        cache_hit_rate: number;
      }>();

    return rows.results.map((r) => ({
      provider: r.provider,
      modelName: r.model_name,
      totalRequests: r.total_requests,
      tokensInput: r.tokens_input,
      tokensOutput: r.tokens_output,
      avgLatencyMs: r.avg_latency_ms,
      p95LatencyMs: r.p95_latency_ms,
      totalCostUsd: r.total_cost_usd,
      cacheHitRate: r.cache_hit_rate,
    }));
  }

  async listTraces(
    projectId: string,
    range: TimeRange,
    limit: number,
    offset: number,
  ): Promise<TraceSummary[]> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);

    const rows = await this.db
      .prepare(
        `SELECT t.id, t.trace_id, t.session_id, t.root_endpoint, t.started_at, t.completed_at,
         t.total_duration_ms, t.status,
         (SELECT COUNT(*) FROM spans s WHERE s.trace_id = t.trace_id AND s.project_id = t.project_id) as span_count
         FROM traces t WHERE t.project_id = ? AND t.started_at >= ?
         ORDER BY t.started_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(projectId, since, limit, offset)
      .all<{
        id: string;
        trace_id: string;
        session_id: string | null;
        root_endpoint: string;
        started_at: number;
        completed_at: number | null;
        total_duration_ms: number | null;
        status: string;
        span_count: number;
      }>();

    return rows.results.map((r) => ({
      id: r.id,
      traceId: r.trace_id,
      sessionId: r.session_id,
      rootEndpoint: r.root_endpoint,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      totalDurationMs: r.total_duration_ms,
      status: r.status,
      spanCount: r.span_count,
    }));
  }

  async getTraceWithSpans(
    projectId: string,
    traceId: string,
  ): Promise<{ trace: TraceSummary; spans: SpanRecord[] } | null> {
    const trace = await this.db
      .prepare('SELECT * FROM traces WHERE project_id = ? AND trace_id = ? LIMIT 1')
      .bind(projectId, traceId)
      .first<Record<string, unknown>>();

    if (!trace) return null;

    const spans = await this.db
      .prepare(
        'SELECT * FROM spans WHERE project_id = ? AND trace_id = ? ORDER BY started_at ASC',
      )
      .bind(projectId, traceId)
      .all<Record<string, unknown>>();

    return {
      trace: {
        id: trace.id as string,
        traceId: trace.trace_id as string,
        sessionId: trace.session_id as string | null,
        rootEndpoint: trace.root_endpoint as string,
        startedAt: trace.started_at as number,
        completedAt: trace.completed_at as number | null,
        totalDurationMs: trace.total_duration_ms as number | null,
        status: trace.status as string,
      },
      spans: spans.results.map(mapSpan),
    };
  }

  async listSessions(
    projectId: string,
    range: TimeRange,
    limit: number,
  ): Promise<Array<{ sessionId: string; traceCount: number; lastSeen: number; hasErrors: boolean }>> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);

    const rows = await this.db
      .prepare(
        `SELECT session_id, COUNT(*) as trace_count, MAX(started_at) as last_seen,
         MAX(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as has_errors
         FROM traces WHERE project_id = ? AND session_id IS NOT NULL AND started_at >= ?
         GROUP BY session_id ORDER BY last_seen DESC LIMIT ?`,
      )
      .bind(projectId, since, limit)
      .all<{
        session_id: string;
        trace_count: number;
        last_seen: number;
        has_errors: number;
      }>();

    return rows.results.map((r) => ({
      sessionId: r.session_id,
      traceCount: r.trace_count,
      lastSeen: r.last_seen,
      hasErrors: r.has_errors > 0,
    }));
  }

  async listAnomalies(projectId: string, unresolvedOnly: boolean): Promise<AnomalyRecord[]> {
    const query = unresolvedOnly
      ? 'SELECT * FROM anomalies WHERE project_id = ? AND resolved_at IS NULL ORDER BY detected_at DESC LIMIT 100'
      : 'SELECT * FROM anomalies WHERE project_id = ? ORDER BY detected_at DESC LIMIT 100';

    const rows = await this.db.prepare(query).bind(projectId).all<Record<string, unknown>>();
    return rows.results.map((r) => ({
      id: r.id as string,
      anomalyType: r.anomaly_type as string,
      severity: r.severity as string,
      provider: r.provider as string | null,
      description: r.description as string,
      detectedAt: r.detected_at as number,
      resolvedAt: r.resolved_at as number | null,
    }));
  }

  async listInsights(projectId: string, limit: number): Promise<InsightRecord[]> {
    const rows = await this.db
      .prepare(
        'SELECT * FROM insights WHERE project_id = ? AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT ?',
      )
      .bind(projectId, limit)
      .all<Record<string, unknown>>();

    return rows.results.map((r) => ({
      id: r.id as string,
      insightType: r.insight_type as string,
      title: r.title as string,
      description: r.description as string,
      severity: r.severity as string,
      provider: r.provider as string | null,
      createdAt: r.created_at as number,
    }));
  }

  async getInfrastructureStats(
    projectId: string,
    range: TimeRange,
  ): Promise<{ webhookFailures: number; retryStorms: number; timeoutRate: number; providerOutages: number }> {
    const since = Math.floor(Date.now() / 1000) - rangeToSeconds(range);

    const webhooks = await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM api_events
         WHERE project_id = ? AND timestamp >= ? AND is_webhook = 1 AND status_code >= 400`,
      )
      .bind(projectId, since)
      .first<{ cnt: number }>();

    const retries = await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM api_events
         WHERE project_id = ? AND timestamp >= ? AND retry_count >= 3`,
      )
      .bind(projectId, since)
      .first<{ cnt: number }>();

    const timeouts = await this.db
      .prepare(
        `SELECT AVG(timeout_count * 1.0 / NULLIF(total_requests, 0)) as rate
         FROM provider_hourly_metrics WHERE project_id = ? AND hour_bucket >= ?`,
      )
      .bind(projectId, since)
      .first<{ rate: number }>();

    const outages = await this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM anomalies
         WHERE project_id = ? AND detected_at >= ? AND anomaly_type = 'provider_outage' AND resolved_at IS NULL`,
      )
      .bind(projectId, since)
      .first<{ cnt: number }>();

    return {
      webhookFailures: webhooks?.cnt ?? 0,
      retryStorms: retries?.cnt ?? 0,
      timeoutRate: timeouts?.rate ?? 0,
      providerOutages: outages?.cnt ?? 0,
    };
  }
}

function mapSpan(r: Record<string, unknown>): SpanRecord {
  let metadata: Record<string, unknown> | null = null;
  if (r.metadata && typeof r.metadata === 'string') {
    try {
      metadata = JSON.parse(r.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: r.id as string,
    spanId: r.span_id as string,
    parentSpanId: r.parent_span_id as string | null,
    provider: r.provider as string | null,
    serviceName: r.service_name as string | null,
    operationName: r.operation_name as string | null,
    endpoint: r.endpoint as string | null,
    method: r.method as string | null,
    latencyMs: r.latency_ms as number,
    statusCode: r.status_code as number | null,
    costUsd: r.cost_usd as number | null,
    modelName: r.model_name as string | null,
    tokensInput: r.tokens_input as number | null,
    tokensOutput: r.tokens_output as number | null,
    startedAt: r.started_at as number,
    endedAt: r.ended_at as number,
    metadata,
  };
}
