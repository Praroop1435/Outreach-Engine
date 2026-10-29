import smtplib
import os
import html
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Session, select

from app.config import settings
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection

JUNK_HOOK_REGEX = re.compile(r"https?://|linkedin\.com|^what you are building at", re.IGNORECASE)

def clean_custom_hook(hook: Optional[str]) -> str:
    """Drops auto-generated hooks (sheet URLs, 'what you are building at X (city)') that read as mail merge."""
    hook = (hook or "").strip().rstrip(".")
    if not hook or JUNK_HOOK_REGEX.search(hook):
        return "your recent work"
    return hook

def render_template(template_str: str, lead: Lead) -> str:
    """Renders placeholders in the template with lead attributes."""
    mapping = {
        "firstName": lead.first_name or (lead.email.split("@")[0].capitalize() if lead.email else ""),
        "first_name": lead.first_name or (lead.email.split("@")[0].capitalize() if lead.email else ""),
        "lastName": lead.last_name or "",
        "last_name": lead.last_name or "",
        "company": lead.company or "your team",
        "role": lead.role or "team",
        "x_handle": lead.x_handle or "",
        "custom_hook": clean_custom_hook(lead.custom_hook),
        "email": lead.email,
        "website": lead.website_url or "",
        "job_role": lead.notes or "AI Engineer",
        "target_role": lead.notes or "AI Engineer",
    }
    rendered = template_str
    for key, value in mapping.items():
        pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", re.IGNORECASE)
        rendered = pattern.sub(str(value or ""), rendered)
    return rendered

from app.routers.tracking import encode_tracking_token
from app.services.utm import URL_REGEX, add_utm, lead_utm, split_trailing_punct, tag_links

def generate_html_body_with_utm(body_text: str, lead: Lead, enable_utm: bool = False) -> str:
    """Converts plain text to HTML. Every link gets UTM params on its real destination;
    with enable_utm (click tracking) the href goes through the redirect logger instead."""
    utm = lead_utm(lead)
    base_tracking_url = getattr(settings, "TRACKING_BASE_URL", "https://outreach-engine-h5lx.onrender.com").rstrip("/")
    html_lines = []
    for line in body_text.split("\n"):
        parts, last = [], 0
        for match in URL_REGEX.finditer(line):
            raw_url, trailing = split_trailing_punct(match.group(1))
            href = add_utm(raw_url, **utm)
            if enable_utm and lead.id:
                href = f"{base_tracking_url}/api/t/click/{encode_tracking_token(lead.id, href)}"
            parts.append(html.escape(line[last:match.start()]))
            parts.append(f'<a href="{html.escape(href, quote=True)}" style="color: #111827; text-decoration: underline;" target="_blank">{html.escape(raw_url)}</a>{html.escape(trailing)}')
            last = match.end()
        parts.append(html.escape(line[last:]))
        html_lines.append("".join(parts))

    html_content = "<br>".join(html_lines)
    return f"""<div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #111827;'>
{html_content}
</div>"""

from app.services.email_verifier import verify_email_deliverability

def send_email_to_lead(
    session: Session,
    lead: Lead,
    subject: str,
    body: str,
    attach_resume: bool = True,
    enable_utm_tracking: bool = False,
    thread_id: Optional[str] = None,
    allow_catchall: bool = False,
    skip_deliverability_check: bool = False
) -> EmailMessage:
    """Sends an email via Gmail SMTP with pre-flight MX verification, disguised UTM link tracking & PDF resume attachment."""
    if not settings.GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_APP_PASSWORD is not configured in .env")
    if not settings.GMAIL_USER:
        raise ValueError("GMAIL_USER is not configured in .env")

    # 1. Pre-flight Deliverability & MX Verification
    if not skip_deliverability_check:
        verif = verify_email_deliverability(lead.email, check_mx=True)
        is_valid = verif["valid"] or (allow_catchall and verif.get("bouncify_status") in ("accept all", "accept_all", "accept_all_catchall"))
        if not is_valid:
            lead.status = LeadStatus.INVALID_EMAIL.value
            session.add(lead)
            session.commit()
            err_msg = f"Pre-flight deliverability check failed for '{lead.email}': {verif.get('error')}"
            if verif.get("suggestion"):
                err_msg += f" (Suggested alternative: {verif['suggestion']})"
            raise ValueError(err_msg)

    import uuid
    custom_msg_id = f"<{uuid.uuid4()}@mail.outreach.praroop.site>"
    msg = MIMEMultipart("mixed")
    msg["From"] = f"Praroop Anand <{settings.GMAIL_USER}>"
    msg["To"] = lead.email
    msg["Subject"] = subject
    msg["Message-ID"] = custom_msg_id

    # Alternative container for plain text + html
    alt_container = MIMEMultipart("alternative")
    text_part = MIMEText(tag_links(body, **lead_utm(lead)), "plain", "utf-8")
    html_body = generate_html_body_with_utm(body, lead, enable_utm=enable_utm_tracking)
    html_part = MIMEText(html_body, "html", "utf-8")
    
    alt_container.attach(text_part)
    alt_container.attach(html_part)
    msg.attach(alt_container)

    # Attach Resume PDF if requested
    if attach_resume:
        resume_path = settings.RESUME_PATH
        if not os.path.isabs(resume_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            resume_path = os.path.join(base_dir, resume_path)
            if not os.path.exists(resume_path):
                alt_path = os.path.join(base_dir, "Praroop_Anand.pdf")
                if os.path.exists(alt_path):
                    resume_path = alt_path
                else:
                    resume_path = "/Users/praroopanand/Documents/Resumes/Praroop_Anand.pdf"

        if os.path.exists(resume_path):
            with open(resume_path, "rb") as f:
                pdf_part = MIMEApplication(f.read(), _subtype="pdf")
            pdf_part.add_header("Content-Disposition", "attachment", filename="Praroop_Anand.pdf")
            msg.attach(pdf_part)

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
        message_id=custom_msg_id,
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
