import os
import sys
import time
from typing import List, Dict, Any

project_root = "/Users/praroopanand/Realm/Code/Personal Outrech"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# pyrefly: ignore [missing-import]
from sqlmodel import Session, select
from app.db import engine
from app.models import Lead, EmailTemplate, LeadStatus
from app.services.email_sender import send_email_to_lead, render_template
from app.services.email_verifier import verify_email_deliverability

CARRERLIFT_INTERNSHIPS = [
    {
        "first_name": "Lisha",
        "last_name": "Chouhan",
        "role": "Hiring Lead",
        "company": "Fundamento",
        "email": "lisha@getfundamento.com",
        "website_url": "https://fundamento.ai",
        "custom_hook": "your autonomous AI agent workforce platform and enterprise generative AI integration architecture",
        "notes": "Forward Deployed Engineer (FDE) Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Saranga",
        "last_name": "Gamage",
        "role": "Tech Lead",
        "company": "Emojot",
        "email": "sarangag@emojot.com",
        "website_url": "https://emojot.com",
        "custom_hook": "your customer intelligence platform and real-time sentiment analysis sensors",
        "notes": "AI and Full Stack Developer Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Aswin",
        "last_name": "Vinod",
        "role": "Founder & CEO",
        "company": "Yukimi",
        "email": "careers@yukimi.io",
        "website_url": "https://yukimi.io",
        "custom_hook": "your conversational AI companion platform and multi-modal user engagement engine",
        "notes": "Full Stack Developer Intern - MERN Stack (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Aman",
        "last_name": "Arora",
        "role": "Co-Founder & CEO",
        "company": "Heizen",
        "email": "aman@heizen.work",
        "website_url": "https://www.heizen.work",
        "custom_hook": "your AI-native software delivery engine and multi-agent code orchestration workflows",
        "notes": "SDE Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Amar",
        "last_name": "Krishna",
        "role": "Founder & CEO",
        "company": "Matrice AI",
        "email": "amar@matrice.ai",
        "website_url": "https://matrice.ai",
        "custom_hook": "your modular Vision AI Factory architecture and real-time industrial computer vision models",
        "notes": "AI/ML Engineering Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Surojit",
        "last_name": "Chatterjee",
        "role": "Founder & CEO",
        "company": "Ema",
        "email": "surojit@ema.co",
        "website_url": "https://www.ema.ai",
        "custom_hook": "your universal AI employee operating system and enterprise agentic integration architecture",
        "notes": "AI Resident (Intern) (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Lekha",
        "last_name": "Padmaram",
        "role": "Director",
        "company": "aiqon",
        "email": "info@aiqon.in",
        "website_url": "https://aiqon.in",
        "custom_hook": "your emerging technology education platform and frontier AI research initiatives",
        "notes": "AI / Software Engineering Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Talent Lead",
        "company": "WEM Studios",
        "email": "careers@wemstudios.in",
        "website_url": "https://wemstudios.in",
        "custom_hook": "your digital product engineering pipelines and high-concurrency backend services",
        "notes": "Backend Developer (Node.js) - Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "Talent Lead",
        "company": "CodeArrest Softwares",
        "email": "apply@codearrest.com",
        "website_url": "https://codearrest.com",
        "custom_hook": "your scalable custom web application development and cloud software engineering services",
        "notes": "Software Developer Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    },
    {
        "first_name": "Hiring",
        "last_name": "Team",
        "role": "HR Lead",
        "company": "Help Study Abroad",
        "email": "hr@helpstudyabroad.com",
        "website_url": "https://helpstudyabroad.com",
        "custom_hook": "your global education advisory portal and student workflow automation platform",
        "notes": "MERN Full Stack Developer Intern (Remote)",
        "source": "CarrerLift - Remote Internships"
    }
]

def dispatch_carrerlift_internships():
    print(f"=== Starting Ingestion & Outreach for {len(CARRERLIFT_INTERNSHIPS)} CarrerLift Internships ===")

    created_lead_ids = []
    with Session(engine) as session:
        for item in CARRERLIFT_INTERNSHIPS:
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
        print("CarrerLift Internship Outreach Batch Complete!")
        print(f"Total Attempted: {len(created_lead_ids)}")
        print(f"Total Sent Successfully: {success_count}/{len(created_lead_ids)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_carrerlift_internships()
