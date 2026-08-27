from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, col
from typing import List
from datetime import datetime

from app.db import get_session
from app.models import EmailTemplate, EmailTemplateCreate, EmailTemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["Templates"])

@router.get("", response_model=List[EmailTemplate])
def list_templates(session: Session = Depends(get_session)):
    templates = session.exec(select(EmailTemplate).order_by(col(EmailTemplate.created_at).asc())).all()
    return templates

@router.post("", response_model=EmailTemplate)
def create_template(tmpl_in: EmailTemplateCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(EmailTemplate).where(EmailTemplate.name == tmpl_in.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A template with this name already exists.")
    
    tmpl = EmailTemplate(
        name=tmpl_in.name,
        subject_template=tmpl_in.subject_template,
        body_template=tmpl_in.body_template,
        category=tmpl_in.category or "Cold Outreach"
    )
    session.add(tmpl)
    session.commit()
    session.refresh(tmpl)
    return tmpl

@router.put("/{template_id}", response_model=EmailTemplate)
def update_template(template_id: int, tmpl_in: EmailTemplateUpdate, session: Session = Depends(get_session)):
    tmpl = session.get(EmailTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = tmpl_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(tmpl, key, val)
    
    session.add(tmpl)
    session.commit()
    session.refresh(tmpl)
    return tmpl

@router.delete("/{template_id}")
def delete_template(template_id: int, session: Session = Depends(get_session)):
    tmpl = session.get(EmailTemplate, template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    session.delete(tmpl)
    session.commit()
    return {"ok": True, "message": "Template deleted"}
