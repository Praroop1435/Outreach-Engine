from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.db import get_session
from app.models import Lead, SendXDMRequest, EmailMessage, LeadStatus, EmailDirection, MessageChannel
from app.services.x_browser_automation import (
    get_browser_session_status,
    save_cookies_as_session,
    send_x_dm_browser,
    clean_x_handle
)
from app.services.email_sender import render_template

router = APIRouter(prefix="/api/auth/x", tags=["X Browser Automation"])

class SaveCookiesRequest(BaseModel):
    auth_token: str
    ct0: str

@router.get("/status")
def x_status():
    browser_status = get_browser_session_status()
    return {
        "connected": browser_status.get("has_session", False),
        "username": browser_status.get("username"),
        "browser_automation": browser_status
    }

@router.get("/browser-session")
def get_browser_session():
    return get_browser_session_status()

@router.post("/save-cookies")
def save_browser_cookies(req: SaveCookiesRequest):
    if not req.auth_token or not req.ct0:
        raise HTTPException(status_code=400, detail="Both auth_token and ct0 cookies are required.")
    return save_cookies_as_session(req.auth_token, req.ct0)

@router.post("/leads/{lead_id}/send-dm")
def send_dm_to_lead(lead_id: int, req: SendXDMRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    target_handle = req.x_handle or lead.x_handle
    if not target_handle:
        raise HTTPException(status_code=400, detail="No X handle provided for this lead.")
    
    clean_handle = clean_x_handle(target_handle)
    rendered_message = render_template(req.message, lead)

    # Check if Browser Automation session is available
    browser_status = get_browser_session_status()
    if not browser_status.get("has_session"):
        raise HTTPException(
            status_code=400,
            detail="No X browser session configured. Please click 'Setup X Cookies' in the dashboard header and paste your auth_token & ct0 cookies."
        )

    try:
        res = send_x_dm_browser(clean_handle, rendered_message, headless=True)
        
        # Update Lead state
        now = datetime.utcnow()
        lead.last_contacted_at = now
        if not lead.x_handle:
            lead.x_handle = f"@{clean_handle}"
        if lead.status == LeadStatus.NOT_CONTACTED.value:
            lead.status = LeadStatus.CONTACTED.value
        elif lead.status in [LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value]:
            lead.status = LeadStatus.FOLLOWED_UP.value
        lead.updated_at = now
        session.add(lead)

        # Record message in SQLite
        msg_record = EmailMessage(
            lead_id=lead.id,
            channel=MessageChannel.X_DM.value,
            direction=EmailDirection.SENT.value,
            sender="@PraroopX",
            recipient=f"@{clean_handle}",
            subject=f"X DM to @{clean_handle}",
            snippet=rendered_message[:200].strip(),
            body_text=rendered_message,
            sent_at=now,
            message_id=f"x_browser_dm_{int(datetime.utcnow().timestamp())}"
        )
        session.add(msg_record)
        session.commit()
        session.refresh(msg_record)
        session.refresh(lead)

        return {
            "ok": True,
            "message": f"X DM sent via browser automation to @{clean_handle}",
            "msg_id": msg_record.id,
            "status": lead.status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Browser automation error: {str(e)}")
