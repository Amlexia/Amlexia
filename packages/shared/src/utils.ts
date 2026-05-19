export function generateId(): string {
  return crypto.randomUUID();
}

export function generateSdkKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `am_${hex}`;
}

export function hourBucket(timestamp: number): number {
  return Math.floor(timestamp / 3600) * 3600;
}

export function dayBucket(timestamp: number): number {
  return Math.floor(timestamp / 86400) * 86400;
}

export function rangeToSeconds(range: string): number {
  switch (range) {
    case '1h':
      return 3600;
    case '24h':
      return 86400;
    case '7d':
      return 7 * 86400;
    case '30d':
      return 30 * 86400;
    default:
      return 86400;
  }
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function maskSdkKey(key: string): string {
  if (key.length <= 12) return '••••••••';
  return `${key.slice(0, 8)}${'•'.repeat(12)}${key.slice(-4)}`;
}

export const RETENTION = {
  rawEventsSeconds: 7 * 86400,
  hourlyAggregatesSeconds: 90 * 86400,
  dailyAggregatesSeconds: 365 * 86400,
} as const;
