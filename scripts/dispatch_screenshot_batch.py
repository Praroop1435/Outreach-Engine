import os
import sys
import time
from typing import List, Dict, Any

project_root = "/Users/praroopanand/Realm/Code/Personal Outrech"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlmodel import Session, select
from app.db import engine
from app.models import Lead, EmailTemplate, LeadStatus
from app.services.email_sender import send_email_to_lead, render_template
from app.services.email_verifier import verify_email_deliverability

SCREENSHOT_NEW_LEADS = [
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Talent Lead",
        "company": "Codevolt",
        "email": "codevolt07@gmail.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your analytics pipelines and business intelligence reporting workflows",
        "notes": "Data Analyst Intern (Remote)",
        "source": "CarrerLift - Screenshot Batch"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Tech Lead",
        "company": "Xeroscape",
        "email": "info@xeroscape.in",
        "website_url": "https://xeroscape.in",
        "custom_hook": "your computer vision architectures and generative AI model deployment pipelines",
        "notes": "AI/ML Intern (Remote)",
        "source": "CarrerLift - Screenshot Batch"
    },
    {
        "first_name": "Tanusha",
        "last_name": "Musunuru",
        "role": "Hiring Lead",
        "company": "KREEV",
        "email": "musunurutanusha@gmail.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your applied AI systems and scalable automation architecture",
        "notes": "AI Engineering Intern (Remote)",
        "source": "CarrerLift - Screenshot Batch"
    },
    {
        "first_name": "Ashish",
        "last_name": "Jha",
        "role": "Analytics Lead",
        "company": "MythoQuantum Explorers",
        "email": "ashishjha@mythoquantum.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your data analytics infrastructure and quantitative exploratory research engines",
        "notes": "Data Analytics Intern (Remote)",
        "source": "CarrerLift - Screenshot Batch"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Talent Lead",
        "company": "FOUR17",
        "email": "work@four17.in",
        "website_url": "https://four17.in",
        "custom_hook": "your web development workflows and digital experience architecture",
        "notes": "WordPress Developer Intern (Remote)",
        "source": "CarrerLift - Screenshot Batch"
    }
]

def dispatch_screenshot_batch():
    print("=== Starting Outreach Dispatch for Screenshot Batch & SuperKalam ===")

    # Step 1: Update SuperKalam leads
    target_lead_ids = []
    with Session(engine) as session:
        sk_leads = session.exec(select(Lead).where(Lead.id.in_([91, 92]))).all()
        for sk in sk_leads:
            sk.notes = "AI Applied Intern (+PPO)"
            sk.custom_hook = "your conversational AI mentor and voice-first personalized learning agent architecture"
            sk.status = LeadStatus.NOT_CONTACTED.value
            session.add(sk)
            target_lead_ids.append(sk.id)
            print(f"Prepared SuperKalam Lead [{sk.id}] {sk.first_name} {sk.last_name} <{sk.email}>")
        session.commit()

        # Step 2: Ingest new leads from screenshot
        for item in SCREENSHOT_NEW_LEADS:
            existing = session.exec(select(Lead).where(Lead.email == item["email"])).first()
            if existing:
                print(f"Lead already exists: {item['email']} (ID: {existing.id})")
                target_lead_ids.append(existing.id)
            else:
                lead = Lead(
                    first_name=item["first_name"],
                    last_name=item["last_name"],
                    role=item["role"],
                    company=item["company"],
                    email=item["email"],
                    website_url=item["website_url"],
                    custom_hook=item["custom_hook"],
                    notes=item["notes"],
                    source=item["source"],
                    status=LeadStatus.NOT_CONTACTED.value
                )
                session.add(lead)
                session.commit()
                session.refresh(lead)
                print(f"Created Lead: [{lead.id}] {lead.first_name} {lead.last_name} ({lead.company}) <{lead.email}>")
                target_lead_ids.append(lead.id)

    # Step 3: Fetch template
    with Session(engine) as session:
        tpl = session.exec(
            select(EmailTemplate)
            .where(EmailTemplate.name.like("%AI Engineer Application%"))
            .order_by(EmailTemplate.id.desc())
        ).first()

        if not tpl:
            raise RuntimeError("Could not find the AI Engineer Application template.")

        print(f"\nUsing Template: [{tpl.id}] {tpl.name}")
        print(f"Template Subject: {tpl.subject_template}")
        print(f"Total targets in queue: {len(target_lead_ids)}\n")

        success_count = 0
        failure_count = 0

        for idx, lead_id in enumerate(target_lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            if lead.status == LeadStatus.CONTACTED.value:
                print(f"[{idx}/{len(target_lead_ids)}] Skipping {lead.email}: Already CONTACTED")
                continue

            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid"):
                print(f"[{idx}/{len(target_lead_ids)}] Deliverability check failed for {lead.email}: {verif.get('error')}")
                failure_count += 1
                continue

            subject = render_template(tpl.subject_template, lead)
            body = render_template(tpl.body_template, lead)

            print(f"[{idx}/{len(target_lead_ids)}] Sending to {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>...")
            print(f"   Subject: {subject}")
            print(f"   Target Role: {lead.notes}")

            try:
                msg_record = send_email_to_lead(
                    session=session,
                    lead=lead,
                    subject=subject,
                    body=body,
                    attach_resume=True,
                    enable_utm_tracking=True
                )
                success_count += 1
                print(f"   [SUCCESS] Email sent! Message ID: {msg_record.id} (Status updated to CONTACTED)")
            except Exception as e:
                failure_count += 1
                print(f"   [FAILED] Could not send to {lead.email}: {e}")

            if idx < len(target_lead_ids):
                time.sleep(2.5)

        print("\n==========================================")
        print("Screenshot Batch Outreach Complete!")
        print(f"Total Targets: {len(target_lead_ids)}")
        print(f"Total Sent Successfully: {success_count}/{len(target_lead_ids)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_screenshot_batch()
