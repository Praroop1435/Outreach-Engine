from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func, col
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.db import get_session
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection, LinkClick
from app.cache import app_cache

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/overview")
def get_analytics_overview(session: Session = Depends(get_session)) -> Dict[str, Any]:
    cached = app_cache.get("analytics:overview")
    if cached is not None:
        return cached
    total_leads = session.exec(select(func.count(Lead.id))).one() or 0
    
    # Aggregate status counts with a single group-by query for maximum speed
    status_counts_rows = session.exec(select(Lead.status, func.count(Lead.id)).group_by(Lead.status)).all()
    status_map = {row[0]: row[1] for row in status_counts_rows}

    contacted_count = (
        status_map.get(LeadStatus.CONTACTED.value, 0) +
        status_map.get(LeadStatus.FOLLOWED_UP.value, 0) +
        status_map.get(LeadStatus.REPLIED.value, 0) +
        status_map.get(LeadStatus.INTERESTED.value, 0) +
        status_map.get(LeadStatus.DMED.value, 0)
    )
    replied_count = status_map.get(LeadStatus.REPLIED.value, 0) + status_map.get(LeadStatus.INTERESTED.value, 0)
    not_contacted_count = status_map.get(LeadStatus.NOT_CONTACTED.value, 0)
    interested_count = status_map.get(LeadStatus.INTERESTED.value, 0)
    bounced_count = status_map.get(LeadStatus.BOUNCED.value, 0) + status_map.get(LeadStatus.INVALID_EMAIL.value, 0)
    dmed_count = status_map.get(LeadStatus.DMED.value, 0)
    dm_staged_count = status_map.get(LeadStatus.DM_STAGED.value, 0)
    dm_closed_count = status_map.get(LeadStatus.DM_CLOSED.value, 0)
    pending_dm_count = status_map.get(LeadStatus.PENDING_DM.value, 0)

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

    res = {
        "total_leads": total_leads,
        "contacted_count": contacted_count,
        "not_contacted_count": not_contacted_count,
        "replied_count": replied_count,
        "interested_count": interested_count,
        "bounced_count": bounced_count,
        "dmed_count": dmed_count,
        "dm_staged_count": dm_staged_count,
        "dm_closed_count": dm_closed_count,
        "pending_dm_count": pending_dm_count,
        "follow_up_needed": follow_up_needed,
        "total_sent_emails": total_sent_emails,
        "total_received_emails": total_received_emails,
        "total_link_clicks": total_link_clicks,
        "reply_rate": reply_rate
    }
    app_cache.set("analytics:overview", res, ttl_seconds=60)
    return res

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
            "lead_email": lead.email if lead else "N/A",
            "lead_company": lead.company if lead else "N/A",
            "target_url": click.target_url,
            "utm_source": click.utm_source,
            "utm_campaign": click.utm_campaign,
            "utm_content": click.utm_content,
            "clicked_at": click.clicked_at.isoformat() if click.clicked_at else None,
            "ip_address": click.ip_address,
            "user_agent": click.user_agent
        })
    return click_list

@router.get("/replies")
def get_recent_replies(
    limit: int = 25,
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """Returns incoming replies with prospect info for the notification bell."""
    cache_key = f"analytics:replies:{limit}"
    cached = app_cache.get(cache_key)
    if cached is not None:
        return cached

    query = (
        select(EmailMessage, Lead)
        .join(Lead, EmailMessage.lead_id == Lead.id, isouter=True)
        .where(EmailMessage.direction == EmailDirection.RECEIVED.value)
        .order_by(col(EmailMessage.sent_at).desc())
        .limit(limit)
    )
    results = session.exec(query).all()
    replies_list = []
    for msg, lead in results:
        replies_list.append({
            "id": msg.id,
            "lead_id": msg.lead_id,
            "sender": msg.sender,
            "recipient": msg.recipient,
            "subject": msg.subject,
            "channel": msg.channel,
            "thread_id": msg.thread_id,
            "snippet": msg.snippet or (msg.body_text[:120] if msg.body_text else ""),
            "sent_at": msg.sent_at.isoformat() if msg.sent_at else None,
            "lead_name": f"{lead.first_name or ''} {lead.last_name or ''}".strip() if lead else msg.sender,
            "lead_company": lead.company if lead else "Unknown",
            "lead_email": lead.email if lead else msg.sender,
            "lead_status": lead.status if lead else "REPLIED"
        })
    app_cache.set(cache_key, replies_list, ttl_seconds=60)
    return replies_list
