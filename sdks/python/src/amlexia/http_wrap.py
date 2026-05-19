from __future__ import annotations

import time
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from .client import AmlexiaClient


def _provider_from_url(url: str) -> Optional[str]:
    try:
        host = urlparse(url).hostname or ""
        if "openai" in host:
            return "openai"
        if "anthropic" in host:
            return "anthropic"
        if "stripe" in host:
            return "stripe"
    except Exception:
        pass
    return None


def wrap_requests_session(client: AmlexiaClient, session: Any) -> Any:
    """Wrap requests.Session.request to auto-track outbound HTTP."""
    original = session.request

    def request(method: str, url: str, *args: Any, **kwargs: Any) -> Any:
        start = time.time()
        status = 500
        err: Optional[str] = None
        try:
            res = original(method, url, *args, **kwargs)
            status = res.status_code
            return res
        except Exception as exc:
            err = str(exc)
            raise
        finally:
            client.track(
                endpoint=url,
                method=method.upper(),
                status_code=status,
                latency_ms=int((time.time() - start) * 1000),
                provider=_provider_from_url(url),
                error_message=err,
            )

    session.request = request  # type: ignore[method-assign]
    return session


def wrap_urllib_opener(client: AmlexiaClient, opener: Any) -> Any:
    original_open = opener.open

    def open(url: str, data: Any = None, timeout: Any = None) -> Any:
        start = time.time()
        status = 500
        err: Optional[str] = None
        try:
            res = original_open(url, data=data, timeout=timeout)
            status = getattr(res, "status", 200)
            return res
        except Exception as exc:
            err = str(exc)
            raise
        finally:
            client.track(
                endpoint=str(url),
                method="GET" if data is None else "POST",
                status_code=status,
                latency_ms=int((time.time() - start) * 1000),
                provider=_provider_from_url(str(url)),
                error_message=err,
            )

    opener.open = open  # type: ignore[method-assign]
    return opener


def track_http_call(
    client: AmlexiaClient,
    *,
    endpoint: str,
    method: str,
    status_code: int,
    latency_ms: int,
    provider: Optional[str] = None,
    **kwargs: Any,
) -> None:
    client.track(
        endpoint=endpoint,
        method=method,
        status_code=status_code,
        latency_ms=latency_ms,
        provider=provider,
        **kwargs,
    )
