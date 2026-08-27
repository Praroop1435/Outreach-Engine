from sqlmodel import SQLModel, create_engine, Session, select
from app.config import settings
from app.models import EmailTemplate

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Clear old templates first and commit
        old_templates = session.exec(select(EmailTemplate)).all()
        for ot in old_templates:
            session.delete(ot)
        session.commit()

        curated_templates = [
            EmailTemplate(
                name="Campus / Branch Bypass & Direct Application (Detailed)",
                subject_template="{{role}} application — Praroop Anand",
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
                name="Role Application & Project Showcase (Primary)",
                subject_template="{{role}} application — Praroop Anand",
                body_template="""Hi {{firstName}},

I came across {{company}}'s recruitment post and wanted to reach out regarding the {{role}} role.

I'm a full-stack engineer with strong experience building user-centric web applications and production AI systems. Recently,

I built AI Social Automate (https://aisocialautomate.com/), an autonomous multi-platform content engine with automated media generation and scheduled publishing pipelines.

I'm also building InsightFlow AI (https://portal.e360insurance.com/), an enterprise intelligence platform with robust FastAPI, PostgreSQL, Redis, and LLM agent pipelines operating in production.

I place a strong emphasis on clean architecture, intuitive UI, and reliable systems when building products.

You can find my work here:
• Portfolio: https://praroop.site
• GitHub: https://github.com/Praroop1435

I've attached my resume (Praroop_Anand.pdf) for your reference.

I'd be happy to share something more tailored or even build a small feature to demonstrate my approach if that would be helpful.

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
                name="X (Twitter) Direct Message Pitch",
                subject_template="X DM to @{{x_handle}}",
                body_template="Hi {{firstName}}, saw what you are building at {{company}}. I'm a full-stack engineer building AI Social Automate (https://aisocialautomate.com/) and InsightFlow AI (https://portal.e360insurance.com/). Portfolio: https://praroop.site | GitHub: https://github.com/Praroop1435. Attached my resume to email, and I'd be happy to build a small feature to demonstrate my approach if helpful!",
                category="X Direct Message"
            )
        ]
        for t in curated_templates:
            session.add(t)
        session.commit()

def get_session():
    with Session(engine) as session:
        yield session
