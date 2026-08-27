import base64
import json
import urllib.parse
from datetime import datetime
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import Lead, LinkClick, LeadStatus

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
    parsed = urllib.parse.urlparse(url)
    company_slug = (lead.company or "prospect").lower().replace(" ", "_")
    name_slug = (lead.first_name or "contact").lower().replace(" ", "_")
    
    utm_params = {
        "utm_source": "outreach",
        "utm_medium": "email",
        "utm_campaign": f"outreach_{company_slug}",
        "utm_content": name_slug,
        "ref": f"po_{lead.id}"
    }

    query_dict = dict(urllib.parse.parse_qsl(parsed.query))
    for k, v in utm_params.items():
        if k not in query_dict:
            query_dict[k] = v

    new_query = urllib.parse.urlencode(query_dict)
    return urllib.parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

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
            utm_campaign=f"outreach_{(lead.company or 'prospect').lower()}" if lead else "outreach",
            utm_content=(lead.first_name or "").lower() if lead else None,
            ip_address=client_ip,
            user_agent=user_agent,
            clicked_at=datetime.utcnow()
        )
        session.add(click)
        session.commit()
    except Exception as e:
        print(f"Failed to record link click: {e}")

    return RedirectResponse(url=final_url, status_code=307)
