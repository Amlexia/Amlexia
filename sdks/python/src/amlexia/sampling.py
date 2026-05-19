from __future__ import annotations

import random


def should_sample(rate: float) -> bool:
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False
    return random.random() < rate
