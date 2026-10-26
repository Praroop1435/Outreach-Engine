import time
import os
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func, text
from typing import Dict, Any

from app.db import get_session, engine
from app.config import settings
from app.models import Lead, EmailMessage, LinkClick
from app.cache import app_cache

router = APIRouter(prefix="/api/system", tags=["System"])

@router.get("/health")
def get_system_health(session: Session = Depends(get_session)) -> Dict[str, Any]:
    # 1. Measure DB Latency to Neon PostgreSQL
    t0 = time.time()
    db_ok = True
    db_error = None
    try:
        session.exec(text("SELECT 1")).one()
    except Exception as e:
        db_ok = False
        db_error = str(e)
    db_latency_ms = round((time.time() - t0) * 1000, 2)

    # 2. Counts
    total_leads = session.exec(select(func.count(Lead.id))).one() or 0
    total_msgs = session.exec(select(func.count(EmailMessage.id))).one() or 0
    total_clicks = session.exec(select(func.count(LinkClick.id))).one() or 0

    # 3. Resume Status
    resume_path = settings.RESUME_PATH
    if not os.path.isabs(resume_path):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        resume_path = os.path.join(base_dir, resume_path)
    resume_exists = os.path.exists(resume_path)
    resume_size_kb = round(os.path.getsize(resume_path) / 1024, 1) if resume_exists else 0

    # 4. Gmail Credentials Status
    gmail_configured = bool(settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD)

    return {
        "status": "ok" if db_ok else "degraded",
        "database": {
            "connected": db_ok,
            "latency_ms": db_latency_ms,
            "error": db_error,
            "provider": "Neon PostgreSQL (Singapore)" if "neon.tech" in settings.DATABASE_URL else "SQLite"
        },
        "stats": {
            "total_leads": total_leads,
            "total_messages": total_msgs,
            "total_clicks": total_clicks,
            "cache_keys_cached": len(app_cache._cache)
        },
        "integrations": {
            "gmail_user": settings.GMAIL_USER,
            "gmail_configured": gmail_configured,
            "smtp_server": f"{settings.SMTP_HOST}:{settings.SMTP_PORT}",
            "imap_server": f"{settings.IMAP_HOST}:{settings.IMAP_PORT}"
        },
        "resume": {
            "exists": resume_exists,
            "filename": os.path.basename(resume_path),
            "size_kb": resume_size_kb,
            "path": resume_path
        }
    }

@router.post("/cache/clear")
def clear_cache() -> Dict[str, Any]:
    app_cache.invalidate()
    return {"ok": True, "message": "Backend in-memory cache flushed"}
