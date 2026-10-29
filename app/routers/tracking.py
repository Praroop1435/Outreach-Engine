import base64
import json
from datetime import datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import Lead, LinkClick, LeadStatus
from app.services.utm import slugify

router = APIRouter(prefix="/api/t", tags=["Tracking"])

def encode_tracking_token(lead_id: int, target_url: str) -> str:
    data = json.dumps({"lid": lead_id, "url": target_url})
    return base64.urlsafe_b64encode(data.encode("utf-8")).decode("utf-8")

def decode_tracking_token(token: str) -> dict:
    try:
        data = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        return json.loads(data)
    except Exception:
        return {}

def append_utm_params(url: str, lead: Lead) -> str:
    # Links are tagged when the email is built; this only fills gaps for older tokens
    from app.services.utm import add_utm, lead_utm
    return add_utm(url, **lead_utm(lead))

@router.get("/click/{token}")
def handle_link_click(token: str, request: Request, session: Session = Depends(get_session)):
    payload = decode_tracking_token(token)
    if not payload or "url" not in payload:
        raise HTTPException(status_code=400, detail="Invalid tracking link")

    lead_id = payload.get("lid")
    target_url = payload["url"]

    lead = session.get(Lead, lead_id) if lead_id else None
    
    # Append UTM parameters to target destination
    final_url = append_utm_params(target_url, lead) if lead else target_url

    # Record click event
    try:
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")
        
        click = LinkClick(
            lead_id=lead_id,
            target_url=target_url,
            utm_source="outreach",
            utm_campaign=slugify(lead.company) if lead else "outreach",
            utm_content=f"lead_{lead.id}" if lead else None,
            ip_address=client_ip,
            user_agent=user_agent,
            clicked_at=datetime.utcnow()
        )
        session.add(click)
        session.commit()
    except Exception as e:
        print(f"Failed to record link click: {e}")

    return RedirectResponse(url=final_url, status_code=307)
