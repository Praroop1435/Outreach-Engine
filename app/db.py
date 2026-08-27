from sqlmodel import SQLModel, create_engine, Session, select
from app.config import settings
from app.models import EmailTemplate

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

def init_db():
    SQLModel.metadata.create_all(engine)
    # Seed default templates if none exist
    with Session(engine) as session:
        existing = session.exec(select(EmailTemplate)).first()
        if not existing:
            default_templates = [
                EmailTemplate(
                    name="Initial Cold Outreach",
                    subject_template="Building AI systems that work in production for {{company}}",
                    body_template="Hi {{firstName}},\n\nI came across {{company}} and noticed your work on {{custom_hook}}.\n\nI specialize in building reliable GenAI pipelines, production agent infrastructure, and end-to-end full stack AI integrations.\n\nWould you be open to a brief 10-minute chat this week to explore if there might be any synergy?\n\nBest regards,\nPraroop Anand\nGitHub: github.com/Praroop1435",
                    category="Cold Outreach"
                ),
                EmailTemplate(
                    name="Follow-up #1 (Value Add)",
                    subject_template="Re: AI infrastructure for {{company}}",
                    body_template="Hi {{firstName}},\n\nFollowing up quickly on my previous note. I put together a few ideas on how {{company}} could optimize production AI agent workflows.\n\nLet me know if you have a few minutes for a quick sync this week.\n\nBest,\nPraroop",
                    category="Follow-up"
                ),
                EmailTemplate(
                    name="Follow-up #2 (Check-in)",
                    subject_template="Quick check-in - {{company}}",
                    body_template="Hi {{firstName}},\n\nI know things get busy, so I just wanted to bubble this up to the top of your inbox.\n\nIf now is not a good time, no worries at all!\n\nBest,\nPraroop",
                    category="Follow-up"
                )
            ]
            for t in default_templates:
                session.add(t)
            session.commit()

def get_session():
    with Session(engine) as session:
        yield session
