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

TEXTBACKDOOR_AI_BATCH: List[Dict[str, Any]] = [
    {
        "first_name": "Sagnik",
        "last_name": "Ghosh",
        "role": "Founder & CEO",
        "company": "Autter",
        "email": "sagnik@autter.dev",
        "website_url": "https://autter.dev",
        "custom_hook": "how Autter builds merge-gate assurance and automated release governance for AI-generated code",
        "notes": "Backend Engineer (Agentic AI) | Remote (Pacific time / Global)",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Backend Engineer (Agentic AI)"
    },
    {
        "first_name": "Saksham",
        "last_name": "Aggarwal",
        "role": "Co-founder & CEO",
        "company": "Cardboard",
        "email": "founders@cardboard.ai",
        "website_url": "https://cardboard.ai",
        "custom_hook": "how Cardboard builds autonomous agentic video editing and timeline orchestration workflows",
        "notes": "Backend Engineer / Product Engineer (Fullstack) | Bengaluru & SF (YC W26)",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Backend / Product Engineer"
    },
    {
        "first_name": "Salo",
        "last_name": "Serfati",
        "role": "Co-founder & CEO",
        "company": "Chariot",
        "email": "salo@givechariot.com",
        "website_url": "https://givechariot.com",
        "custom_hook": "how Chariot powers DAFpay payment infrastructure and automated financial workflows for donor-advised funds",
        "notes": "Applied AI Engineer / Backend Engineer | NYC / Remote (YC W23)",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Applied AI Engineer"
    },
    {
        "first_name": "Lara",
        "last_name": "Chelak",
        "role": "Founder",
        "company": "Codespeed",
        "email": "lara@codespeed.ai",
        "website_url": "https://codespeed.ai",
        "custom_hook": "how Codespeed builds high-agency engineering tooling and autonomous AI coding systems",
        "notes": "Founding Engineer | New York / Remote",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Founding Engineer"
    },
    {
        "first_name": "Kyum",
        "last_name": "Kim",
        "role": "Co-founder & Executive",
        "company": "Concurrence",
        "email": "kyum@concurrence.com",
        "website_url": "https://concurrence.com",
        "custom_hook": "how Concurrence trains health world models and deploys clinical AI agents to unify EHR systems",
        "notes": "AI Deployment Strategist / Head of Engineering | SF / NYC / Remote",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "AI Deployment Strategist / Engineer"
    },
    {
        "first_name": "Elvoro",
        "last_name": "Team",
        "role": "Founding Team",
        "company": "Elvoro",
        "email": "contact@elvoro.com",
        "website_url": "https://elvoro.com",
        "custom_hook": "how Elvoro builds agentic marketing workflows and responsive Next.js application architectures",
        "notes": "Full-Stack Web Developer (Next.js) | Remote Global",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Full-Stack Web Developer (Next.js / AI)"
    },
    {
        "first_name": "Alfred",
        "last_name": "Johnson",
        "role": "Co-founder & CEO",
        "company": "Crux",
        "email": "alfred@cruxclimate.com",
        "website_url": "https://cruxclimate.com",
        "custom_hook": "how Crux builds AI diligence engines and financial structuring platforms for clean energy transition credits",
        "notes": "AI Product Engineer | Remote",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "AI Product Engineer"
    },
    {
        "first_name": "Ryan",
        "last_name": "Daniels",
        "role": "Co-founder & CEO",
        "company": "Crosby",
        "email": "ryan@crosby.ai",
        "website_url": "https://crosby.ai",
        "custom_hook": "how Crosby deploys AI-native document intelligence and automated commercial agreement review pipelines",
        "notes": "Applied Operations / AI Engineer | NYC / Remote",
        "source": "TextBackdoor Startup Hiring Directory",
        "target_role": "Applied Operations / AI Engineer"
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
    print("=" * 70)
    print("PREVIEW OF TEXTBACKDOOR FOUNDER OUTREACH EMAILS")
    print("=" * 70)
    for idx, target in enumerate(TEXTBACKDOOR_AI_BATCH, 1):
        target_role = target.get("target_role", "AI Engineer")
        subject = f"{target_role} for {target['company']}: Praroop Anand"
        body = build_custom_email_body(
            first_name=target["first_name"],
            company=target["company"],
            custom_hook=target["custom_hook"]
        )
        print(f"\n--- [{idx}/{len(TEXTBACKDOOR_AI_BATCH)}] {target['company']} ---")
        print(f"To: {target['first_name']} {target['last_name']} ({target['role']}) <{target['email']}>")
        print(f"Target Role: {target_role} | Location/Type: {target['notes']}")
        print(f"Website: {target['website_url']}")
        print(f"Subject: {subject}")
        print("\nBody:")
        print(body)
        print("-" * 70)

def ingest_leads_into_db() -> List[int]:
    created_or_found_ids = []
    with Session(engine) as session:
        for item in TEXTBACKDOOR_AI_BATCH:
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
    print(f"\n=== Running TextBackdoor Outreach Batch (dry_run={dry_run}) ===")
    lead_ids = ingest_leads_into_db()
    
    with Session(engine) as session:
        for idx, lead_id in enumerate(lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            target_info = next((t for t in TEXTBACKDOOR_AI_BATCH if t["email"] == lead.email), None)
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
