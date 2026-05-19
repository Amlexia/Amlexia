from __future__ import annotations

import argparse
import json
import sys

from .health import check_ingest_health

__version__ = "1.0.2"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="amlexia")
    parser.add_argument("command", nargs="?", default="health", choices=["health", "version"])
    parser.add_argument("--ingest-url", default=None)
    args = parser.parse_args(argv)

    if args.command == "version":
        print(__version__)
        return 0

    import os

    ingest = args.ingest_url or os.environ.get("AMLEXIA_INGEST_URL", "https://ingest.amlexia.com")
    result = check_ingest_health(ingest)
    print(json.dumps({"ingestUrl": ingest, **result}, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
