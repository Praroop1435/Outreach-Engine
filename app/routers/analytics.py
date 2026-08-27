from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func, col
from datetime import datetime, timedelta
from typing import Dict, Any, List

from app.db import get_session
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection

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

    # Reply rate
    reply_rate = round((replied_count / contacted_count * 100), 1) if contacted_count > 0 else 0.0

    # Follow-ups due (contacted over 3 days ago without reply or explicit follow_up_due_at <= now)
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    follow_up_needed = session.exec(
        select(func.count(Lead.id)).where(
            Lead.status == LeadStatus.CONTACTED.value,
            Lead.last_contacted_at != None,
            Lead.last_contacted_at <= three_days_ago
        )
    ).one() or 0

    # Recent 5 activity logs
    recent_messages = session.exec(
        select(EmailMessage).order_by(col(EmailMessage.sent_at).desc()).limit(6)
    ).all()

    return {
        "total_leads": total_leads,
        "contacted_count": contacted_count,
        "not_contacted_count": not_contacted_count,
        "replied_count": replied_count,
        "interested_count": interested_count,
        "follow_up_needed": follow_up_needed,
        "total_sent_emails": total_sent_emails,
        "total_received_emails": total_received_emails,
        "reply_rate": reply_rate,
        "recent_messages": [
            {
                "id": m.id,
                "lead_id": m.lead_id,
                "direction": m.direction,
                "sender": m.sender,
                "recipient": m.recipient,
                "subject": m.subject,
                "snippet": m.snippet,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None
            }
            for m in recent_messages
        ]
    }
