"""Opaque cursor encoding for keyset pagination.

Cursors are base64-encoded JSON of `{ "k": <key>, "i": <uuid> }` where the
key is the value of the sort column at the boundary and `i` is the row's
UUID (tiebreaker). Server-side validation only — clients treat them opaque.
"""

from __future__ import annotations

import base64
import json
from datetime import date, datetime
from typing import Any
from uuid import UUID


def encode_cursor(key: Any, row_id: UUID | str) -> str:
    if isinstance(key, datetime):
        key_str: Any = key.isoformat()
    elif isinstance(key, date):
        key_str = key.isoformat()
    else:
        key_str = key
    payload = json.dumps({"k": key_str, "i": str(row_id)}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[Any, UUID]:
    """Returns (key, id). Raises ValueError on malformed input."""
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        return payload["k"], UUID(payload["i"])
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid cursor: {exc}") from exc
