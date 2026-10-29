from sqlmodel import SQLModel, create_engine, Session, select, func
from app.config import settings
from app.models import EmailTemplate
from app.email_templates import DEFAULT_TEMPLATES

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

        for t in DEFAULT_TEMPLATES:
            session.add(EmailTemplate(**t))
        session.commit()

def get_session():
    with Session(engine) as session:
        yield session
