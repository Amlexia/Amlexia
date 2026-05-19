# AI setup prompts

Copy a prompt below into **ChatGPT, Claude, Copilot, or any coding agent** to integrate Amlexia into your project. Each prompt includes official package names, environment variables, and acceptance criteria.

**Before you start**

1. Create a project at [app.amlexia.com](https://app.amlexia.com) and copy your SDK key (`am_...`).
2. Never put `AMLEXIA_SDK_KEY` in frontend code, public repos, or client bundles.
3. Production ingest URL: `https://ingest.amlexia.com`

| Resource | Link |
|----------|------|
| Node.js SDK | [sdks/node/README.md](../sdks/node/README.md) |
| Python SDK | [sdks/python/README.md](../sdks/python/README.md) |
| Environment variables | [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) |
| Event fields | [EVENT_FIELDS.md](./EVENT_FIELDS.md) |
| GitHub | https://github.com/Amlexia/Amlexia |

---

## Universal prompt (any stack)

Use this if you want the AI to pick the right integration for your codebase.

```text
You are integrating Amlexia observability into my application.

## Product
Amlexia monitors HTTP APIs, AI provider calls (OpenAI, Anthropic, etc.), payments, and external dependencies. Data is sent to the Amlexia ingest API and viewed at https://app.amlexia.com.

## Official packages (use exactly these)
- Node.js: npm install @amlexiahq/node
- Python: pip install amlexia

## Required configuration
- AMLEXIA_SDK_KEY — project SDK key from app.amlexia.com (server-side only)
- AMLEXIA_INGEST_URL — optional, default https://ingest.amlexia.com
- AMLEXIA_ENVIRONMENT — optional, e.g. production, staging
- AMLEXIA_RELEASE — optional, app version or git SHA

## Security rules
- Do NOT put AMLEXIA_SDK_KEY in browser, mobile client, or public env files committed to git.
- Instrument backend / server only unless I explicitly have a trusted BFF.
- Add AMLEXIA_SDK_KEY to .env.example as a placeholder without a real value.

## Your tasks
1. Detect my language and framework (Express, Fastify, Hono, Next.js, FastAPI, Flask, Django, or none).
2. Install the correct package and wire automatic HTTP tracking OR manual track() for background jobs.
3. Create or update .env.example with AMLEXIA_* variables documented.
4. On process shutdown (SIGTERM/SIGINT or framework lifecycle), call client.shutdown() to flush events.
5. For outbound calls to OpenAI/Stripe/etc., include provider, tokens, and latency in track() when applicable.

## Node.js framework imports
- Express: import { AmlexiaMiddleware } from '@amlexiahq/node/express'
- Fastify: import { amlexiaPlugin } from '@amlexiahq/node/fastify'
- Hono: import { amlexiaHonoMiddleware } from '@amlexiahq/node/hono'
- Next.js App Router: import { withAmlexia } from '@amlexiahq/node/next'

## Python framework imports
- FastAPI: from amlexia.fastapi_integration import AmlexiaMiddleware
- Flask: from amlexia.flask_integration import amlexia_track
- Django: amlexia.django_integration.AmlexiaMiddleware in MIDDLEWARE

## Acceptance criteria
- [ ] SDK key read from environment only
- [ ] Ingest URL defaults to https://ingest.amlexia.com in production
- [ ] HTTP routes are tracked with normalized paths (/:id not raw IDs)
- [ ] Graceful shutdown flushes the client
- [ ] Brief README section: "Observability (Amlexia)" with setup steps

## My project
[PASTE: framework, folder structure, entry file paths, and whether you use TypeScript or Python]

Now implement the integration. Show me every file you change and why.
```

---

## Node.js — manual / generic

```text
Integrate Amlexia into my Node.js app without a web framework (or for custom background jobs).

Install: npm install @amlexiahq/node

Use:
import { AmlexiaClient } from '@amlexiahq/node';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
  flushIntervalMs: 5000,
  maxBatchSize: 50,
});

// After each operation:
await client.track({
  endpoint: 'POST /v1/chat',
  method: 'POST',
  statusCode: 200,
  latencyMs: 320,
  provider: 'openai',
  tokensInput: 100,
  tokensOutput: 50,
});

// On shutdown:
process.on('SIGTERM', () => void client.shutdown());
process.on('SIGINT', () => void client.shutdown());

Requirements:
- Singleton client per process
- .env.example with AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_RELEASE
- Never expose SDK key to the client bundle

My project:
[PASTE your entry file and where external API calls happen]
```

---

## Node.js — Express

```text
Integrate Amlexia into my Express.js API.

Install:
npm install @amlexiahq/node express

Code pattern:
import { AmlexiaClient } from '@amlexiahq/node';
import { AmlexiaMiddleware } from '@amlexiahq/node/express';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

const app = express();
app.use(AmlexiaMiddleware(client, { serviceName: 'api' }));

// Optional: pass user context via headers x-session-id and x-user-id

On SIGTERM/SIGINT: await client.shutdown()

Tasks:
1. Add middleware early in the stack (after body parsers if needed).
2. Do not double-log routes that already have middleware.
3. Update .env.example.
4. Document in README.

My app.ts / server.js path:
[PASTE file path and existing middleware order]
```

---

## Node.js — Fastify

```text
Integrate Amlexia into my Fastify server.

Install:
npm install @amlexiahq/node fastify

Code pattern:
import { AmlexiaClient } from '@amlexiahq/node';
import { amlexiaPlugin } from '@amlexiahq/node/fastify';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

await fastify.register(amlexiaPlugin(client, { serviceName: 'api' }));

Register the plugin before routes. Call client.shutdown() on server close.

My server file:
[PASTE path to fastify bootstrap]
```

---

## Node.js — Hono

```text
Integrate Amlexia into my Hono application (Cloudflare Workers or Node).

Install:
npm install @amlexiahq/node hono

Code pattern:
import { Hono } from 'hono';
import { AmlexiaClient } from '@amlexiahq/node';
import { amlexiaHonoMiddleware } from '@amlexiahq/node/hono';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

const app = new Hono();
app.use('*', amlexiaHonoMiddleware(client, { serviceName: 'api' }));

Note: On Workers, ensure AMLEXIA_SDK_KEY is a secret binding, not public. Flush on idle/shutdown if applicable.

My app file:
[PASTE Hono entry]
```

---

## Node.js — Next.js (App Router)

```text
Integrate Amlexia into my Next.js App Router API routes.

Install:
npm install @amlexiahq/node

Only instrument Route Handlers (app/api/**/route.ts) — NOT client components.

Pattern:
import { AmlexiaClient } from '@amlexiahq/node';
import { withAmlexia } from '@amlexiahq/node/next';

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY!,
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'https://ingest.amlexia.com',
});

export const GET = withAmlexia(
  client,
  async (request) => {
    return Response.json({ ok: true });
  },
  { route: '/api/hello', serviceName: 'nextjs' },
);

Rules:
- AMLEXIA_SDK_KEY only in server env (no NEXT_PUBLIC_)
- Use static route patterns in { route: '...' } for cardinality control
- For Server Actions calling external APIs, use manual client.track() instead

Routes to instrument:
[PASTE list of route.ts paths]
```

---

## Node.js — OpenTelemetry bridge

```text
I already export OpenTelemetry spans. Bridge them to Amlexia.

Install: npm install @amlexiahq/node

import { AmlexiaClient } from '@amlexiahq/node';
import { exportOtelSpans, type OtelSpanInput } from '@amlexiahq/node/otel';

const client = new AmlexiaClient({ sdkKey: process.env.AMLEXIA_SDK_KEY! });

// When you have OTEL spans:
exportOtelSpans(client, spans as OtelSpanInput[]);

Wire this into my existing OTEL exporter or batch processor. Do not duplicate HTTP middleware if spans already capture requests.

My OTEL setup:
[PASTE how spans are produced]
```

---

## Python — manual / scripts

```text
Integrate Amlexia into my Python application (no web framework).

Install: pip install amlexia

from amlexia import AmlexiaClient

client = AmlexiaClient.from_env()
# or AmlexiaClient(sdk_key=os.environ["AMLEXIA_SDK_KEY"], ingest_url="https://ingest.amlexia.com")

client.track(
    endpoint="POST /v1/chat",
    method="POST",
    status_code=200,
    latency_ms=320,
    provider="openai",
    tokens_input=100,
    tokens_output=50,
)

client.shutdown()

Environment: AMLEXIA_SDK_KEY, AMLEXIA_INGEST_URL, AMLEXIA_ENVIRONMENT, AMLEXIA_RELEASE

My script structure:
[PASTE modules and where HTTP calls occur]
```

---

## Python — FastAPI

```text
Integrate Amlexia into my FastAPI application.

Install: pip install "amlexia[fastapi]"

from amlexia import AmlexiaClient
from amlexia.fastapi_integration import AmlexiaMiddleware

client = AmlexiaClient.from_env()
app = FastAPI()
app.add_middleware(AmlexiaMiddleware, client=client, service_name="api")

Middleware tracks all routes, sets traceparent header, normalizes paths.

Use headers x-session-id and x-user-id for session/user on events.

On shutdown (lifespan): client.shutdown()

My main.py:
[PASTE FastAPI app factory or main module]
```

---

## Python — Flask

```text
Integrate Amlexia into my Flask application.

Install: pip install "amlexia[flask]"

from amlexia import AmlexiaClient
from amlexia.flask_integration import amlexia_track

client = AmlexiaClient.from_env()

@app.get("/users/<int:user_id>")
@amlexia_track(client)
def get_user(user_id):
    return {"id": user_id}

Apply @amlexia_track(client) to routes that should be monitored. For app-wide coverage, list which routes need the decorator.

client.shutdown() on app teardown.

My app.py:
[PASTE Flask app]
```

---

## Python — Django

```text
Integrate Amlexia into my Django project.

Install: pip install amlexia

settings.py — add after SecurityMiddleware:
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "amlexia.django_integration.AmlexiaMiddleware",
    ...
]

Environment:
AMLEXIA_SDK_KEY=am_...
AMLEXIA_INGEST_URL=https://ingest.amlexia.com  # optional
AMLEXIA_SERVICE_NAME=api  # optional

Optional headers: X-Session-Id, X-User-Id (HTTP_X_SESSION_ID in META).

Do not commit real keys. Update .env.example.

My settings path:
[PASTE path to settings.py and current MIDDLEWARE]
```

---

## Prompt — track OpenAI / LLM calls

```text
Add manual Amlexia tracking for OpenAI (or Anthropic) API calls in my backend.

After each LLM request, call track with:
- endpoint: operation name e.g. POST /v1/chat/completions
- method: POST
- status_code: from response or 500 on error
- latency_ms: wall clock
- provider: openai (or anthropic)
- model_name: model id
- tokens_input, tokens_output from usage if available
- first_token_latency_ms for streaming if applicable
- error_message on failure

Node: AmlexiaClient from @amlexiahq/node
Python: AmlexiaClient from amlexia

Do not log API keys or raw prompts with PII in metadata.

My LLM client code:
[PASTE the file where you call the LLM]
```

---

## Prompt — verify integration

```text
Review my Amlexia integration for production readiness.

Checklist:
1. AMLEXIA_SDK_KEY only server-side
2. ingest URL https://ingest.amlexia.com in prod (not localhost)
3. client.shutdown() on graceful shutdown
4. No SDK key in git history or .env committed
5. HTTP paths normalized (middleware or manual)
6. Provider/token fields on AI/payment outbound calls
7. .env.example documents all AMLEXIA_* vars

Repo paths to review:
[PASTE paths or paste relevant files]

Output: pass/fail per item and exact code fixes.
```

---

## Tips for best results

1. **Paste real file paths** in the `[PASTE ...]` sections so the AI edits the right files.
2. **Paste your middleware order** for Express/Fastify/Django to avoid wrong placement.
3. **Say “server only”** for Next.js so keys are not exposed to the browser.
4. After setup, open [app.amlexia.com](https://app.amlexia.com) and confirm events within ~30 seconds.

**Support:** support@amlexia.com
