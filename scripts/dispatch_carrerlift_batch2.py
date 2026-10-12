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

NEW_REMOTE_INTERNSHIPS = [
    {
        "first_name": "Talent",
        "last_name": "Team",
        "role": "Hiring Lead",
        "company": "Persist Ventures",
        "email": "careers@persistventures.com",
        "website_url": "https://persistventures.com",
        "custom_hook": "your AI video recommendation engines and venture studio product experiments",
        "notes": "AI Video Recommendations Intern (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    },
    {
        "first_name": "Ali",
        "last_name": "Hassan",
        "role": "Hiring Lead",
        "company": "Stealth AI Startup",
        "email": "Rana.ali.hassan1311@gmail.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your generative AI models and intelligent agent automation workflows",
        "notes": "AI Intern (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Tech Lead",
        "company": "MediNex Workforce",
        "email": "careers@arohnexus.com",
        "website_url": "https://arohnexus.com",
        "custom_hook": "your healthcare workforce digital platforms and high-reliability backend pipelines",
        "notes": "Junior Software Engineer Intern (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    },
    {
        "first_name": "Engineering",
        "last_name": "Team",
        "role": "Engineering Lead",
        "company": "House of X",
        "email": "contact@houseofx.in",
        "website_url": "https://houseofx.in",
        "custom_hook": "your creator-led commerce technology platforms and high-scale consumer brand infrastructure",
        "notes": "SDE Intern (+PPO) (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    },
    {
        "first_name": "Data",
        "last_name": "Team",
        "role": "Data Lead",
        "company": "Desinary",
        "email": "desinary.info@gmail.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your data science pipelines and predictive machine learning models",
        "notes": "Data Science Intern (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    },
    {
        "first_name": "Research",
        "last_name": "Team",
        "role": "Research Lead",
        "company": "The Finance Focus",
        "email": "thefinancefocus@gmail.com",
        "website_url": "https://carrerlift.in",
        "custom_hook": "your quantitative financial intelligence and automated research analytics workflows",
        "notes": "Research Analyst Intern (Remote)",
        "source": "CarrerLift - Remote Internships Page 2"
    }
]

def dispatch_batch2():
    print(f"=== Starting Ingestion & Outreach for {len(NEW_REMOTE_INTERNSHIPS)} CarrerLift Batch 2 Leads ===")

    created_lead_ids = []
    with Session(engine) as session:
        for item in NEW_REMOTE_INTERNSHIPS:
            existing = session.exec(select(Lead).where(Lead.email == item["email"])).first()
            if existing:
                print(f"Lead already exists: {item['email']} (ID: {existing.id})")
                created_lead_ids.append(existing.id)
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
                created_lead_ids.append(lead.id)

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
        print(f"Total targets in queue: {len(created_lead_ids)}\n")

        success_count = 0
        failure_count = 0

        for idx, lead_id in enumerate(created_lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            if lead.status == LeadStatus.CONTACTED.value:
                print(f"[{idx}/{len(created_lead_ids)}] Skipping {lead.email}: Already CONTACTED")
                continue

            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid"):
                print(f"[{idx}/{len(created_lead_ids)}] Deliverability check failed for {lead.email}: {verif.get('error')}")
                failure_count += 1
                continue

            subject = render_template(tpl.subject_template, lead)
            body = render_template(tpl.body_template, lead)

            print(f"[{idx}/{len(created_lead_ids)}] Sending to {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>...")
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

            if idx < len(created_lead_ids):
                time.sleep(2.5)

        print("\n==========================================")
        print("CarrerLift Batch 2 Outreach Complete!")
        print(f"Total Targets: {len(created_lead_ids)}")
        print(f"Total Sent Successfully: {success_count}/{len(created_lead_ids)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_batch2()
