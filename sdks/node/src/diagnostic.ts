export interface DiagnosticState {
  enabled: boolean;
  eventsBuffered: number;
  lastFlushAt: number | null;
  lastError: string | null;
}

export function createDiagnosticState(enabled = false): DiagnosticState {
  return {
    enabled,
    eventsBuffered: 0,
    lastFlushAt: null,
    lastError: null,
  };
}
