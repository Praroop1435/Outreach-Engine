from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.db import get_session
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection, LinkClick

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/overview")
def get_analytics_overview(session: Session = Depends(get_session)) -> Dict[str, Any]:
    total_leads = session.exec(select(func.count(Lead.id))).one() or 0
    
    # Status breakdown
    contacted_count = session.exec(
        select(func.count(Lead.id)).where(
            Lead.status.in_([
                LeadStatus.CONTACTED.value,
                LeadStatus.FOLLOWED_UP.value,
                LeadStatus.REPLIED.value,
                LeadStatus.INTERESTED.value
            ])
        )
    ).one() or 0
    
    replied_count = session.exec(
        select(func.count(Lead.id)).where(
            Lead.status.in_([LeadStatus.REPLIED.value, LeadStatus.INTERESTED.value])
        )
    ).one() or 0
    
    not_contacted_count = session.exec(
        select(func.count(Lead.id)).where(Lead.status == LeadStatus.NOT_CONTACTED.value)
    ).one() or 0
    
    interested_count = session.exec(
        select(func.count(Lead.id)).where(Lead.status == LeadStatus.INTERESTED.value)
    ).one() or 0

    # Total sent messages
    total_sent_emails = session.exec(
        select(func.count(EmailMessage.id)).where(EmailMessage.direction == EmailDirection.SENT.value)
    ).one() or 0

    total_received_emails = session.exec(
        select(func.count(EmailMessage.id)).where(EmailMessage.direction == EmailDirection.RECEIVED.value)
    ).one() or 0

    # Total link clicks tracked
    total_link_clicks = session.exec(
        select(func.count(LinkClick.id))
    ).one() or 0

    # Reply rate
    reply_rate = round((replied_count / contacted_count * 100), 1) if contacted_count > 0 else 0.0

    # Follow-ups due
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    follow_up_needed = session.exec(
        select(func.count(Lead.id)).where(
            Lead.status == LeadStatus.CONTACTED.value,
            Lead.last_contacted_at != None,
            Lead.last_contacted_at <= three_days_ago
        )
    ).one() or 0

    # Total bounced
    bounced_count = session.exec(
        select(func.count(Lead.id)).where(Lead.status.in_([LeadStatus.BOUNCED.value, LeadStatus.INVALID_EMAIL.value]))
    ).one() or 0

    return {
        "total_leads": total_leads,
        "contacted_count": contacted_count,
        "not_contacted_count": not_contacted_count,
        "replied_count": replied_count,
        "interested_count": interested_count,
        "bounced_count": bounced_count,
        "follow_up_needed": follow_up_needed,
        "total_sent_emails": total_sent_emails,
        "total_received_emails": total_received_emails,
        "total_link_clicks": total_link_clicks,
        "reply_rate": reply_rate
    }

@router.get("/clicks")
def get_all_clicks(
    lead_id: Optional[int] = Query(None),
    limit: int = Query(50, le=100),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    query = select(LinkClick, Lead).join(Lead, LinkClick.lead_id == Lead.id, isouter=True)
    if lead_id:
        query = query.where(LinkClick.lead_id == lead_id)
    
    query = query.order_by(col(LinkClick.clicked_at).desc()).limit(limit)
    results = session.exec(query).all()

    click_list = []
    for click, lead in results:
        click_list.append({
            "id": click.id,
            "lead_id": click.lead_id,
            "lead_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else "Unknown Prospect",
            "lead_email": lead.email if lead else "—",
            "lead_company": lead.company if lead else "—",
            "target_url": click.target_url,
            "utm_source": click.utm_source,
            "utm_campaign": click.utm_campaign,
            "utm_content": click.utm_content,
            "clicked_at": click.clicked_at.isoformat() if click.clicked_at else None,
            "ip_address": click.ip_address,
            "user_agent": click.user_agent
        })
    return click_list
