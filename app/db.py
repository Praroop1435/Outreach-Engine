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
        # Check if templates need update or creation
        templates_count = len(session.exec(select(EmailTemplate)).all())
        if templates_count < 4:
            # Clear old and seed high-converting genuine templates
            old_templates = session.exec(select(EmailTemplate)).all()
            for ot in old_templates:
                session.delete(ot)

            curated_templates = [
                EmailTemplate(
                    name="Engineering & AI Outreach (Production Systems)",
                    subject_template="Building AI systems that work in production for {{company}}",
                    body_template="Hi {{firstName}},\n\nI came across {{company}} and spent some time looking into {{custom_hook}}.\n\nWhat caught my attention is that you are solving a problem I often run into while building AI systems: getting them to work reliably with real data, real workflows, and production scale rather than just a demo.\n\nMy background is in backend engineering and applied AI. I specialize in building production-grade FastAPI, PostgreSQL/pgvector, Redis, and Celery pipelines along with reliable LLM agent workflows and RAG evaluation systems.\n\nI have attached my resume (Praroop_Anand.pdf) and included my work below:\n\nPortfolio: https://praroop.site\nGitHub: https://github.com/Praroop1435\nAI Social Automate: https://aisocialautomate.com/\nInsightFlow AI: https://portal.e360insurance.com/\n\nIf you have a few minutes this week, I would be glad to connect and see if there is a mutual fit.\n\nBest regards,\nPraroop Anand",
                    category="Cold Outreach"
                ),
                EmailTemplate(
                    name="Founder & Tech Lead Direct Note",
                    subject_template="{{company}} engineering and AI infrastructure",
                    body_template="Hi {{firstName}},\n\nSaw what you are building at {{company}} regarding {{custom_hook}}.\n\nI am a backend and AI engineer specializing in scalable Python/FastAPI microservices, vector search pipelines, and agent tooling. I have built backend architectures processing hundreds of automated pipelines daily.\n\nI have attached my resume and linked my work below. Would be great to connect briefly if you are exploring additions to the engineering team.\n\nPortfolio: https://praroop.site\nGitHub: https://github.com/Praroop1435\n\nBest,\nPraroop Anand",
                    category="Cold Outreach"
                ),
                EmailTemplate(
                    name="Follow-up (Brief and Direct)",
                    subject_template="Re: {{company}} engineering",
                    body_template="Hi {{firstName}},\n\nFollowing up quickly on my note from last week in case it got buried.\n\nHappy to share more context or code examples from recent production projects if helpful. Resume is attached for convenience.\n\nBest,\nPraroop",
                    category="Follow-up"
                ),
                EmailTemplate(
                    name="X (Twitter) Direct Message Pitch",
                    subject_template="X DM to @{{x_handle}}",
                    body_template="Hi {{firstName}}, saw your work at {{company}} on {{custom_hook}}. I am a backend and AI engineer (FastAPI, pgvector, Redis, agent pipelines). Built production systems like AI Social Automate and InsightFlow AI. Portfolio: https://praroop.site | GitHub: https://github.com/Praroop1435. Would love to connect if you are open to a brief chat!",
                    category="X Direct Message"
                )
            ]
            for t in curated_templates:
                session.add(t)
            session.commit()

def get_session():
    with Session(engine) as session:
        yield session
