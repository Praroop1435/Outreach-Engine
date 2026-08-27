from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import leads, templates, sync, analytics, twitter

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

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

@app.get("/")
def root():
    return {"message": "Personal Outreach Engine API is running", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
