import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Session, select

from app.config import settings
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection

def render_template(template_str: str, lead: Lead) -> str:
    """Renders placeholders in the template with lead attributes."""
    mapping = {
        "firstName": lead.first_name or (lead.email.split("@")[0].capitalize() if lead.email else ""),
        "first_name": lead.first_name or (lead.email.split("@")[0].capitalize() if lead.email else ""),
        "lastName": lead.last_name or "",
        "last_name": lead.last_name or "",
        "company": lead.company or "your team",
        "role": lead.role or "team",
        "custom_hook": lead.custom_hook or "your recent developments",
        "email": lead.email,
        "website": lead.website_url or "",
    }
    rendered = template_str
    for key, value in mapping.items():
        pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", re.IGNORECASE)
        rendered = pattern.sub(str(value or ""), rendered)
    return rendered

def send_email_to_lead(
    session: Session,
    lead: Lead,
    subject: str,
    body: str,
    thread_id: Optional[str] = None
) -> EmailMessage:
    """Sends an email via Gmail SMTP and records it in SQLite."""
    if not settings.GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_APP_PASSWORD is not configured in .env")
    if not settings.GMAIL_USER:
        raise ValueError("GMAIL_USER is not configured in .env")

    # Construct MIME message
    msg = MIMEMultipart("alternative")
    msg["From"] = f"Praroop Anand <{settings.GMAIL_USER}>"
    msg["To"] = lead.email
    msg["Subject"] = subject

    # Plain text + basic formatted HTML
    text_part = MIMEText(body, "plain", "utf-8")
    html_body = "<div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #111827;'>" + body.replace("\n", "<br>") + "</div>"
    html_part = MIMEText(html_body, "html", "utf-8")

    msg.attach(text_part)
    msg.attach(html_part)

    # Dispatch via SMTP SSL
    server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
    try:
        server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
        server.send_message(msg)
    finally:
        server.quit()

    # Update Lead state
    now = datetime.utcnow()
    lead.last_contacted_at = now
    if lead.status == LeadStatus.NOT_CONTACTED.value:
        lead.status = LeadStatus.CONTACTED.value
    elif lead.status in [LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value]:
        lead.status = LeadStatus.FOLLOWED_UP.value
    lead.updated_at = now
    session.add(lead)

    # Record message log
    email_msg = EmailMessage(
        lead_id=lead.id,
        direction=EmailDirection.SENT.value,
        sender=settings.GMAIL_USER,
        recipient=lead.email,
        subject=subject,
        snippet=body[:200].strip(),
        body_text=body,
        sent_at=now,
        thread_id=thread_id
    )
    session.add(email_msg)
    session.commit()
    session.refresh(email_msg)
    session.refresh(lead)

    return email_msg
