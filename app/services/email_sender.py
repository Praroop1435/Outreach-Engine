import smtplib
import os
import re
import urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime
from typing import Optional, Dict, Any
from sqlmodel import Session, select

from app.config import settings
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection

URL_REGEX = re.compile(r"(https?://[^\s<>\"'\)]+)", re.IGNORECASE)

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
        "custom_hook": lead.custom_hook or "your recent work",
        "email": lead.email,
        "website": lead.website_url or "",
    }
    rendered = template_str
    for key, value in mapping.items():
        pattern = re.compile(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", re.IGNORECASE)
        rendered = pattern.sub(str(value or ""), rendered)
    return rendered

def build_utm_url(url: str, lead: Lead) -> str:
    """Appends UTM campaign parameters disguised behind clean links."""
    parsed = urllib.parse.urlparse(url)
    company_slug = (lead.company or "prospect").lower().replace(" ", "_")
    name_slug = (lead.first_name or "contact").lower().replace(" ", "_")
    
    utm_params = {
        "utm_source": "outreach",
        "utm_medium": "email",
        "utm_campaign": f"outreach_{company_slug}",
        "utm_content": name_slug,
        "ref": f"po_{lead.id or 0}"
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

def generate_html_body_with_utm(body_text: str, lead: Lead, enable_utm: bool = True) -> str:
    """Converts plain text body to clean HTML while disguising UTM tracking parameters in anchor hrefs."""
    escaped_lines = []
    for line in body_text.split("\n"):
        def replace_url(match):
            raw_url = match.group(1).rstrip(".,;")
            trailing_punct = match.group(1)[len(raw_url):]
            if enable_utm:
                tracked_url = build_utm_url(raw_url, lead)
            else:
                tracked_url = raw_url
            return f'<a href="{tracked_url}" style="color: #111827; text-decoration: underline;" target="_blank">{raw_url}</a>{trailing_punct}'

        transformed_line = URL_REGEX.sub(replace_url, line)
        escaped_lines.append(transformed_line)

    html_content = "<br>".join(escaped_lines)
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
    enable_utm_tracking: bool = True,
    thread_id: Optional[str] = None
) -> EmailMessage:
    """Sends an email via Gmail SMTP with pre-flight MX verification, disguised UTM link tracking & PDF resume attachment."""
    if not settings.GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_APP_PASSWORD is not configured in .env")
    if not settings.GMAIL_USER:
        raise ValueError("GMAIL_USER is not configured in .env")

    # 1. Pre-flight Deliverability & MX Verification
    verif = verify_email_deliverability(lead.email, check_mx=True)
    if not verif["valid"]:
        lead.status = LeadStatus.INVALID_EMAIL.value
        session.add(lead)
        session.commit()
        err_msg = f"Pre-flight deliverability check failed for '{lead.email}': {verif.get('error')}"
        if verif.get("suggestion"):
            err_msg += f" (Suggested alternative: {verif['suggestion']})"
        raise ValueError(err_msg)

    # Construct MIME message (mixed for body + attachments)
    msg = MIMEMultipart("mixed")
    msg["From"] = f"Praroop Anand <{settings.GMAIL_USER}>"
    msg["To"] = lead.email
    msg["Subject"] = subject

    # Alternative container for plain text + html
    alt_container = MIMEMultipart("alternative")
    text_part = MIMEText(body, "plain", "utf-8")
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
