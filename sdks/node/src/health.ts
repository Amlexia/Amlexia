export interface HealthCheckOptions {
  ingestUrl?: string;
  timeoutMs?: number;
}

export async function checkIngestHealth(
  ingestUrl = 'https://ingest.amlexia.com',
  options: HealthCheckOptions = {},
): Promise<{ ok: boolean; status: number; latencyMs: number }> {
  const base = ingestUrl.replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 5000;
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, status: 0, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}
