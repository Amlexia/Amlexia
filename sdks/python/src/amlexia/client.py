from __future__ import annotations

import json
import threading
import time
from typing import Any, Dict, List, Optional
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from .cost import enrich_event_cost
from .diagnostic import DiagnosticState
from .providers import detect_provider
from .sampling import should_sample

DEFAULT_INGEST_URL = "https://ingest.amlexia.com"
DEFAULT_FLUSH_SECONDS = 5
DEFAULT_BATCH_SIZE = 50
DEFAULT_MAX_RETRIES = 5


class AmlexiaClient:
    def __init__(
        self,
        sdk_key: str,
        ingest_url: Optional[str] = None,
        flush_interval_seconds: float = DEFAULT_FLUSH_SECONDS,
        max_batch_size: int = DEFAULT_BATCH_SIZE,
        max_retries: int = DEFAULT_MAX_RETRIES,
        environment: Optional[str] = None,
        release_version: Optional[str] = None,
        sample_rate: float = 1.0,
        diagnostic: bool = False,
    ) -> None:
        self._sdk_key = sdk_key
        self._ingest_url = (ingest_url or DEFAULT_INGEST_URL).rstrip("/")
        self._flush_interval = flush_interval_seconds
        self._max_batch_size = max_batch_size
        self._max_retries = max_retries
        self._environment = environment
        self._release_version = release_version
        self._sample_rate = sample_rate
        self.diagnostic = DiagnosticState(enabled=diagnostic)
        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._flushing = False
        self._stop = threading.Event()
        self._timer = threading.Timer(self._flush_interval, self._flush_loop)
        self._timer.daemon = True
        self._timer.start()

    @classmethod
    def from_env(cls) -> AmlexiaClient:
        import os

        sdk_key = os.environ.get("AMLEXIA_SDK_KEY")
        if not sdk_key:
            raise ValueError("AMLEXIA_SDK_KEY environment variable is required")
        return cls(
            sdk_key=sdk_key,
            ingest_url=os.environ.get("AMLEXIA_INGEST_URL"),
            environment=os.environ.get("AMLEXIA_ENVIRONMENT"),
            release_version=os.environ.get("AMLEXIA_RELEASE"),
        )

    def track(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        latency_ms: int,
        timestamp: Optional[int] = None,
        request_size_bytes: Optional[int] = None,
        response_size_bytes: Optional[int] = None,
        cost_usd: Optional[float] = None,
        provider: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        service_name: Optional[str] = None,
        operation_name: Optional[str] = None,
        model_name: Optional[str] = None,
        tokens_input: Optional[int] = None,
        tokens_output: Optional[int] = None,
        streaming_latency_ms: Optional[int] = None,
        first_token_latency_ms: Optional[int] = None,
        cache_hit: Optional[bool] = None,
        retry_count: Optional[int] = None,
        is_webhook: Optional[bool] = None,
    ) -> None:
        if not should_sample(self._sample_rate):
            return
        detected = detect_provider(provider=provider, endpoint=endpoint, metadata=metadata)
        event = enrich_event_cost({
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "timestamp": timestamp or int(time.time()),
            "request_size_bytes": request_size_bytes,
            "response_size_bytes": response_size_bytes,
            "cost_usd": cost_usd,
            "provider": provider or (detected["name"] if detected["name"] != "unknown" else None),
            "error_message": error_message,
            "metadata": metadata or {},
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": parent_span_id,
            "session_id": session_id,
            "user_id": user_id,
            "environment": self._environment,
            "release_version": self._release_version,
            "service_name": service_name,
            "operation_name": operation_name,
            "provider_category": detected["category"],
            "provider_name": detected["name"],
            "model_name": model_name or detected.get("model_name"),
            "tokens_input": tokens_input,
            "tokens_output": tokens_output,
            "total_tokens": (tokens_input or 0) + (tokens_output or 0) if tokens_input or tokens_output else None,
            "streaming_latency_ms": streaming_latency_ms,
            "first_token_latency_ms": first_token_latency_ms,
            "cache_hit": cache_hit,
            "retry_count": retry_count or 0,
            "is_webhook": is_webhook or False,
        })
        with self._lock:
            self._buffer.append(event)
            should_flush = len(self._buffer) >= self._max_batch_size
        if should_flush:
            self.flush()

    def get_diagnostic_snapshot(self) -> DiagnosticState:
        with self._lock:
            self.diagnostic.events_buffered = len(self._buffer)
        return DiagnosticState(
            enabled=self.diagnostic.enabled,
            events_buffered=self.diagnostic.events_buffered,
            last_flush_at=self.diagnostic.last_flush_at,
            last_error=self.diagnostic.last_error,
        )

    def flush(self) -> None:
        with self._lock:
            if self._flushing or not self._buffer:
                return
            self._flushing = True
            events = self._buffer[: self._max_batch_size]
            del self._buffer[: self._max_batch_size]

        payload = {"sdk_key": self._sdk_key, "events": events}
        try:
            self._send_with_retry(payload)
            self.diagnostic.last_flush_at = int(time.time() * 1000)
            self.diagnostic.last_error = None
            if self.diagnostic.enabled:
                print(f"[amlexia] flushed {len(events)} events", file=__import__("sys").stderr)
        except Exception as exc:
            self.diagnostic.last_error = str(exc)
            if self.diagnostic.enabled:
                print(f"[amlexia] flush failed: {exc}", file=__import__("sys").stderr)
            with self._lock:
                self._buffer = events + self._buffer
            raise
        finally:
            with self._lock:
                self._flushing = False

    def shutdown(self) -> None:
        self._stop.set()
        self._timer.cancel()
        while True:
            with self._lock:
                if not self._buffer:
                    break
            self.flush()

    def _flush_loop(self) -> None:
        if not self._stop.is_set():
            try:
                self.flush()
            except Exception:
                pass
            self._timer = threading.Timer(self._flush_interval, self._flush_loop)
            self._timer.daemon = True
            self._timer.start()

    def _send_with_retry(self, payload: Dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        url = f"{self._ingest_url}/v1/events"
        attempt = 0
        while attempt < self._max_retries:
            try:
                req = urllib_request.Request(
                    url,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib_request.urlopen(req, timeout=30) as resp:
                    if 200 <= resp.status < 300:
                        return
            except HTTPError as e:
                if e.code == 401:
                    raise ValueError("Invalid SDK key") from e
                if e.code == 402:
                    raise RuntimeError("Monthly usage limit exceeded") from e
                if 400 <= e.code < 500:
                    raise RuntimeError(f"Ingestion failed: {e.code}") from e
            except URLError:
                pass
            delay = min(1000 * (2**attempt), 30000) / 1000
            time.sleep(delay)
            attempt += 1
        raise RuntimeError("Failed to send events after retries")
