from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.email_templates import LOOM_SOCIAL_AUTOMATE
from app.models import EmailDirection, EmailMessage, Lead, LeadStatus, MessageChannel, XDmSyncRun
from app.services.utm import tag_links

router = APIRouter(prefix="/api/x-dms", tags=["X DMs"])

# Same rhythm as email follow-ups: day 3 with the second Loom, then a short close-out by day 8
FOLLOW_UP_GAP_DAYS = {1: 3, 2: 5}


def follow_up_draft(lead: Lead, sent_count: int) -> str:
    first = lead.first_name or "there"
    if sent_count == 1:
        draft = (
            f"Hey {first}, bumping this in case it got buried.\n\n"
            f"One more thing I built, this time on the backend side: Django, Celery and Redis, 500+ leads scraped a day.\n"
            f"{LOOM_SOCIAL_AUTOMATE}\n\n"
            f"Still happy to start with a small paid trial if that's easier."
        )
        return tag_links(draft, campaign=lead.company or "", content=f"lead_{lead.id}", medium="x_dm")
    return (
        f"Hey {first}, last note from me, I don't want to crowd your DMs.\n\n"
        f"If you need help with AI or backend work, now or later, just say yes and I'll send a few times. "
        f"If the timing is off, a one-word no helps too."
    )


def _contact(lead: Lead, thread: str | None) -> dict:
    handle = (lead.x_handle or "").lstrip("@")
    return {
        "lead_id": lead.id,
        "name": " ".join(p for p in [lead.first_name, lead.last_name] if p) or handle,
        "company": lead.company,
        "handle": handle,
        # Falls back to the profile when no DM thread is known yet
        "chat_url": f"https://x.com/i/chat/{thread}" if thread else f"https://x.com/{handle}",
    }


@router.get("")
def x_dm_activity(session: Session = Depends(get_session)):
    rows = session.exec(
        select(EmailMessage, Lead)
        .join(Lead, EmailMessage.lead_id == Lead.id)
        .where(EmailMessage.channel == MessageChannel.X_DM.value)
        .order_by(EmailMessage.sent_at)
    ).all()

    by_lead: dict[int, dict] = {}
    for message, lead in rows:
        entry = by_lead.setdefault(lead.id, {"lead": lead, "sent": [], "received": [], "thread": None})
        entry["sent" if message.direction == EmailDirection.SENT.value else "received"].append(message)
        entry["thread"] = message.thread_id or entry["thread"]

    now = datetime.utcnow()
    replies, follow_ups = [], []
    for entry in by_lead.values():
        lead, sent, received = entry["lead"], entry["sent"], entry["received"]
        if lead.status == LeadStatus.NOT_INTERESTED.value:
            continue
        if received:
            last = received[-1]
            replies.append({**_contact(lead, entry["thread"]), "text": last.body_text or last.snippet, "received_at": last.sent_at, "status": lead.status})
        elif lead.status == LeadStatus.DMED.value and sent and len(sent) in FOLLOW_UP_GAP_DAYS:
            due_at = sent[-1].sent_at + timedelta(days=FOLLOW_UP_GAP_DAYS[len(sent)])
            if due_at <= now:
                follow_ups.append({**_contact(lead, entry["thread"]), "draft": follow_up_draft(lead, len(sent)), "last_sent_at": sent[-1].sent_at, "follow_up_number": len(sent)})

    last_run = session.exec(select(XDmSyncRun).order_by(XDmSyncRun.started_at.desc())).first()
    return {
        "replies": sorted(replies, key=lambda r: r["received_at"], reverse=True),
        "follow_ups": sorted(follow_ups, key=lambda f: f["last_sent_at"]),
        "last_run": last_run.model_dump() if last_run else None,
    }
