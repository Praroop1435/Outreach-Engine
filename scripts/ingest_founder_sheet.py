import sys
import csv
import re
from pathlib import Path

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
sys.path.insert(0, str(PROJECT_ROOT))

from sqlmodel import Session, select
from app.db import engine
from app.models import Lead

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
CSV_PATH = PROJECT_ROOT / "data" / "founder_startups_1500.csv"

def clean_twitter_handle(url: str) -> str:
    if not url:
        return ""
    url = url.strip().rstrip("/")
    # Match patterns like twitter.com/username or x.com/username
    match = re.search(r"(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)", url)
    if match:
        return match.group(1)
    # If already a handle
    clean = re.sub(r"^@", "", url)
    return clean if re.match(r"^[A-Za-z0-9_]+$", clean) else ""

def ingest_founders(limit: int = 500):
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} not found")
        return

    print("Parsing Founder Google Sheet CSV...")
    founders_to_ingest = []
    current_company = ""
    current_category = ""
    current_location = ""
    current_tags = ""
    current_website = ""
    current_co_twitter = ""

    with open(CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row_idx, row in enumerate(reader):
            if row_idx == 0:
                continue

            # Check if this row defines a new company
            if len(row) > 0 and row[0].strip():
                current_company = row[0].strip()
                current_category = row[1].strip() if len(row) > 1 else ""
                current_location = row[2].strip() if len(row) > 2 else ""
                current_tags = row[3].strip() if len(row) > 3 else ""
                current_website = row[4].strip() if len(row) > 4 else ""
                current_co_twitter = row[5].strip() if len(row) > 5 else ""

            founder_name = row[7].strip() if len(row) > 7 else ""
            founder_linkedin = row[8].strip() if len(row) > 8 else ""
            founder_twitter = row[9].strip() if len(row) > 9 else ""

            # We focus on founders with Twitter/X handles
            handle = clean_twitter_handle(founder_twitter)
            if not handle and current_co_twitter:
                handle = clean_twitter_handle(current_co_twitter)

            if handle and current_company:
                # Split first/last name
                name_parts = founder_name.split() if founder_name else ["Founder"]
                first_name = name_parts[0] if name_parts else "Founder"
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

                # Craft custom hook
                hook_parts = []
                if current_tags:
                    hook_parts.append(current_tags)
                elif current_category:
                    hook_parts.append(current_category)
                if current_location:
                    hook_parts.append(f"in {current_location}")
                custom_hook = f"what you are building at {current_company} ({', '.join(hook_parts)})" if hook_parts else f"your work at {current_company}"

                founders_to_ingest.append({
                    "company": current_company,
                    "first_name": first_name,
                    "last_name": last_name,
                    "x_handle": handle,
                    "linkedin_url": founder_linkedin,
                    "website_url": current_website,
                    "custom_hook": custom_hook,
                    "location": current_location,
                    "category": current_category
                })

    print(f"Total founder profiles with valid X handles parsed: {len(founders_to_ingest)}")

    # Ingest into Neon DB
    inserted = 0
    updated = 0
    skipped = 0

    with Session(engine) as session:
        for f in founders_to_ingest:
            handle = f["x_handle"]
            email_placeholder = f"{handle.lower()}@x.founder"

            # Check if exists by x_handle or email
            existing = session.exec(select(Lead).where((Lead.x_handle == handle) | (Lead.email == email_placeholder))).first()
            if existing:
                # Update info if needed
                if not existing.company and f["company"]:
                    existing.company = f["company"]
                if not existing.custom_hook and f["custom_hook"]:
                    existing.custom_hook = f["custom_hook"]
                session.add(existing)
                updated += 1
            else:
                new_lead = Lead(
                    email=email_placeholder,
                    first_name=f["first_name"],
                    last_name=f["last_name"],
                    company=f["company"],
                    role="Founder / Co-Founder",
                    x_handle=handle,
                    linkedin_url=f["linkedin_url"] or None,
                    website_url=f["website_url"] or None,
                    custom_hook=f["custom_hook"],
                    notes=f"Google Sheet 1500+ Startups | Category: {f['category']} | Location: {f['location']}",
                    source="Founder Google Sheet (1500+)",
                    status="PENDING_DM"
                )
                session.add(new_lead)
                inserted += 1

            if (inserted + updated) >= limit:
                break

        session.commit()

    print(f"Neon DB Ingestion Complete: {inserted} inserted, {updated} updated into Neon DB!")

if __name__ == "__main__":
    ingest_founders(limit=300)
