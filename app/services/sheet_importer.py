import csv
import io
import re
from typing import List, Dict, Any, Tuple
from sqlmodel import Session, select
from datetime import datetime
import httpx

from app.models import Lead, LeadStatus

def clean_header(h: str) -> str:
    """Normalizes header string for fuzzy matching."""
    return re.sub(r"[^a-zA-Z0-9]", "", h).lower()

def map_row_to_lead_data(row: Dict[str, str]) -> Dict[str, Any]:
    """Intelligently maps varying CSV column names to Lead model fields."""
    normalized_row = {clean_header(k): v.strip() for k, v in row.items() if k}

    email = ""
    for k in ["email", "emailaddress", "contactemail", "workemail", "mail"]:
        if k in normalized_row and normalized_row[k]:
            email = normalized_row[k]
            break

    # If no exact email column found, scan values for email format
    if not email:
        for val in row.values():
            if val and "@" in val and "." in val:
                match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", val)
                if match:
                    email = match.group(0)
                    break

    first_name = ""
    last_name = ""
    for k in ["firstname", "first", "fname"]:
        if k in normalized_row and normalized_row[k]:
            first_name = normalized_row[k]
            break
    for k in ["lastname", "last", "lname", "surname"]:
        if k in normalized_row and normalized_row[k]:
            last_name = normalized_row[k]
            break

    if not first_name:
        for k in ["name", "fullname", "contactname", "person", "leadname", "prospect"]:
            if k in normalized_row and normalized_row[k]:
                parts = normalized_row[k].split()
                if len(parts) == 1:
                    first_name = parts[0]
                elif len(parts) > 1:
                    first_name = parts[0]
                    last_name = " ".join(parts[1:])
                break

    company = ""
    for k in ["company", "companyname", "organization", "account", "firm", "business"]:
        if k in normalized_row and normalized_row[k]:
            company = normalized_row[k]
            break

    role = ""
    for k in ["role", "jobtitle", "title", "position", "designation"]:
        if k in normalized_row and normalized_row[k]:
            role = normalized_row[k]
            break

    custom_hook = ""
    for k in ["customhook", "hook", "pitch", "icebreaker", "personalization", "notesaboutthem", "intro"]:
        if k in normalized_row and normalized_row[k]:
            custom_hook = normalized_row[k]
            break

    notes = ""
    for k in ["notes", "note", "comments", "description", "details"]:
        if k in normalized_row and normalized_row[k]:
            notes = normalized_row[k]
            break

    linkedin_url = ""
    for k in ["linkedin", "linkedinurl", "profile"]:
        if k in normalized_row and normalized_row[k]:
            linkedin_url = normalized_row[k]
            break

    website_url = ""
    for k in ["website", "url", "domain", "companyurl"]:
        if k in normalized_row and normalized_row[k]:
            website_url = normalized_row[k]
            break

    status = LeadStatus.NOT_CONTACTED.value
    for k in ["status", "leadstatus", "stage", "outreachstatus"]:
        if k in normalized_row and normalized_row[k]:
            raw_s = normalized_row[k].upper().replace(" ", "_").replace("-", "_")
            for enum_val in LeadStatus:
                if raw_s == enum_val.value:
                    status = enum_val.value
                    break
                elif raw_s in ["SENT", "REACHED_OUT", "EMAILED"]:
                    status = LeadStatus.CONTACTED.value
                    break
                elif raw_s in ["REPLY", "RESPONDED"]:
                    status = LeadStatus.REPLIED.value
                    break

    return {
        "email": email.lower().strip() if email else "",
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "company": company.strip(),
        "role": role.strip(),
        "custom_hook": custom_hook.strip(),
        "notes": notes.strip(),
        "linkedin_url": linkedin_url.strip(),
        "website_url": website_url.strip(),
        "status": status
    }

def import_leads_from_csv(session: Session, csv_content: str, source_name: str = "CSV Import") -> Dict[str, Any]:
    """Parses CSV string, creates or updates leads in database."""
    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    stats = {"created": 0, "updated": 0, "skipped": 0, "total_rows": 0}

    for row in reader:
        stats["total_rows"] += 1
        lead_data = map_row_to_lead_data(row)
        email_str = lead_data.get("email")
        if not email_str or "@" not in email_str:
            stats["skipped"] += 1
            continue

        existing = session.exec(select(Lead).where(Lead.email == email_str)).first()
        if not existing:
            lead = Lead(
                email=email_str,
                first_name=lead_data["first_name"],
                last_name=lead_data["last_name"],
                company=lead_data["company"],
                role=lead_data["role"],
                custom_hook=lead_data["custom_hook"],
                notes=lead_data["notes"],
                linkedin_url=lead_data["linkedin_url"],
                website_url=lead_data["website_url"],
                status=lead_data["status"],
                source=source_name
            )
            session.add(lead)
            stats["created"] += 1
        else:
            if lead_data["first_name"] and not existing.first_name:
                existing.first_name = lead_data["first_name"]
            if lead_data["last_name"] and not existing.last_name:
                existing.last_name = lead_data["last_name"]
            if lead_data["company"] and not existing.company:
                existing.company = lead_data["company"]
            if lead_data["role"] and not existing.role:
                existing.role = lead_data["role"]
            if lead_data["custom_hook"] and not existing.custom_hook:
                existing.custom_hook = lead_data["custom_hook"]
            if lead_data["notes"] and not existing.notes:
                existing.notes = lead_data["notes"]
            existing.updated_at = datetime.utcnow()
            session.add(existing)
            stats["updated"] += 1

    session.commit()
    return stats
