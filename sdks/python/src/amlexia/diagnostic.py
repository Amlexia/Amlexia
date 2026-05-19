from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class DiagnosticState:
    enabled: bool = False
    events_buffered: int = 0
    last_flush_at: Optional[int] = None
    last_error: Optional[str] = None
