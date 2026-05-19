# Examples

Runnable samples for Amlexia SDKs. Get an SDK key from [app.amlexia.com](https://app.amlexia.com).

## Prerequisites

```bash
export AMLEXIA_SDK_KEY=am_your_key_here
export AMLEXIA_INGEST_URL=https://ingest.amlexia.com   # optional
```

---

## Node.js — Express

**Path:** `node-express/`

```bash
cd node-express
pnpm install   # from repo root: pnpm install
pnpm start
```

Hit `http://localhost:3000/` — middleware tracks each request automatically.

**What it demonstrates**

- `AmlexiaClient` singleton
- `AmlexiaMiddleware` from `@amlexiahq/node/express`
- Path normalization and `traceparent` header

---

## Python — FastAPI

**Path:** `python-fastapi/`

```bash
cd python-fastapi
pip install -r requirements.txt
uvicorn main:app --port 3457 --reload
```

Open `http://localhost:3457/health`.

**What it demonstrates**

- `AmlexiaClient.from_env()`
- `AmlexiaMiddleware` on FastAPI

---

## Verify in dashboard

1. Open [app.amlexia.com](https://app.amlexia.com)
2. Select your project
3. Check **Live** or **Overview** for new events within ~30 seconds

---

## Next steps

- [Getting started](../docs/GETTING_STARTED.md)
- [Node.js SDK](../sdks/node/README.md)
- [Python SDK](../sdks/python/README.md)

Support: support@amlexia.com
