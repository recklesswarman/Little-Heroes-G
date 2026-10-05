"""
persistence/firestore_store.py
──────────────────────────────
Loads and saves each child's AGY conversation_id from/to Firestore.

Firestore path per hero:
  households/{householdId}/heroes/{heroId}/rexAgent/state
    {
      conversationId: "abc-123",
      lastActive: Timestamp,
      totalTurns: 42
    }

If no householdId is known (anonymous / offline), falls back to a local
JSON file at {save_dir_base}/{heroId}/conversation_id.txt so the app
still works without Firestore connectivity.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore

# ── Firebase Admin initialisation (idempotent) ─────────────────────────────
_admin_initialised = False


def _ensure_firebase():
    global _admin_initialised
    if _admin_initialised:
        return
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and Path(cred_path).exists():
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        # Cloud Run / GCE: use Application Default Credentials
        firebase_admin.initialize_app()
    _admin_initialised = True


# ── Public API ──────────────────────────────────────────────────────────────

def load_conversation_id(
    hero_id: str,
    household_id: Optional[str],
    save_dir_base: str,
) -> Optional[str]:
    """Return the persisted AGY conversation_id for this hero, or None."""
    # 1. Try Firestore first
    try:
        _ensure_firebase()
        db = firestore.client()
        if household_id:
            doc = (
                db.collection("households")
                .document(household_id)
                .collection("heroes")
                .document(hero_id)
                .collection("rexAgent")
                .document("state")
                .get()
            )
        else:
            doc = (
                db.collection("heroes")
                .document(hero_id)
                .collection("rexAgent")
                .document("state")
                .get()
            )
        if doc.exists:
            data = doc.to_dict()
            return data.get("conversationId")
    except Exception as exc:
        print(f"[persistence] Firestore read failed, using local fallback: {exc}")

    # 2. Local file fallback
    local_path = Path(save_dir_base) / hero_id / "conversation_id.txt"
    if local_path.exists():
        return local_path.read_text().strip() or None

    return None


def save_conversation_id(
    hero_id: str,
    household_id: Optional[str],
    conversation_id: str,
    save_dir_base: str,
    total_turns: int = 0,
) -> None:
    """Persist the AGY conversation_id for this hero."""
    # 1. Firestore
    try:
        _ensure_firebase()
        db = firestore.client()
        if household_id:
            doc_ref = (
                db.collection("households")
                .document(household_id)
                .collection("heroes")
                .document(hero_id)
                .collection("rexAgent")
                .document("state")
            )
        else:
            doc_ref = (
                db.collection("heroes")
                .document(hero_id)
                .collection("rexAgent")
                .document("state")
            )
        doc_ref.set(
            {
                "conversationId": conversation_id,
                "lastActive": datetime.now(timezone.utc),
                "totalTurns": total_turns,
            },
            merge=True,
        )
    except Exception as exc:
        print(f"[persistence] Firestore write failed, using local fallback: {exc}")

    # 2. Local file fallback (always write for offline support)
    local_dir = Path(save_dir_base) / hero_id
    local_dir.mkdir(parents=True, exist_ok=True)
    (local_dir / "conversation_id.txt").write_text(conversation_id)


def load_rex_memory(
    hero_id: str,
    household_id: Optional[str],
) -> dict:
    """Load all long-term Rex facts for this hero from Firestore."""
    try:
        _ensure_firebase()
        db = firestore.client()
        if household_id:
            docs = (
                db.collection("households")
                .document(household_id)
                .collection("heroes")
                .document(hero_id)
                .collection("rexMemory")
                .stream()
            )
        else:
            docs = (
                db.collection("heroes")
                .document(hero_id)
                .collection("rexMemory")
                .stream()
            )
        return {doc.id: doc.to_dict().get("value", "") for doc in docs}
    except Exception as exc:
        print(f"[persistence] Rex memory read failed: {exc}")
        local_path = Path(os.environ.get("AGY_SAVE_DIR", "/tmp/agents")) / hero_id / "rex_memory.json"
        if local_path.exists():
            try:
                return json.loads(local_path.read_text())
            except Exception:
                pass
        return {}


def save_rex_fact(
    hero_id: str,
    household_id: Optional[str],
    key: str,
    value: str,
) -> None:
    """Store a single long-term Rex fact for this hero in Firestore."""
    try:
        _ensure_firebase()
        db = firestore.client()
        if household_id:
            doc_ref = (
                db.collection("households")
                .document(household_id)
                .collection("heroes")
                .document(hero_id)
                .collection("rexMemory")
                .document(key)
            )
        else:
            doc_ref = (
                db.collection("heroes")
                .document(hero_id)
                .collection("rexMemory")
                .document(key)
            )
        doc_ref.set({"value": value, "updatedAt": datetime.now(timezone.utc)}, merge=True)
    except Exception as exc:
        print(f"[persistence] Rex fact save failed: {exc}")

    # Local file fallback (offline / demo resilience)
    try:
        local_dir = Path(os.environ.get("AGY_SAVE_DIR", "/tmp/agents")) / hero_id
        local_dir.mkdir(parents=True, exist_ok=True)
        local_file = local_dir / "rex_memory.json"
        mem = {}
        if local_file.exists():
            try:
                mem = json.loads(local_file.read_text())
            except Exception:
                pass
        mem[key] = value
        local_file.write_text(json.dumps(mem))
    except Exception as exc:
        print(f"[persistence] Local memory write failed: {exc}")
