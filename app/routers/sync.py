from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
from typing import Dict, Any
from datetime import datetime

from app.db import get_session
from app.config import settings
from app.services.mailbox_sync import sync_mailbox

router = APIRouter(prefix="/api/sync", tags=["Sync"])

# In-memory last sync cache
last_sync_info = {
    "last_synced_at": None,
    "last_stats": None,
    "is_syncing": False,
    "last_error": None
}

@router.get("/status")
def get_sync_status():
    return {
        "gmail_configured": bool(settings.GMAIL_APP_PASSWORD and settings.GMAIL_USER),
        "gmail_user": settings.GMAIL_USER,
        "last_synced_at": last_sync_info["last_synced_at"],
        "last_stats": last_sync_info["last_stats"],
        "is_syncing": last_sync_info["is_syncing"],
        "last_error": last_sync_info["last_error"]
    }

@router.post("/mailbox")
def trigger_mailbox_sync(session: Session = Depends(get_session), limit: int = 150):
    if not settings.GMAIL_APP_PASSWORD:
        raise HTTPException(status_code=400, detail="GMAIL_APP_PASSWORD is not set in .env")

    last_sync_info["is_syncing"] = True
    last_sync_info["last_error"] = None
    try:
        stats = sync_mailbox(session=session, max_messages=limit)
        last_sync_info["last_synced_at"] = datetime.utcnow().isoformat()
        last_sync_info["last_stats"] = stats
        return {
            "ok": True,
            "message": "Mailbox synced successfully",
            "stats": stats
        }
    except Exception as e:
        last_sync_info["last_error"] = str(e)
        raise HTTPException(status_code=500, detail=f"Mailbox sync error: {str(e)}")
    finally:
        last_sync_info["is_syncing"] = False
