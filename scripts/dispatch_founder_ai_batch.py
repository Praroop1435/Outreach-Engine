import os
import sys
import time
from typing import List, Dict, Any

project_root = "/Users/praroopanand/Realm/Code/Personal Outrech"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlmodel import Session, select
from app.db import engine
from app.models import Lead, LeadStatus
from app.services.email_sender import send_email_to_lead
from app.services.email_verifier import verify_email_deliverability

AI_STARTUPS_BATCH: List[Dict[str, Any]] = [
    {
        "first_name": "Naveen",
        "last_name": "Baskaran",
        "role": "Co-founder & CEO",
        "company": "Planso",
        "email": "naveen@planso.co",
        "website_url": "https://planso.co",
        "custom_hook": "how Planso automates architectural layout generation and decision intelligence workflows for the AEC industry",
        "notes": "Junior AI Engineer (Bengaluru)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Junior AI Engineer"
    },
    {
        "first_name": "Kabilan",
        "last_name": "Seenivasagan",
        "role": "Founder & CEO",
        "company": "SmaranAI",
        "email": "hr@smaranai.in",
        "website_url": "https://smaranai.in",
        "custom_hook": "your work building autonomous agentic workflows and multilingual digital knowledge preservation systems",
        "notes": "Agentic AI Intern",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Agentic AI Intern"
    },
    {
        "first_name": "Krishna",
        "last_name": "Nagpal",
        "role": "Founder",
        "company": "Latitude54",
        "email": "krishna@latitude-54.com",
        "website_url": "https://latitude-54.com",
        "custom_hook": "how Latitude54 architects real-time autonomous aerial systems and defense intelligence pipelines",
        "notes": "Founding AI/ML (Delhi / Remote)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Founding AI/ML"
    },
    {
        "first_name": "Shiv",
        "last_name": "Sakhuja",
        "role": "Co-founder & CEO",
        "company": "Athina AI",
        "email": "shiv@athina.ai",
        "website_url": "https://athina.ai",
        "custom_hook": "how Athina AI provides production-grade LLM evaluation harnesses, prompt experimentation, and continuous regression testing",
        "notes": "Founding Engineer (YC W23 Evals)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Founding Engineer"
    },
    {
        "first_name": "Waeez",
        "last_name": "Ameer",
        "role": "Founder & CEO",
        "company": "Variabl",
        "email": "waeez@deepnetlabs.com",
        "website_url": "https://variabl.in",
        "custom_hook": "how Variabl powers automated financial operations and intelligent bookkeeping for independents through Maya AI",
        "notes": "Full-Stack AI Engineer (Bengaluru)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Full-Stack AI Engineer"
    },
    {
        "first_name": "Abhishek",
        "last_name": "Anbu",
        "role": "Co-founder & CEO",
        "company": "Zynnex AI",
        "email": "official@zynnex.in",
        "website_url": "https://zynnex.in",
        "custom_hook": "how Zynnex deploys real-time conversational voice agents for KYC onboarding, loan servicing, and collections in BFSI",
        "notes": "Founding AI Engineer (Bengaluru)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "Founding AI Engineer"
    },
    {
        "first_name": "Tushar",
        "last_name": "Bhatnagar",
        "role": "Founder & CEO",
        "company": "Alpha AI",
        "email": "tushar@alphaai.biz",
        "website_url": "https://alphaai.biz",
        "custom_hook": "how Alpha AI builds tailored enterprise AI architectures, custom SLMs, and autonomous agent orchestration pipelines",
        "notes": "AI Engineer (Pune)",
        "source": "Founder Outreach - AI Startups Batch",
        "target_role": "AI Engineer"
    }
]

def build_custom_email_body(first_name: str, company: str, custom_hook: str) -> str:
    """
    Builds personalized email strictly complying with:
    - No em dashes (\u2014)
    - No en dashes (\u2013)
    - No spaced hyphens ( - )
    - No resume attached
    - Two Loom video demos included
    - Portfolio link (https://praroop.site)
    - Positioned as AI Engineer
    - Small, simple, and human
    """
    body = (
        f"Hi {first_name},\n\n"
        f"I came across {company} and was really impressed by {custom_hook}.\n\n"
        f"I am an AI Engineer building production agent workflows and scalable backend systems "
        f"(FastAPI, Next.js, PostgreSQL, Redis, Docker). Right now at Relu Consultancy, I ship client AI systems "
        f"ranging from RAG search engines to autonomous async task queues.\n\n"
        f"Here are quick Loom walkthroughs of two production systems I built:\n"
        f"• AI Social Automate: https://www.loom.com/share/f640c1a4815b424393261574b37d93b4 (automated media generation and scheduling engine)\n"
        f"• InsightFlow AI: https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799 (enterprise intelligence platform with pgvector semantic search)\n\n"
        f"You can view my portfolio here: https://praroop.site\n\n"
        f"Could we jump on a brief 10-minute chat this week, or could you share a small trial assignment or feature to build so I can demonstrate how I work?\n\n"
        f"Best regards,\n"
        f"Praroop Anand\n"
        f"+91 8210118421\n"
        f"anandpraroop@gmail.com"
    )

    # Strict compliance assertions: strictly forbid em-dash, en-dash, spaced hyphen
    for forbidden in ["\u2014", "\u2013", " - "]:
        if forbidden in body:
            raise ValueError(f"Forbidden dash character '{forbidden}' found in email body!")

    return body

def preview_all_emails():
    print("=" * 60)
    print("PREVIEW OF ALL PREPARED FOUNDER OUTREACH EMAILS")
    print("=" * 60)
    for idx, target in enumerate(AI_STARTUPS_BATCH, 1):
        target_role = target.get("target_role", "AI Engineer")
        subject = f"{target_role} for {target['company']}: Praroop Anand"
        body = build_custom_email_body(
            first_name=target["first_name"],
            company=target["company"],
            custom_hook=target["custom_hook"]
        )
        print(f"\n--- [{idx}/{len(AI_STARTUPS_BATCH)}] {target['company']} ---")
        print(f"To: {target['first_name']} {target['last_name']} ({target['role']}) <{target['email']}>")
        print(f"Target Role: {target_role} | Location/Type: {target['notes']}")
        print(f"Website: {target['website_url']}")
        print(f"Subject: {subject}")
        print("\nBody:")
        print(body)
        print("-" * 60)

def ingest_leads_into_db() -> List[int]:
    created_or_found_ids = []
    with Session(engine) as session:
        for item in AI_STARTUPS_BATCH:
            existing = session.exec(select(Lead).where(Lead.email == item["email"])).first()
            if existing:
                print(f"Lead exists in DB: {item['email']} (ID: {existing.id}, Status: {existing.status})")
                created_or_found_ids.append(existing.id)
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
                print(f"Created Lead: [{lead.id}] {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>")
                created_or_found_ids.append(lead.id)
    return created_or_found_ids

def dispatch_batch(dry_run: bool = True):
    print(f"\n=== Running Outreach Batch (dry_run={dry_run}) ===")
    lead_ids = ingest_leads_into_db()
    
    with Session(engine) as session:
        for idx, lead_id in enumerate(lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            target_info = next((t for t in AI_STARTUPS_BATCH if t["email"] == lead.email), None)
            target_role = target_info.get("target_role", "AI Engineer") if target_info else "AI Engineer"
            subject = f"{target_role} for {lead.company}: Praroop Anand"
            body = build_custom_email_body(
                first_name=lead.first_name or "Team",
                company=lead.company or "your team",
                custom_hook=lead.custom_hook or "your recent product developments"
            )

            print(f"\n[{idx}/{len(lead_ids)}] Target: {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>")
            print(f"   Subject: {subject}")

            if dry_run:
                print("   [DRY-RUN] Email validated. Skipping actual SMTP dispatch.")
                continue

            if lead.status == LeadStatus.INVALID_EMAIL.value:
                lead.status = LeadStatus.NOT_CONTACTED.value
                session.add(lead)
                session.commit()
                session.refresh(lead)

            if lead.status in (LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value):
                print(f"   [SKIP] Lead already {lead.status}")
                continue

            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid") and verif.get("bouncify_status") == "undeliverable":
                print(f"   [ABORT] Deliverability hard failed: {verif.get('error')}")
                continue

            try:
                msg_record = send_email_to_lead(
                    session=session,
                    lead=lead,
                    subject=subject,
                    body=body,
                    attach_resume=False,
                    enable_utm_tracking=True,
                    allow_catchall=True
                )
                print(f"   [SUCCESS] Dispatched! Message ID: {msg_record.id}")
            except Exception as e:
                print(f"   [FAILED] {e}")

            time.sleep(2.5)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true", help="Print all prepared email bodies and details")
    parser.add_argument("--send", action="store_true", help="Execute actual dispatch")
    args = parser.parse_args()

    if args.send:
        dispatch_batch(dry_run=False)
    else:
        preview_all_emails()
        ingest_leads_into_db()
