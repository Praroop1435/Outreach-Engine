import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.db import get_session
from app.models import XJobPost, XJobStatus, XScanRun
from app.services.x_job_filter import MATCH_THRESHOLD

router = APIRouter(prefix="/api/x-jobs", tags=["X Radar"])


class XJobStatusUpdate(BaseModel):
    status: XJobStatus


def _serialize(p: XJobPost) -> dict:
    data = p.model_dump()
    data["links"] = json.loads(p.links_json or "[]")
    data["tags"] = [t for t in (p.tags or "").split(",") if t]
    data.pop("links_json", None)
    return data


@router.get("")
def list_x_jobs(
    status: Optional[str] = Query(None, description="NEW, SAVED, APPLIED, DISMISSED or ALL"),
    min_score: int = MATCH_THRESHOLD,
    limit: int = Query(200, le=500),
    session: Session = Depends(get_session),
):
    q = select(XJobPost).where(XJobPost.score >= min_score)
    if status and status != "ALL":
        q = q.where(XJobPost.status == status)
    q = q.order_by(XJobPost.score.desc(), XJobPost.posted_at.desc()).limit(limit)
    return [_serialize(p) for p in session.exec(q).all()]


@router.get("/summary")
def x_jobs_summary(session: Session = Depends(get_session)):
    counts = dict(session.exec(
        select(XJobPost.status, func.count(XJobPost.id)).where(XJobPost.score >= MATCH_THRESHOLD).group_by(XJobPost.status)
    ).all())
    last = session.exec(select(XScanRun).order_by(XScanRun.started_at.desc()).limit(1)).first()
    last_ok = session.exec(
        select(XScanRun).where(XScanRun.error.is_(None), XScanRun.finished_at.is_not(None)).order_by(XScanRun.started_at.desc()).limit(1)
    ).first()
    return {
        "counts": {s.value: counts.get(s.value, 0) for s in XJobStatus},
        "last_run": last.model_dump() if last else None,
        "last_success_at": last_ok.finished_at if last_ok else None,
        "match_threshold": MATCH_THRESHOLD,
    }


@router.patch("/{post_id}")
def update_x_job(post_id: int, body: XJobStatusUpdate, session: Session = Depends(get_session)):
    post = session.get(XJobPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.status = body.status.value
    session.add(post)
    session.commit()
    session.refresh(post)
    return _serialize(post)
