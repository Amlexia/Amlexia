const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'proxy-authorization',
]);

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
  /cvv/i,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

export interface ScrubOptions {
  maxMetadataBytes?: number;
  maxStringLength?: number;
  additionalPatterns?: RegExp[];
  piiMaskingEnabled?: boolean;
}

const DEFAULT_MAX_METADATA_BYTES = 8192;
const DEFAULT_MAX_STRING = 2048;

export function scrubMetadata(
  metadata: Record<string, unknown> | undefined,
  options: ScrubOptions = {},
): Record<string, unknown> | null {
  if (!metadata) return null;
  const maxBytes = options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES;
  const scrubbed = scrubObject(metadata, options);
  const json = JSON.stringify(scrubbed);
  if (json.length <= maxBytes) return scrubbed;
  return { _truncated: true, preview: json.slice(0, maxBytes) };
}

export function scrubObject(
  obj: Record<string, unknown>,
  options: ScrubOptions = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const patterns = [...SENSITIVE_FIELD_PATTERNS, ...(options.additionalPatterns ?? [])];
  const maskPii = options.piiMaskingEnabled !== false;

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) || patterns.some((p) => p.test(key))) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = scrubValue(value, { ...options, piiMaskingEnabled: maskPii });
  }
  return result;
}

function scrubValue(value: unknown, options: ScrubOptions): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let s = value;
    if (options.piiMaskingEnabled !== false) {
      s = s.replace(EMAIL_PATTERN, '[email@redacted]');
      s = s.replace(PHONE_PATTERN, '[phone@redacted]');
    }
    const maxLen = options.maxStringLength ?? DEFAULT_MAX_STRING;
    if (s.length > maxLen) return `${s.slice(0, maxLen)}…[truncated]`;
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, options));
  if (typeof value === 'object') {
    return scrubObject(value as Record<string, unknown>, options);
  }
  return value;
}

export function filterSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}
