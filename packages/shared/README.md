# @amlexiahq/shared

Shared utilities for Amlexia **Node.js** tooling and `@amlexiahq/node`. Most users should install **`@amlexiahq/node`** only; this package is published as a dependency.

```bash
npm install @amlexiahq/shared
```

**License:** Proprietary — not open source. See [LICENSE](./LICENSE).  
**Support:** support@amlexia.com

---

## When to use this package

| Use case | Package |
|----------|---------|
| Monitor your Node API | `@amlexiahq/node` |
| Custom tooling that needs trace IDs or provider detection | `@amlexiahq/shared` |
| Python apps | `amlexia` on PyPI (has built-in detection) |

---

## Exports

### Trace identifiers

```typescript
import { newTraceId, newSpanId } from '@amlexiahq/shared';

const traceId = newTraceId(); // 32 hex chars
const spanId = newSpanId();   // 16 hex chars
```

Used internally by `@amlexiahq/node/tracing`.

### Provider detection

```typescript
import { detectProviderFromHints } from '@amlexiahq/shared';

const detected = detectProviderFromHints({
  endpoint: 'POST /v1/chat/completions',
  host: 'api.openai.com',
  metadata: { model: 'gpt-4o' },
});

// { name: 'openai', category: 'ai', modelName?: string }
```

### PII scrubbing

```typescript
import { scrubMetadata, scrubString } from '@amlexiahq/shared';

const safe = scrubMetadata(
  { email: 'user@example.com', note: 'ok' },
  { piiMaskingEnabled: true, maxMetadataBytes: 8192 },
);
```

| Option | Default | Description |
|--------|---------|-------------|
| `piiMaskingEnabled` | `true` | Mask emails/phones in strings |
| `maxMetadataBytes` | `8192` | Truncate large metadata JSON |
| `maxStringLength` | `2048` | Per-string cap |
| `additionalPatterns` | `[]` | Extra regexes to redact |

Redacts sensitive header names and field names matching `password`, `token`, `api_key`, etc.

### Schemas and types

Zod schemas and TypeScript types for ingest payloads (used by workers and advanced integrations).

### OpenTelemetry parser

Utilities to parse OTEL-shaped payloads (`otel/parser` export).

### Analytics store

`D1AnalyticsStore` — server-side analytics implementation for the Amlexia platform (not needed in customer apps).

---

## Environment variables

This package does not read environment variables directly. Use `@amlexiahq/node` or see [ENVIRONMENT_VARIABLES.md](../../docs/ENVIRONMENT_VARIABLES.md).

---

## Links

- [Node.js SDK](../../sdks/node/README.md)
- [Event fields](../../docs/EVENT_FIELDS.md)
