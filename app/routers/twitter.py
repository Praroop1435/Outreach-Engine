from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from typing import Optional

from app.db import get_session
from app.models import Lead, SendXDMRequest
from app.services.twitter_service import (
    get_authorization_url,
    exchange_code_for_token,
    get_x_connection_status,
    send_x_direct_message,
    sync_x_dms_to_leads
)
from app.services.email_sender import render_template

router = APIRouter(prefix="/api/auth/x", tags=["X Twitter"])

@router.get("/status")
def x_status():
    return get_x_connection_status()

@router.get("/login")
def x_login():
    try:
        data = get_authorization_url()
        return RedirectResponse(data["auth_url"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/callback")
def x_callback(code: str = Query(...), state: str = Query(...)):
    try:
        token_data = exchange_code_for_token(code, state)
        return RedirectResponse(url="/?x_connected=true")
    except Exception as e:
        return RedirectResponse(url=f"/?x_error={str(e)}")

@router.post("/leads/{lead_id}/send-dm")
def send_dm_to_lead(lead_id: int, req: SendXDMRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Render template variables if present
    rendered_message = render_template(req.message, lead)

    try:
        msg_record = send_x_direct_message(
            session=session,
            lead=lead,
            message_text=rendered_message,
            custom_handle=req.x_handle
        )
        return {
            "ok": True,
            "message": f"X DM sent successfully to {msg_record.recipient}",
            "msg_id": msg_record.id,
            "status": lead.status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
def sync_x_messages(session: Session = Depends(get_session)):
    try:
        stats = sync_x_dms_to_leads(session=session, exclude_keywords=["anjan", "piyush"])
        return {
            "ok": True,
            "message": f"X DMs synced: {stats.get('created', 0)} new contacts created, {stats.get('updated', 0)} updated (skipped friends: {stats.get('skipped', 0)}).",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

