from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.db import get_session
from app.models import (
    Lead, 
    SendLinkedInConnectRequest, 
    SendLinkedInMessageRequest, 
    EmailMessage, 
    LeadStatus, 
    EmailDirection, 
    MessageChannel
)
from app.services.linkedin_browser_automation import (
    get_linkedin_browser_session_status,
    save_linkedin_cookies_as_session,
    send_linkedin_connection_request,
    send_linkedin_direct_message,
    clean_linkedin_url
)
from app.services.email_sender import render_template

router = APIRouter(prefix="/api/auth/linkedin", tags=["LinkedIn Browser Automation"])

class SaveLinkedInCookiesRequest(BaseModel):
    li_at: str
    jsessionid: Optional[str] = None

@router.get("/status")
def linkedin_status():
    status = get_linkedin_browser_session_status()
    return {
        "connected": status.get("has_session", False),
        "browser_automation": status
    }

@router.post("/save-cookies")
def save_browser_cookies(req: SaveLinkedInCookiesRequest):
    if not req.li_at:
        raise HTTPException(status_code=400, detail="li_at cookie is required.")
    return save_linkedin_cookies_as_session(req.li_at, req.jsessionid)

@router.post("/leads/{lead_id}/connect")
def connect_with_lead(lead_id: int, req: SendLinkedInConnectRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    target_url = req.linkedin_url or lead.linkedin_url
    if not target_url:
        raise HTTPException(status_code=400, detail="No LinkedIn URL provided for this lead.")

    browser_status = get_linkedin_browser_session_status()
    if not browser_status.get("has_session"):
        raise HTTPException(
            status_code=400,
            detail="No LinkedIn browser session configured. Please click 'Setup LinkedIn Cookies' in the dashboard header and paste your li_at cookie."
        )

    rendered_note = render_template(req.note, lead) if req.note else ""

    try:
        res = send_linkedin_connection_request(target_url, rendered_note, headless=True)

        now = datetime.utcnow()
        lead.last_contacted_at = now
        if not lead.linkedin_url:
            lead.linkedin_url = target_url
        if lead.status == LeadStatus.NOT_CONTACTED.value:
            lead.status = LeadStatus.CONTACTED.value
        elif lead.status in [LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value]:
            lead.status = LeadStatus.FOLLOWED_UP.value
        lead.updated_at = now
        session.add(lead)

        msg_record = EmailMessage(
            lead_id=lead.id,
            channel=MessageChannel.LINKEDIN_CONNECT.value,
            direction=EmailDirection.SENT.value,
            sender="LinkedIn Profile",
            recipient=target_url,
            subject=f"LinkedIn Connection Request: {lead.first_name or ''} {lead.last_name or ''}".strip(),
            snippet=rendered_note[:200].strip() if rendered_note else "Connection invite sent",
            body_text=rendered_note or "Connection request sent without note",
            sent_at=now,
            message_id=f"li_connect_{int(datetime.utcnow().timestamp())}"
        )
        session.add(msg_record)
        session.commit()
        session.refresh(msg_record)
        session.refresh(lead)

        return {
            "ok": True,
            "message": f"LinkedIn connection request sent to {target_url}",
            "msg_id": msg_record.id,
            "status": lead.status,
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LinkedIn automation error: {str(e)}")

@router.post("/leads/{lead_id}/send-message")
def send_message_to_lead(lead_id: int, req: SendLinkedInMessageRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    target_url = req.linkedin_url or lead.linkedin_url
    if not target_url:
        raise HTTPException(status_code=400, detail="No LinkedIn URL provided for this lead.")

    browser_status = get_linkedin_browser_session_status()
    if not browser_status.get("has_session"):
        raise HTTPException(
            status_code=400,
            detail="No LinkedIn browser session configured. Please configure your li_at cookie."
        )

    rendered_message = render_template(req.message, lead)

    try:
        res = send_linkedin_direct_message(target_url, rendered_message, headless=True)

        now = datetime.utcnow()
        lead.last_contacted_at = now
        if lead.status == LeadStatus.NOT_CONTACTED.value:
            lead.status = LeadStatus.CONTACTED.value
        lead.updated_at = now
        session.add(lead)

        msg_record = EmailMessage(
            lead_id=lead.id,
            channel=MessageChannel.LINKEDIN_DM.value,
            direction=EmailDirection.SENT.value,
            sender="LinkedIn Profile",
            recipient=target_url,
            subject=f"LinkedIn DM to {lead.first_name or ''} {lead.last_name or ''}".strip(),
            snippet=rendered_message[:200].strip(),
            body_text=rendered_message,
            sent_at=now,
            message_id=f"li_dm_{int(datetime.utcnow().timestamp())}"
        )
        session.add(msg_record)
        session.commit()
        session.refresh(msg_record)
        session.refresh(lead)

        return {
            "ok": True,
            "message": f"LinkedIn DM sent to {target_url}",
            "msg_id": msg_record.id,
            "status": lead.status,
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LinkedIn DM automation error: {str(e)}")
