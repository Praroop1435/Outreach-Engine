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

NEW_STARTUP_FINDER_LEADS = [
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Engineering Team",
        "company": "Superset",
        "email": "team@superset.sh",
        "website_url": "https://superset.sh",
        "custom_hook": "how you enable developers to orchestrate and run hundreds of coding agents in parallel inside Superset",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Stilta",
        "email": "founders@stilta.com",
        "website_url": "https://stilta.com",
        "custom_hook": "your agentic AI workflows for intellectual property and automated patent litigation intelligence",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Andrew",
        "last_name": "",
        "role": "Founder",
        "company": "Tasklet",
        "email": "andrew@tasklet.ai",
        "website_url": "https://tasklet.ai",
        "custom_hook": "how Tasklet connects AI agents directly into workplace tools to execute real tasks instead of basic conversational chat",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Minicor",
        "email": "connect@minicor.com",
        "website_url": "https://minicor.com",
        "custom_hook": "how Minicor bridges modern AI agents with legacy desktop applications that lack native APIs",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Salus",
        "email": "founders@usesalus.ai",
        "website_url": "https://usesalus.ai",
        "custom_hook": "your evaluation layer and safety guardrails to keep autonomous production agents from misfiring on real tasks",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Lab0",
        "email": "founders@lab0.ai",
        "website_url": "https://lab0.ai",
        "custom_hook": "your agentic approach to solving enterprise software rollouts and automated system implementations",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Waddle Labs",
        "email": "founders@waddlelabs.ai",
        "website_url": "https://waddlelabs.ai",
        "custom_hook": "your foundation models and agent control systems for physical robotics",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Rational",
        "email": "founders@rational.to",
        "website_url": "https://rational.to",
        "custom_hook": "how you build fully autonomous AI employees to handle end to end accounting and bookkeeping pipelines",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Ooak Data",
        "email": "contact@ooakdata.com",
        "website_url": "https://ooakdata.com",
        "custom_hook": "how Ooak Data transforms internal company data into sandbox environments to evaluate and train AI agents",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Runtime",
        "email": "founders@runtm.com",
        "website_url": "https://runtm.com",
        "custom_hook": "your agent runtime for mission critical payment flows, ledger reconciliation, and fintech automation",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Sitefire",
        "email": "info@sitefire.ai",
        "website_url": "https://sitefire.ai",
        "custom_hook": "how Sitefire builds the optimization and discovery layer for brands to reach autonomous AI agents",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Luca IQ",
        "email": "hello@lucaiq.com",
        "website_url": "https://lucaiq.com",
        "custom_hook": "your deterministic tax calculation API and automated e-filing infrastructure",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Revnu",
        "email": "founders@revnu.com",
        "website_url": "https://revnu.com",
        "custom_hook": "how Revnu automates deep buyer research and outbound pipeline execution for founders",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Elyra",
        "email": "hello@elyrasystems.com",
        "website_url": "https://elyrasystems.com",
        "custom_hook": "your real time voice and reservation agent infrastructure for restaurants",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Engineering Team",
        "company": "Atrisa",
        "email": "careers@atrisa.ai",
        "website_url": "https://atrisa.ai",
        "custom_hook": "your multi-agent systems for debugging and automating complex analog circuit design",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Asendia AI",
        "email": "connect@asendia.ai",
        "website_url": "https://asendia.ai",
        "custom_hook": "how Asendia builds AI agents to automate candidate sourcing and top of funnel recruiting workflows",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Multimodal Team",
        "company": "Hub",
        "email": "hello@hub.xyz",
        "website_url": "https://hub.xyz",
        "custom_hook": "your multimodal data pipelines and real world datasets for robotics and frontier model training",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Founding Team",
        "company": "Payna",
        "email": "hello@payna.com",
        "website_url": "https://payna.com",
        "custom_hook": "your agentic automation platform for regulatory licensing and compliance filings",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Team",
        "last_name": "",
        "role": "Robotics Team",
        "company": "DeepReach Inc.",
        "email": "info@deepreach.ai",
        "website_url": "https://deepreach.ai",
        "custom_hook": "how DeepReach builds large scale real world data pipelines for physical AI and embodied models",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    },
    {
        "first_name": "Founders",
        "last_name": "",
        "role": "Founders",
        "company": "Polymath",
        "email": "founders@polymathlabs.ai",
        "website_url": "https://polymathlabs.ai",
        "custom_hook": "your research and dataset architecture focused on long horizon agent capabilities and alignment",
        "notes": "AI Engineer (Startup Finder)",
        "source": "Startup Finder Dashboard - Batch 2"
    }
]

def build_custom_email_body(first_name: str, company: str, custom_hook: str) -> str:
    """
    Builds personalized email strictly complying with:
    - No em dashes (—)
    - No en dashes (–)
    - No spaced hyphens ( - )
    - No resume attached
    - Two Loom video demos included
    - Portfolio link (https://praroop.site)
    - Positioned as AI Engineer
    - CTA asking for a quick chat or small trial assignment/task
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
        f"+91-8210118421\n"
        f"anandpraroop@gmail.com"
    )

    # Strict compliance assertions
    for forbidden in ["\u2014", "\u2013", " - "]:
        if forbidden in body:
            raise ValueError(f"Forbidden dash character '{forbidden}' found in email body!")

    return body

def dispatch_startup_finder_batch2():
    print(f"=== Starting Ingestion & Outreach for {len(NEW_STARTUP_FINDER_LEADS)} Startup Finder Batch 2 Leads ===")
    print("NOTE: Resume attachment is DISABLED per instructions (attach_resume=False).")

    created_lead_ids = []
    with Session(engine) as session:
        for item in NEW_STARTUP_FINDER_LEADS:
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
                print(f"Created Lead: [{lead.id}] {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>")
                created_lead_ids.append(lead.id)

    print(f"\nTotal targets in queue: {len(created_lead_ids)}\n")
    success_count = 0
    failure_count = 0

    with Session(engine) as session:
        for idx, lead_id in enumerate(created_lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            if lead.status == LeadStatus.CONTACTED.value:
                print(f"[{idx}/{len(created_lead_ids)}] Skipping {lead.email}: Already CONTACTED")
                continue

            # Live deliverability check via Bouncify
            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid"):
                print(f"[{idx}/{len(created_lead_ids)}] Deliverability check failed for {lead.email}: {verif.get('error')}")
                failure_count += 1
                continue

            subject = f"AI Engineer for {lead.company}: Praroop Anand"
            body = build_custom_email_body(
                first_name=lead.first_name or "Team",
                company=lead.company or "your team",
                custom_hook=lead.custom_hook or "your recent product developments"
            )

            print(f"[{idx}/{len(created_lead_ids)}] Sending to {lead.first_name} ({lead.company}) <{lead.email}>...")
            print(f"   Subject: {subject}")
            print(f"   Verifier: {verif.get('verifier')} ({verif.get('bouncify_status', 'ok')})")

            try:
                msg_record = send_email_to_lead(
                    session=session,
                    lead=lead,
                    subject=subject,
                    body=body,
                    attach_resume=False,
                    enable_utm_tracking=True
                )
                success_count += 1
                print(f"   [SUCCESS] Email sent! Message ID: {msg_record.id} (Status updated to CONTACTED)")
            except Exception as e:
                failure_count += 1
                print(f"   [FAILED] Could not send to {lead.email}: {e}")

            # Safe throttle between Gmail SMTP dispatches
            if idx < len(created_lead_ids):
                time.sleep(2.5)

    print("\n==========================================")
    print("Startup Finder Batch 2 Outreach Complete!")
    print(f"Total Targets: {len(created_lead_ids)}")
    print(f"Total Sent Successfully: {success_count}/{len(created_lead_ids)}")
    print(f"Total Failed: {failure_count}")
    print("==========================================")

if __name__ == "__main__":
    dispatch_startup_finder_batch2()
