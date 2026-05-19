# Event fields reference

Events are sent to `POST {ingestUrl}/v1/events` as JSON batches. Each event describes one HTTP operation or instrumented call.

## Required fields

| Field (SDK) | Ingest JSON | Type | Description |
|-------------|-------------|------|-------------|
| `endpoint` | `endpoint` | string | Route or operation label, e.g. `POST /v1/chat` or `GET /users/:id` |
| `method` | `method` | string | HTTP method or logical verb, e.g. `GET`, `POST`, `OTEL` |
| `statusCode` | `status_code` | number | HTTP status or synthetic code (500 on unhandled errors) |
| `latencyMs` | `latency_ms` | number | Duration in milliseconds |

## Timestamps and sizing

| Field | Ingest JSON | Description |
|-------|-------------|-------------|
| `timestamp` | `timestamp` | Unix seconds; defaults to now if omitted |
| `requestSizeBytes` | `request_size_bytes` | Request body size if known |
| `responseSizeBytes` | `response_size_bytes` | Response body size if known |

## Provider and AI

| Field | Ingest JSON | Description |
|-------|-------------|-------------|
| `provider` | `provider` | Provider slug, e.g. `openai`, `stripe`, `clerk` (auto-detected from URL hints when possible) |
| `providerCategory` | `provider_category` | Category from detection, e.g. `ai`, `payments` |
| `modelName` | `model_name` | LLM model id when applicable |
| `tokensInput` | `tokens_input` | Input tokens |
| `tokensOutput` | `tokens_output` | Output tokens |
| `totalTokens` | `total_tokens` | Total tokens (Node); Python computes from in+out |
| `streamingLatencyMs` | `streaming_latency_ms` | Time to complete stream |
| `firstTokenLatencyMs` | `first_token_latency_ms` | Time to first token (TTFT) |
| `cacheHit` | `cache_hit` | Prompt cache hit |
| `costUsd` | `cost_usd` | Estimated cost in USD |

## Tracing

| Field | Ingest JSON | Description |
|-------|-------------|-------------|
| `traceId` | `trace_id` | Distributed trace id (32 hex chars) |
| `spanId` | `span_id` | Span id (16 hex chars) |
| `parentSpanId` | `parent_span_id` | Parent span id |
| `sessionId` | `session_id` | User session |
| `userId` | `user_id` | User id |
| `serviceName` | `service_name` | Logical service, e.g. `api`, `nextjs` |
| `operationName` | `operation_name` | Operation within service, often normalized path |
| `environment` | `environment` | e.g. `production` |
| `releaseVersion` | `release_version` | Deploy version / git SHA |

## Errors and metadata

| Field | Ingest JSON | Description |
|-------|-------------|-------------|
| `errorMessage` | `error_message` | Error text for 4xx/5xx or exceptions |
| `metadata` | `metadata` | Arbitrary JSON object (avoid secrets; scrub PII) |
| `retryCount` | `retry_count` | Retry attempt count |
| `isWebhook` | `is_webhook` | `true` if event is an inbound webhook handler |

## Path normalization

HTTP middleware normalizes dynamic segments so metrics group correctly:

- UUIDs → `/:id`
- Numeric segments → `/:id`

Example: `GET /users/42/orders/9` → `GET /users/:id/orders/:id`

## Provider auto-detection

SDKs infer provider from hostname/path hints (OpenAI, Anthropic, Stripe, etc.). Override with explicit `provider` on `track()` when needed.

## PII and secrets

Do not put passwords, API keys, or raw emails in `metadata`. Use `@amlexiahq/shared` scrubbers in custom pipelines if you preprocess metadata in Node.
