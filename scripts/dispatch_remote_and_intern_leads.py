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

REMOTE_AND_INTERN_LEADS = [
    {
        "first_name": "Aman",
        "last_name": "Agarwal",
        "role": "Co-Founder & CEO",
        "company": "Novaflow",
        "email": "aman@novaflowapp.com",
        "website_url": "https://novaflowapp.com",
        "custom_hook": "your AI-powered bioinformatics platform automating publication-ready data analysis for biology labs",
        "notes": "Software Engineer Intern (Remote)",
        "source": "YC S25 - Remote Internships"
    },
    {
        "first_name": "Gobhanu",
        "last_name": "Korisepati",
        "role": "Co-Founder & CEO",
        "company": "Vela",
        "email": "founders@tryvela.ai",
        "website_url": "https://tryvela.ai",
        "custom_hook": "your autonomous AI scheduling agents and multi-party calendar negotiation architecture",
        "notes": "Founding Engineer (Remote)",
        "source": "YC W26 - Remote Roles"
    },
    {
        "first_name": "Karim",
        "last_name": "Rahme",
        "role": "Co-Founder & CEO",
        "company": "Metorial",
        "email": "karim@metorial.com",
        "website_url": "https://metorial.com",
        "custom_hook": "your MCP infrastructure and unified developer platform for AI agent tool execution and tracing",
        "notes": "Backend Engineer (Remote)",
        "source": "YC F25 - Remote Roles"
    },
    {
        "first_name": "Abhimanyu",
        "last_name": "Yadav",
        "role": "Co-Founder & CEO",
        "company": "Trelium",
        "email": "abhimanyu@trelium.com",
        "website_url": "https://www.trelium.com",
        "custom_hook": "your natural language AI agents automating back-office order processing and enterprise supply chain workflows",
        "notes": "Founding Engineer (Remote)",
        "source": "YC F25 - Remote Roles"
    },
    {
        "first_name": "Vincent",
        "last_name": "Wei",
        "role": "Founder & CEO",
        "company": "SafeButler",
        "email": "vincent@safebutler.com",
        "website_url": "https://www.safebutler.com",
        "custom_hook": "your automated insurance comparison algorithms and consumer workflow automation platform",
        "notes": "Software Engineer Intern (Remote)",
        "source": "YC S17 - Remote Internships"
    },
    {
        "first_name": "Ravi",
        "last_name": "Bharihoke",
        "role": "Co-Founder & CEO",
        "company": "Enerjazz",
        "email": "ravi@enerjazz.tech",
        "website_url": "https://enerjazz.tech",
        "custom_hook": "your commercial EV battery-swapping network and real-time battery analytics platform",
        "notes": "Engineering Trainee (Internship)",
        "source": "YC S21 - Founder Internships"
    },
    {
        "first_name": "Tanmaay",
        "last_name": "K",
        "role": "Talent Lead",
        "company": "Apollo",
        "email": "talent@apollofirst.xyz",
        "website_url": "https://www.apollofirst.xyz",
        "custom_hook": "your Web3 payments and programmable loyalty infrastructure platform",
        "notes": "JS/Web3 Full Stack Engineer (Remote)",
        "source": "YC W22 - Remote Roles"
    },
    {
        "first_name": "Prateek",
        "last_name": "Swain",
        "role": "Co-Founder & CEO",
        "company": "Swadesh",
        "email": "prateek@swadesh.co",
        "website_url": "http://www.swadesh.co",
        "custom_hook": "your cross-border banking infrastructure and low-cost international remittance platform",
        "notes": "Senior Software Engineer (Backend - Remote)",
        "source": "YC W20 - Remote Roles"
    },
    {
        "first_name": "Mohammed",
        "last_name": "Roshan",
        "role": "Co-Founder & CEO",
        "company": "GoSats",
        "email": "roshan@gosats.io",
        "website_url": "https://gosats.io",
        "custom_hook": "your bitcoin rewards infrastructure and high-throughput cashback transaction pipeline",
        "notes": "Backend Engineer (Remote)",
        "source": "YC W22 - Remote Roles"
    },
    {
        "first_name": "Karam",
        "last_name": "Lakshman",
        "role": "Co-Founder & CEO",
        "company": "Wifi Dabba, Inc.",
        "email": "karam@dabba.com",
        "website_url": "https://dabba.com",
        "custom_hook": "your decentralized physical infrastructure network and low-cost broadband distribution architecture",
        "notes": "Blockchain Engineer (Remote)",
        "source": "YC W17 - Remote Roles"
    }
]

def dispatch_remote_and_intern_leads():
    print(f"=== Starting Ingestion & Outreach for {len(REMOTE_AND_INTERN_LEADS)} Remote & Intern Targets ===")

    created_lead_ids = []
    with Session(engine) as session:
        for item in REMOTE_AND_INTERN_LEADS:
            existing = session.exec(select(Lead).where(Lead.email == item["email"])).first()
            if existing:
                print(f"Lead already exists: {item['email']} (ID: {existing.id}, Status: {existing.status})")
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
        print("Remote & Intern Outreach Batch Complete!")
        print(f"Total Attempted: {len(created_lead_ids)}")
        print(f"Total Sent Successfully: {success_count}/{len(created_lead_ids)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_remote_and_intern_leads()
