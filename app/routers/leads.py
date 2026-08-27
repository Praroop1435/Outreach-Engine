from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select, func, or_, col
from typing import List, Optional
from datetime import datetime
import csv
import io

from app.db import get_session
from app.models import (
    Lead, LeadCreate, LeadUpdate, LeadRead, LeadDetail,
    SendEmailRequest, EmailPreviewRequest, ImportLeadsRequest,
    EmailTemplate, EmailMessage, LinkClick
)
from app.services.email_sender import send_email_to_lead, render_template
from app.services.sheet_importer import import_leads_from_csv

router = APIRouter(prefix="/api/leads", tags=["Leads"])

@router.get("", response_model=List[LeadRead])
def list_leads(
    session: Session = Depends(get_session),
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 200
):
    query = select(Lead)
    if status and status.upper() != "ALL":
        query = query.where(Lead.status == status.upper())
    if search:
        s = f"%{search.lower()}%"
        query = query.where(
            or_(
                col(Lead.email).ilike(s),
                col(Lead.first_name).ilike(s),
                col(Lead.last_name).ilike(s),
                col(Lead.company).ilike(s),
                col(Lead.role).ilike(s),
                col(Lead.notes).ilike(s)
            )
        )
    query = query.order_by(col(Lead.updated_at).desc()).offset(skip).limit(limit)
    leads = session.exec(query).all()

    # Enrich with message counts
    results = []
    for l in leads:
        msg_count = session.exec(
            select(func.count(EmailMessage.id)).where(EmailMessage.lead_id == l.id)
        ).one()
        read_obj = LeadRead(
            **l.model_dump(),
            message_count=msg_count
        )
        results.append(read_obj)
    return results

@router.post("", response_model=LeadRead)
def create_lead(lead_in: LeadCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Lead).where(Lead.email == lead_in.email.lower().strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="A contact with this email already exists.")
    
    lead = Lead(
        email=lead_in.email.lower().strip(),
        first_name=lead_in.first_name,
        last_name=lead_in.last_name,
        company=lead_in.company,
        role=lead_in.role,
        website_url=lead_in.website_url,
        linkedin_url=lead_in.linkedin_url,
        status=lead_in.status or "NOT_CONTACTED",
        custom_hook=lead_in.custom_hook,
        notes=lead_in.notes,
        source=lead_in.source or "Manual",
        follow_up_due_at=lead_in.follow_up_due_at
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return LeadRead(**lead.model_dump(), message_count=0)

@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    messages = session.exec(
        select(EmailMessage).where(EmailMessage.lead_id == lead_id).order_by(col(EmailMessage.sent_at).asc())
    ).all()
    clicks = session.exec(
        select(LinkClick).where(LinkClick.lead_id == lead_id).order_by(col(LinkClick.clicked_at).desc())
    ).all()
    return LeadDetail(
        **lead.model_dump(),
        message_count=len(messages),
        click_count=len(clicks),
        messages=messages,
        clicks=clicks
    )

@router.put("/{lead_id}", response_model=LeadRead)
def update_lead(lead_id: int, lead_in: LeadUpdate, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = lead_in.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(lead, key, val)
    
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    
    msg_count = session.exec(
        select(func.count(EmailMessage.id)).where(EmailMessage.lead_id == lead.id)
    ).one()
    return LeadRead(**lead.model_dump(), message_count=msg_count)

@router.delete("/{lead_id}")
def delete_lead(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    session.delete(lead)
    session.commit()
    return {"ok": True, "message": "Lead deleted successfully"}

@router.post("/preview")
def preview_email(req: EmailPreviewRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    rendered_subject = render_template(req.subject_template, lead)
    rendered_body = render_template(req.body_template, lead)
    return {
        "recipient": lead.email,
        "subject": rendered_subject,
        "body": rendered_body
    }

@router.post("/{lead_id}/send")
def send_email(lead_id: int, req: SendEmailRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    try:
        email_record = send_email_to_lead(
            session=session,
            lead=lead,
            subject=req.subject,
            body=req.body,
            attach_resume=req.attach_resume,
            enable_utm_tracking=req.enable_utm_tracking
        )
        return {
            "ok": True,
            "message": f"Email sent successfully to {lead.email}",
            "email_message_id": email_record.id,
            "status": lead.status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@router.post("/import")
def import_leads(req: ImportLeadsRequest, session: Session = Depends(get_session)):
    if req.csv_data:
        stats = import_leads_from_csv(session, req.csv_data)
        return {"ok": True, "stats": stats}
    elif req.leads:
        created = 0
        updated = 0
        for l in req.leads:
            existing = session.exec(select(Lead).where(Lead.email == l.email.lower().strip())).first()
            if not existing:
                new_lead = Lead(
                    email=l.email.lower().strip(),
                    first_name=l.first_name,
                    last_name=l.last_name,
                    company=l.company,
                    role=l.role,
                    custom_hook=l.custom_hook,
                    notes=l.notes,
                    status=l.status or "NOT_CONTACTED"
                )
                session.add(new_lead)
                created += 1
            else:
                if l.first_name: existing.first_name = l.first_name
                if l.last_name: existing.last_name = l.last_name
                if l.company: existing.company = l.company
                if l.role: existing.role = l.role
                if l.custom_hook: existing.custom_hook = l.custom_hook
                session.add(existing)
                updated += 1
        session.commit()
        return {"ok": True, "stats": {"created": created, "updated": updated}}
    else:
        raise HTTPException(status_code=400, detail="No CSV data or leads provided")

@router.get("/export/csv")
def export_csv(session: Session = Depends(get_session)):
    leads = session.exec(select(Lead).order_by(col(Lead.created_at).desc())).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Email", "First Name", "Last Name", "Company", "Role",
        "Status", "Custom Hook", "Notes", "Last Contacted At", "Created At"
    ])
    for l in leads:
        writer.writerow([
            l.email, l.first_name or "", l.last_name or "", l.company or "", l.role or "",
            l.status, l.custom_hook or "", l.notes or "",
            l.last_contacted_at.isoformat() if l.last_contacted_at else "",
            l.created_at.isoformat() if l.created_at else ""
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=outreach_leads.csv"}
    )
