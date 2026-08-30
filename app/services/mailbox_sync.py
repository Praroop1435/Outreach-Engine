import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime
from typing import Dict, Any, List, Optional
import os
from sqlmodel import Session, select

from app.config import settings
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection

def decode_mime_str(s: Optional[str]) -> str:
    """Decodes MIME encoded headers safely."""
    if not s:
        return ""
    try:
        decoded_parts = decode_header(s)
        result = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                result += part.decode(encoding or "utf-8", errors="ignore")
            else:
                result += str(part)
        return result.strip()
    except Exception:
        return str(s)

def extract_body(msg: email.message.Message) -> str:
    """Extracts plain text body from email message."""
    body = ""
    try:
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disp = str(part.get("Content-Disposition", ""))
                if content_type == "text/plain" and "attachment" not in content_disp:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode(errors="ignore")
                        break
            if not body:
                for part in msg.walk():
                    if part.get_content_type() == "text/html":
                        payload = part.get_payload(decode=True)
                        if payload:
                            body = payload.decode(errors="ignore")
                            break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode(errors="ignore")
    except Exception:
        pass
    return body.strip()

def infer_company_from_email(email_str: str) -> str:
    """Infers reasonable company name from email domain if generic domains are excluded."""
    generic_domains = {
        "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
        "protonmail.com", "me.com", "live.com", "aol.com"
    }
    if "@" not in email_str:
        return ""
    domain = email_str.split("@")[-1].lower()
    if domain in generic_domains:
        return ""
    name_part = domain.split(".")[0]
    return name_part.capitalize()

def parse_name(name_raw: str, email_str: str) -> tuple[str, str]:
    """Splits full name into first and last name."""
    clean_name = name_raw.strip().replace('"', '').replace("'", "")
    if clean_name and not clean_name.startswith("http") and not "@" in clean_name:
        parts = clean_name.split()
        if len(parts) == 1:
            return parts[0], ""
        elif len(parts) > 1:
            return parts[0], " ".join(parts[1:])
    # Fallback to local part of email
    local = email_str.split("@")[0].replace(".", " ").replace("_", " ")
    parts = local.split()
    if parts:
        return parts[0].capitalize(), " ".join([p.capitalize() for p in parts[1:]])
import re

def extract_bounced_email(subject: str, body: str) -> Optional[str]:
    """Extracts bounced recipient email address from Mail Delivery Subsystem / DSN bodies."""
    patterns = [
        r"wasn't delivered to\s+([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
        r"delivered to\s+([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
        r"failed:\s*([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
        r"<([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>:\s*(?:550|554|Host or domain name not found|No such user|Recipient address rejected)",
        r"Recipient:\s*<?([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)?>?",
        r"Final-Recipient:\s*rfc822;\s*([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
        r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\s*couldn't be found",
        r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\s*does not exist"
    ]
    full_text = f"{subject}\n{body}"
    for p in patterns:
        m = re.search(p, full_text, re.IGNORECASE)
        if m:
            candidate = m.group(1).lower().strip()
            if candidate != settings.GMAIL_USER.lower() and "googlemail.com" not in candidate and "mailer-daemon" not in candidate:
                return candidate
    return None

def sync_mailbox(session: Session, max_messages: int = 150, auto_create_leads: bool = False) -> Dict[str, Any]:
    """
    Syncs Sent Mail and Inbox from Gmail IMAP with local SQLite database.
    Updates lead statuses and logs all messages for existing outreach leads.
    """
    if not settings.GMAIL_APP_PASSWORD:
        raise ValueError("GMAIL_APP_PASSWORD is not set in .env")
    if not settings.GMAIL_USER:
        raise ValueError("GMAIL_USER is not set in .env")

    stats = {
        "sent_synced": 0,
        "inbox_synced": 0,
        "new_leads_created": 0,
        "existing_leads_updated": 0,
        "new_replies_detected": 0
    }

    mail = imaplib.IMAP4_SSL(settings.IMAP_HOST, settings.IMAP_PORT)
    try:
        mail.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)

        # -------------------------------------------------------------
        # 1. Sync Sent Mail
        # -------------------------------------------------------------
        status, _ = mail.select("\"[Gmail]/Sent Mail\"")
        if status == "OK":
            _, response = mail.search(None, "ALL")
            if response and response[0]:
                msg_ids = response[0].split()
                target_ids = msg_ids[-max_messages:] if len(msg_ids) > max_messages else msg_ids

                # Process in chunks of 30 for fast batch fetching
                chunk_size = 30
                for i in range(0, len(target_ids), chunk_size):
                    chunk = target_ids[i:i + chunk_size]
                    id_query = b",".join(chunk)
                    res, data = mail.fetch(id_query, "(RFC822)")
                    if res != "OK":
                        continue

                    for item in data:
                        if not isinstance(item, tuple):
                            continue
                        msg = email.message_from_bytes(item[1])
                        to_raw = decode_mime_str(msg.get("To"))
                        name_raw, addr_raw = parseaddr(to_raw)
                        recipient_email = addr_raw.lower().strip()
                        if not recipient_email or "@" not in recipient_email:
                            continue
                        if recipient_email == settings.GMAIL_USER.lower():
                            continue

                        subject = decode_mime_str(msg.get("Subject"))
                        msg_id = msg.get("Message-ID", "")
                        thread_id = msg.get("Thread-Index", "")

                        date_header = msg.get("Date")
                        sent_dt = datetime.utcnow()
                        if date_header:
                            try:
                                sent_dt = parsedate_to_datetime(date_header).replace(tzinfo=None)
                            except Exception:
                                pass

                        body = extract_body(msg)
                        snippet = body[:200].strip() if body else subject

                        # Check if lead exists
                        lead = session.exec(select(Lead).where(Lead.email == recipient_email)).first()
                        if not lead:
                            if not auto_create_leads:
                                continue
                            first_n, last_n = parse_name(name_raw, recipient_email)
                            comp = infer_company_from_email(recipient_email)
                            lead = Lead(
                                email=recipient_email,
                                first_name=first_n,
                                last_name=last_n,
                                company=comp,
                                status=LeadStatus.CONTACTED.value,
                                source="Gmail Sent Mail",
                                last_contacted_at=sent_dt,
                                created_at=sent_dt,
                                updated_at=sent_dt
                            )
                            session.add(lead)
                            session.commit()
                            session.refresh(lead)
                            stats["new_leads_created"] += 1
                        else:
                            if lead.status == LeadStatus.NOT_CONTACTED.value:
                                lead.status = LeadStatus.CONTACTED.value
                            if not lead.last_contacted_at or sent_dt > lead.last_contacted_at:
                                lead.last_contacted_at = sent_dt
                            lead.updated_at = datetime.utcnow()
                            session.add(lead)
                            session.commit()
                            stats["existing_leads_updated"] += 1

                        # Record message if not already logged
                        existing_msg = None
                        if msg_id:
                            existing_msg = session.exec(
                                select(EmailMessage).where(EmailMessage.message_id == msg_id)
                            ).first()
                        if not existing_msg:
                            email_record = EmailMessage(
                                lead_id=lead.id,
                                message_id=msg_id,
                                thread_id=thread_id,
                                direction=EmailDirection.SENT.value,
                                sender=settings.GMAIL_USER,
                                recipient=recipient_email,
                                subject=subject,
                                snippet=snippet,
                                body_text=body,
                                sent_at=sent_dt
                            )
                            session.add(email_record)
                            session.commit()
                            stats["sent_synced"] += 1

        # -------------------------------------------------------------
        # 2. Sync Inbox (Scan for replies from leads)
        # -------------------------------------------------------------
        status, _ = mail.select("INBOX")
        if status == "OK":
            _, response = mail.search(None, "ALL")
            if response and response[0]:
                msg_ids = response[0].split()
                target_ids = msg_ids[-100:] if len(msg_ids) > 100 else msg_ids
                chunk_size = 30
                for i in range(0, len(target_ids), chunk_size):
                    chunk = target_ids[i:i + chunk_size]
                    id_query = b",".join(chunk)
                    res, data = mail.fetch(id_query, "(RFC822)")
                    if res != "OK":
                        continue

                    for item in data:
                        if not isinstance(item, tuple):
                            continue
                        msg = email.message_from_bytes(item[1])
                        from_raw = decode_mime_str(msg.get("From"))
                        name_raw, addr_raw = parseaddr(from_raw)
                        sender_email = addr_raw.lower().strip()
                        if not sender_email or "@" not in sender_email:
                            continue
                        if sender_email == settings.GMAIL_USER.lower():
                            continue

                        subject = decode_mime_str(msg.get("Subject"))
                        body = extract_body(msg)

                        # 2a. Check for Mailer-Daemon Bounce / Delivery Failure
                        is_bounce = any(k in sender_email for k in ["mailer-daemon", "postmaster", "mail-daemon"]) or "Delivery Status Notification" in subject or "Address not found" in subject
                        if is_bounce:
                            bounced_email = extract_bounced_email(subject, body)
                            if bounced_email:
                                b_lead = session.exec(select(Lead).where(Lead.email == bounced_email)).first()
                                if b_lead:
                                    b_lead.status = LeadStatus.BOUNCED.value
                                    b_lead.updated_at = datetime.utcnow()
                                    session.add(b_lead)
                                    session.commit()
                                    stats["bounces_detected"] = stats.get("bounces_detected", 0) + 1

                                    # Log bounce message
                                    msg_id = msg.get("Message-ID", "")
                                    existing_msg = session.exec(select(EmailMessage).where(EmailMessage.message_id == msg_id)).first() if msg_id else None
                                    if not existing_msg:
                                        bounce_record = EmailMessage(
                                            lead_id=b_lead.id,
                                            message_id=msg_id,
                                            direction=EmailDirection.RECEIVED.value,
                                            sender=sender_email,
                                            recipient=settings.GMAIL_USER,
                                            subject=f"⚠️ BOUNCE: {subject}",
                                            snippet=f"Address not found / undeliverable: {bounced_email}",
                                            body_text=body,
                                            sent_at=datetime.utcnow()
                                        )
                                        session.add(bounce_record)
                                        session.commit()
                                continue

                        # 2b. Check if sender matches any known lead
                        lead = session.exec(select(Lead).where(Lead.email == sender_email)).first()
                        if lead:
                            subject = decode_mime_str(msg.get("Subject"))
                            msg_id = msg.get("Message-ID", "")
                            thread_id = msg.get("Thread-Index", "")

                            date_header = msg.get("Date")
                            recv_dt = datetime.utcnow()
                            if date_header:
                                try:
                                    recv_dt = parsedate_to_datetime(date_header).replace(tzinfo=None)
                                except Exception:
                                    pass

                            body = extract_body(msg)
                            snippet = body[:200].strip() if body else subject

                            # Update status to REPLIED
                            if lead.status in [LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value, LeadStatus.NOT_CONTACTED.value]:
                                lead.status = LeadStatus.REPLIED.value
                                lead.updated_at = datetime.utcnow()
                                session.add(lead)
                                session.commit()
                                stats["new_replies_detected"] += 1

                            # Save received message
                            existing_msg = None
                            if msg_id:
                                existing_msg = session.exec(
                                    select(EmailMessage).where(EmailMessage.message_id == msg_id)
                                ).first()
                            if not existing_msg:
                                email_record = EmailMessage(
                                    lead_id=lead.id,
                                    message_id=msg_id,
                                    thread_id=thread_id,
                                    direction=EmailDirection.RECEIVED.value,
                                    sender=sender_email,
                                    recipient=settings.GMAIL_USER,
                                    subject=subject,
                                    snippet=snippet,
                                    body_text=body,
                                    sent_at=recv_dt
                                )
                                session.add(email_record)
                                session.commit()
                                stats["inbox_synced"] += 1

    finally:
        try:
            mail.logout()
        except Exception:
            pass

    return stats
