"""
tools/request_state.py
──────────────────────
Per-request state seeding for Rex's tools.

The SDK's ``Conversation`` has no ``set_state`` -- state lives on the
``ToolContext`` handed to tools and can only be written from inside a tool.
So the endpoint seeds a registry keyed by conversation_id (known once the
agent has started) and tools read through ``get`` below, which prefers any
value the tools wrote to ToolContext during the session.
"""
from __future__ import annotations

import threading
from typing import Any

_MISSING = object()
_LOCK = threading.Lock()
_REGISTRY: dict[str, dict[str, Any]] = {}


def seed(conversation_id: str, **values: Any) -> None:
    with _LOCK:
        _REGISTRY.setdefault(conversation_id, {}).update(values)


def clear(conversation_id: str) -> None:
    with _LOCK:
        _REGISTRY.pop(conversation_id, None)


def get(ctx: Any, key: str, default: Any = None) -> Any:
    value = ctx.get_state(key, _MISSING)
    if value is not _MISSING:
        return value
    with _LOCK:
        return _REGISTRY.get(ctx.conversation_id, {}).get(key, default)
