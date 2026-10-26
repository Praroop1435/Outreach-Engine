from sqlmodel import SQLModel, create_engine, Session, select, func
from app.config import settings
from app.models import EmailTemplate

from sqlalchemy import event
from sqlalchemy.engine import Engine

# Normalize postgres URL for SQLAlchemy compatibility (e.g. from Neon or Render)
raw_db_url = settings.DATABASE_URL
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = "sqlite" in raw_db_url

engine = create_engine(
    raw_db_url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True,
    pool_recycle=300 if not is_sqlite else -1
)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Preserve user-created templates: only seed defaults if table is empty
        existing_count = session.exec(select(func.count(EmailTemplate.id))).one() or 0
        if existing_count > 0:
            return

        curated_templates = [
            EmailTemplate(
                name="Grounded Founder / AI Startup Pitch (Legit & Proof-First)",
                subject_template="Engineering & AI systems for {{company}}: Praroop Anand",
                body_template="""Hi {{firstName}},

I came across {{company}} and spent some time looking into {{custom_hook}}.

I am a full-stack engineer and AI automation developer (FastAPI, Next.js/TypeScript, PostgreSQL, Redis, Docker). Right now at Relu Consultancy, I build and maintain production AI workflows and backend systems for real client workloads, from RAG search engines and webhook integrations to automated agent pipelines.

A couple of production systems I have built:

• AI Social Automate (https://aisocialautomate.com/) | Loom demo: https://www.loom.com/share/f640c1a4815b424393261574b37d93b4 - Autonomous content engine with automated media pipelines and scheduled async task queues (Celery/Redis).
• InsightFlow AI (https://portal.e360insurance.com/) | Loom demo: https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799 - Production insurance intelligence platform with FastAPI, pgvector semantic retrieval (92% RAGAS benchmark), and Claude-powered assistant modules.

I focus on clean architecture, resilient async backends, and shipping code that holds up in production.

You can check out my work here:
• Portfolio: https://praroop.site
• GitHub: https://github.com/Praroop1435

I have attached my resume (Praroop_Anand.pdf) for quick reference. I would welcome the opportunity to connect and discuss open engineering roles.

Best regards,
Praroop""",
                category="Cold Outreach"
            ),
            EmailTemplate(
                name="Production Engineering Application (Direct & Legitimate)",
                subject_template="{{role}} application: Praroop Anand",
                body_template="""Hi {{firstName}},

I am writing to express my strong interest in full-stack engineering and AI automation opportunities at {{company}}.

I am an engineer with hands-on production experience across Python (FastAPI, Django), Next.js/TypeScript, PostgreSQL, Redis, and Docker. At Relu Consultancy, I actively develop client-facing AI workflows, RAG search engines, and backend automation pipelines in production.

Key projects highlighting my background:

• AI Social Automate (https://aisocialautomate.com/): Autonomous content engine featuring scheduled async queue pipelines, multi-platform publishing, and payment webhooks.
• InsightFlow AI (https://portal.e360insurance.com/): Enterprise intelligence platform with FastAPI, pgvector semantic search (40% latency reduction), and LLM agent modules.

I focus on clean architecture, intuitive UI, and resilient backend systems. You can view more of my work at:
• Portfolio: https://praroop.site
• GitHub: https://github.com/Praroop1435

My resume (Praroop_Anand.pdf) is attached for your review. I would welcome the opportunity to connect and discuss open engineering roles.

Thank you for your time and consideration.

Best regards,
Praroop Anand
+91-8210118421
anandpraroop@gmail.com""",
                category="Cold Outreach"
            ),
            EmailTemplate(
                name="Concise Cold DM / Quick Pitch (Founder & Social)",
                subject_template="Engineering & AI systems at {{company}}",
                body_template="""Hi {{firstName}},

Saw what you are building at {{company}} regarding {{custom_hook}}.

I'm a full-stack engineer & AI automation developer (FastAPI, Next.js, Redis, pgvector). At Relu Consultancy, I build production AI workflows and backend pipelines for real client workloads.

A couple of systems I shipped:
• AI Social Automate: https://aisocialautomate.com/ (async media & publishing engine)
• InsightFlow AI: https://portal.e360insurance.com/ (FastAPI + pgvector insurance SaaS)

Portfolio: https://praroop.site | GitHub: https://github.com/Praroop1435

Resume attached. If you have an active backlog feature or automation pipeline, I'd be glad to build a quick proof-of-concept to show how I work.

Best,
Praroop""",
                category="Cold Outreach"
            ),
            EmailTemplate(
                name="Campus / Branch Bypass & Direct Application (Detailed)",
                subject_template="{{role}} application: Praroop Anand",
                body_template="""Hi {{firstName}},

Your company recently visited my college for hiring, but the role was open only to CS students and I am from a non-CS branch, so I could not apply through the campus process. I am writing directly because I was genuinely interested in the role and wanted to put my work in front of you.

I am a full-stack engineer who works across Next.js, TypeScript, and FastAPI, with a focus on building real products end to end. A few things I have built recently:

• AI Social Automate (https://aisocialautomate.com/): an autonomous AI-powered content engine with multi-platform publishing, automated video/media rendering, and scheduling pipelines.

• InsightFlow AI (https://portal.e360insurance.com/): an enterprise intelligence platform with robust FastAPI, PostgreSQL, Redis, and LLM agent pipelines operating in production.

On the frontend side, I care a lot about visual hierarchy, custom component systems built from scratch, and clean, intuitive UI. On the backend, I design reliable REST APIs, work with Postgres/pgvector and Redis, and build scalable AI/vector retrieval workflows.

You can find more of my work here:
• Portfolio: https://praroop.site
• GitHub: https://github.com/Praroop1435

I have attached my resume (Praroop_Anand.pdf). If it would help, I am happy to build a small feature or prototype that reflects how I would approach a problem on your platform.

Looking forward to hearing from you.

Best regards,
Praroop""",
                category="Cold Outreach"
            ),
            EmailTemplate(
                name="Direct Founder / Engineering Pitch",
                subject_template="Engineering & AI systems for {{company}}",
                body_template="""Hi {{firstName}},

I came across {{company}} and spent some time looking into {{custom_hook}}.

I'm a full-stack & AI systems engineer. Recently, I built AI Social Automate (https://aisocialautomate.com/) and InsightFlow AI (https://portal.e360insurance.com/), focusing on high-performance backend pipelines and clean, user-centric interfaces.

You can find my work here:
• Portfolio: https://praroop.site
• GitHub: https://github.com/Praroop1435

I've attached my resume for your reference. I'd be glad to share more context or build a small feature to demonstrate how I'd approach problems for {{company}}.

Looking forward to hearing from you.
Best regards,
Praroop""",
                category="Cold Outreach"
            ),
            EmailTemplate(
                name="Follow-up (Polite & Direct)",
                subject_template="Re: {{role}} application for {{company}}",
                body_template="""Hi {{firstName}},

Following up quickly on my note from last week regarding {{company}} in case it got buried.

Happy to share more context, code examples, or build a small feature to demonstrate my approach if that would be helpful. My resume is attached for your reference.

Looking forward to hearing from you.
Best regards,
Praroop""",
                category="Follow-up"
            ),
            EmailTemplate(
                name="AI Engineer Application (Scalable Systems & Infrastructure)",
                subject_template="Application: {{job_role}} | Praroop Anand",
                body_template="""Hi {{firstName}},

I came across {{company}} and researched your work on {{custom_hook}}.

I am an AI Engineer focused on building infrastructure and scalable systems (FastAPI, Next.js/TypeScript, PostgreSQL, Redis, Docker). I am writing to apply for the {{job_role}} role at {{company}}.

Recent production systems I have built:
• AI Social Automate (https://aisocialautomate.com/) | Loom demo: https://www.loom.com/share/f640c1a4815b424393261574b37d93b4
  Autonomous media generation engine with async task queues.
• InsightFlow AI (https://portal.e360insurance.com/) | Loom demo: https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799
  Enterprise intelligence platform with pgvector semantic retrieval.

Portfolio: https://praroop.site | GitHub: https://github.com/Praroop1435

My resume is attached for your review. I would welcome the opportunity to connect and discuss open engineering roles.

Best regards,
Praroop Anand
+91-8210118421
anandpraroop@gmail.com""",
                category="Job Application"
            )
        ]
        for t in curated_templates:
            session.add(t)
        session.commit()

def get_session():
    with Session(engine) as session:
        yield session
