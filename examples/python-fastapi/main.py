"""Amlexia FastAPI example — run with: uvicorn main:app --reload --port 3457"""
import os
import time

from fastapi import FastAPI, Request
from amlexia import AmlexiaClient
from amlexia.fastapi_integration import AmlexiaMiddleware

client = AmlexiaClient(
    sdk_key=os.environ.get("AMLEXIA_SDK_KEY", ""),
)

app = FastAPI(title="Amlexia Example API")
app.add_middleware(AmlexiaMiddleware, client=client)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    return {"id": user_id, "name": "Jane Doe"}


@app.middleware("http")
async def slow_request_simulation(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    return response
