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

YC_AI_TARGETS: List[Dict[str, Any]] = [
    # --- YC Talent / Recruiting Leads ---
    {
        "first_name": "Jacob",
        "last_name": "Arnall",
        "role": "Talent",
        "company": "Decagon",
        "email": "jacob@decagon.ai",
        "website_url": "https://decagon.ai",
        "custom_hook": "how Decagon orchestrates enterprise generative AI customer service agents handling complex workflows",
        "notes": "AI Engineer (YC W24 Talent)",
        "source": "YC AI Talent - Decagon",
        "is_recruiter": True
    },
    {
        "first_name": "Kevin",
        "last_name": "Doiron",
        "role": "Head of Talent Acquisition",
        "company": "Decagon",
        "email": "kevin@decagon.ai",
        "website_url": "https://decagon.ai",
        "custom_hook": "how Decagon scales conversational AI agents to autonomously handle enterprise customer operations",
        "notes": "AI Engineer (YC W24 Head of Talent)",
        "source": "YC AI Talent - Decagon",
        "is_recruiter": True
    },
    {
        "first_name": "Ryan",
        "last_name": "Kaabi",
        "role": "Talent",
        "company": "Cognition",
        "email": "ryan@cognition.ai",
        "website_url": "https://cognition.ai",
        "custom_hook": "how Cognition builds Devin to execute autonomous multi-file codebase navigation, test writing, and bug resolution",
        "notes": "AI Engineer (Cognition Talent)",
        "source": "YC AI Talent - Cognition",
        "is_recruiter": True
    },
    {
        "first_name": "Paul",
        "last_name": "Capano",
        "role": "Lead Technical Recruiter",
        "company": "Vapi",
        "email": "paul@vapi.ai",
        "website_url": "https://vapi.ai",
        "custom_hook": "how Vapi enables ultra low latency voice AI pipelines with real time audio streaming and sub-600ms conversational agents",
        "notes": "AI Engineer (YC W21 Recruiter)",
        "source": "YC AI Talent - Vapi",
        "is_recruiter": True
    },

    # --- YC Founders & Co-Founders ---
    {
        "first_name": "Alex",
        "last_name": "Reibman",
        "role": "Co-founder & CEO",
        "company": "AgentOps",
        "email": "alex@agentops.ai",
        "website_url": "https://agentops.ai",
        "custom_hook": "how AgentOps provides observability, session replay, and compliance guardrails for autonomous agent swarms in production",
        "notes": "AI Engineer (YC W24 Founder)",
        "source": "YC AI Founders - AgentOps",
        "is_recruiter": False
    },
    {
        "first_name": "Jordan",
        "last_name": "Dworkin",
        "role": "Co-founder",
        "company": "Vapi",
        "email": "jordan@vapi.ai",
        "website_url": "https://vapi.ai",
        "custom_hook": "how Vapi empowers developers to build and deploy lightning-fast conversational voice AI infrastructure",
        "notes": "AI Engineer (YC W21 Founder)",
        "source": "YC AI Founders - Vapi",
        "is_recruiter": False
    },
    {
        "first_name": "Amanda",
        "last_name": "Zhu",
        "role": "Co-founder",
        "company": "Recall.ai",
        "email": "amanda@recall.ai",
        "website_url": "https://recall.ai",
        "custom_hook": "how Recall.ai provides universal unified API infrastructure for meeting bots and real time conversational audio extraction",
        "notes": "AI Engineer (YC W22 Founder)",
        "source": "YC AI Founders - Recall.ai",
        "is_recruiter": False
    },
    {
        "first_name": "Pavel",
        "last_name": "Gertsberg",
        "role": "Co-founder & CEO",
        "company": "ClaimSorted",
        "email": "pavel@claimsorted.com",
        "website_url": "https://claimsorted.com",
        "custom_hook": "how ClaimSorted orchestrates multimodal LLM pipelines to automate complex insurance claims processing and adjudication",
        "notes": "AI Engineer (YC S24 Founder)",
        "source": "YC AI Founders - ClaimSorted",
        "is_recruiter": False
    },
    {
        "first_name": "German",
        "last_name": "Mikulski",
        "role": "Co-founder & CTO",
        "company": "ClaimSorted",
        "email": "german@claimsorted.com",
        "website_url": "https://claimsorted.com",
        "custom_hook": "your backend engineering and agentic workflows for automated insurance settlement and document parsing",
        "notes": "AI Engineer (YC S24 Founder)",
        "source": "YC AI Founders - ClaimSorted",
        "is_recruiter": False
    },
    {
        "first_name": "Raj",
        "last_name": "Patel",
        "role": "Founder",
        "company": "Human Archive",
        "email": "raj@humanarchive.ai",
        "website_url": "https://humanarchive.ai",
        "custom_hook": "how Human Archive captures high resolution real world interaction data to build frontier foundation models for physical AI",
        "notes": "AI Engineer (YC W26 Founder)",
        "source": "YC AI Founders - Human Archive",
        "is_recruiter": False
    },
    {
        "first_name": "Robert",
        "last_name": "Kim",
        "role": "Co-founder & CEO",
        "company": "Laminar",
        "email": "robert@lmnr.ai",
        "website_url": "https://lmnr.ai",
        "custom_hook": "how Laminar provides open source, high throughput tracing and automated evaluations for complex agent pipelines",
        "notes": "AI Engineer (YC S24 Founder)",
        "source": "YC AI Founders - Laminar",
        "is_recruiter": False
    },
    {
        "first_name": "Jeff",
        "last_name": "Hu",
        "role": "Co-founder & CEO",
        "company": "Momentic",
        "email": "jeff@momentic.ai",
        "website_url": "https://momentic.ai",
        "custom_hook": "how Momentic deploys multi-agent swarms to autonomously navigate and bug-bash web and mobile application flows",
        "notes": "AI Engineer (YC W24 Founder)",
        "source": "YC AI Founders - Momentic",
        "is_recruiter": False
    },
    {
        "first_name": "Scott",
        "last_name": "Wu",
        "role": "Co-founder & CEO",
        "company": "Cognition",
        "email": "scott@cognition.ai",
        "website_url": "https://cognition.ai",
        "custom_hook": "how Cognition pushes the frontiers of autonomous software engineering with Devin and long-horizon reasoning agents",
        "notes": "AI Engineer (Cognition Founder)",
        "source": "YC AI Founders - Cognition",
        "is_recruiter": False
    },
    {
        "first_name": "Walden",
        "last_name": "Yan",
        "role": "Co-founder",
        "company": "Cognition",
        "email": "walden@cognition.ai",
        "website_url": "https://cognition.ai",
        "custom_hook": "your team's focus on deep reasoning benchmarks and production sandbox architecture for AI developers",
        "notes": "AI Engineer (Cognition Founder)",
        "source": "YC AI Founders - Cognition",
        "is_recruiter": False
    },
    {
        "first_name": "Chris",
        "last_name": "Pedregal",
        "role": "Co-founder & CEO",
        "company": "Granola",
        "email": "chris@granola.ai",
        "website_url": "https://granola.ai",
        "custom_hook": "how Granola combines transcription with human-in-the-loop AI note synthesis directly into daily meeting workflows",
        "notes": "AI Engineer (Granola Founder)",
        "source": "YC AI Founders - Granola",
        "is_recruiter": False
    },
    {
        "first_name": "Sam",
        "last_name": "Stephenson",
        "role": "Co-founder & CTO",
        "company": "Granola",
        "email": "sam@granola.ai",
        "website_url": "https://granola.ai",
        "custom_hook": "your intuitive desktop architecture and real-time inference UX for professional meeting notes",
        "notes": "AI Engineer (Granola Founder)",
        "source": "YC AI Founders - Granola",
        "is_recruiter": False
    }
]

def build_custom_email_body(first_name: str, company: str, custom_hook: str, is_recruiter: bool = False) -> str:
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
    if is_recruiter:
        opening = f"I came across your work leading talent at {company} and was really impressed by {custom_hook}."
    else:
        opening = f"I came across {company} and was really impressed by {custom_hook}."

    body = (
        f"Hi {first_name},\n\n"
        f"{opening}\n\n"
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

def dispatch_yc_ai_founders():
    print(f"=== Starting Outreach for {len(YC_AI_TARGETS)} YC AI Founders & HR Leaders ===")
    print("NOTE: Resume attachment is strictly DISABLED (attach_resume=False).")
    print("NOTE: Bouncify strict deliverability check enforced on every lead.")

    created_lead_ids = []
    with Session(engine) as session:
        for item in YC_AI_TARGETS:
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
                print(f"Created Lead: [{lead.id}] {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>")
                created_lead_ids.append(lead.id)

    print(f"\nTotal targets in queue: {len(created_lead_ids)}\n")
    success_count = 0
    failure_count = 0
    skipped_count = 0

    with Session(engine) as session:
        for idx, lead_id in enumerate(created_lead_ids, 1):
            lead = session.get(Lead, lead_id)
            if not lead:
                continue

            if lead.status in (LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value):
                print(f"[{idx}/{len(created_lead_ids)}] Skipping {lead.email}: Already {lead.status}")
                skipped_count += 1
                continue

            # Live deliverability check via Bouncify
            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid"):
                print(f"[{idx}/{len(created_lead_ids)}] Deliverability check failed for {lead.email}: {verif.get('error')}")
                failure_count += 1
                continue

            is_recruiter = any(t.get("is_recruiter") for t in YC_AI_TARGETS if t["email"] == lead.email)
            if is_recruiter:
                subject = f"AI Engineer opportunities at {lead.company}: Praroop Anand"
            else:
                subject = f"AI Engineer for {lead.company}: Praroop Anand"

            body = build_custom_email_body(
                first_name=lead.first_name or "Team",
                company=lead.company or "your team",
                custom_hook=lead.custom_hook or "your recent product developments",
                is_recruiter=is_recruiter
            )

            print(f"[{idx}/{len(created_lead_ids)}] Sending to {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>...")
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
    print("YC AI Outreach Complete!")
    print(f"Total Targets: {len(created_lead_ids)}")
    print(f"Total Sent Successfully: {success_count}")
    print(f"Total Skipped (already contacted): {skipped_count}")
    print(f"Total Failed: {failure_count}")
    print("==========================================")

if __name__ == "__main__":
    dispatch_yc_ai_founders()
