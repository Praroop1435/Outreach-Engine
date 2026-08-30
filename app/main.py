from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
import asyncio
from sqlmodel import Session
from app.db import init_db, engine
from app.services.mailbox_sync import sync_mailbox
from app.routers import leads, templates, sync, analytics, twitter, resume, tracking, linkedin

async def background_mailbox_sync_loop():
    """Runs automatic background IMAP sync every 5 minutes to detect replies & bounces."""
    while True:
        try:
            await asyncio.sleep(300)
            if settings.GMAIL_USER and settings.GMAIL_APP_PASSWORD:
                with Session(engine) as session:
                    sync_mailbox(session, max_messages=50)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Background Mailbox Sync Error]: {e}")
            await asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    sync_task = asyncio.create_task(background_mailbox_sync_loop())
    yield
    sync_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    description="Personal Outreach Engine REST API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(leads.router)
app.include_router(templates.router)
app.include_router(sync.router)
app.include_router(analytics.router)
app.include_router(twitter.router)
app.include_router(linkedin.router)
app.include_router(resume.router)
app.include_router(tracking.router)

@app.get("/")
def root():
    return {"message": "Personal Outreach Engine API is running", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
