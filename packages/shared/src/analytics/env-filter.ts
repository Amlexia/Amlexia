export type EnvironmentFilter = 'all' | string;

export function normalizeEnvironmentFilter(value?: string | null): EnvironmentFilter {
  if (!value || value === 'all') return 'all';
  return value.trim().slice(0, 64);
}

/** SQL fragment for api_events.environment filtering */
export function apiEventsEnvSql(environment: EnvironmentFilter): {
  clause: string;
  bind: string | null;
} {
  if (environment === 'all') {
    return { clause: '', bind: null };
  }
  return { clause: ' AND environment = ?', bind: environment };
}
