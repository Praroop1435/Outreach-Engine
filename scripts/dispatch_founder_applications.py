import os
import sys
import time

project_root = "/Users/praroopanand/Realm/Code/Personal Outrech"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlmodel import Session, select
from app.db import engine
from app.models import Lead, EmailTemplate
from app.services.email_sender import send_email_to_lead, render_template
from app.services.email_verifier import verify_email_deliverability

def dispatch_founder_applications():
    print("Starting automated email dispatch for targeted startup founders & CTOs...")
    with Session(engine) as session:
        leads = session.exec(
            select(Lead)
            .where(Lead.status == "NOT_CONTACTED")
            .where(Lead.id >= 69)
            .order_by(Lead.id)
        ).all()

        if not leads:
            print("No NOT_CONTACTED leads found.")
            return

        tpl = session.exec(
            select(EmailTemplate)
            .where(EmailTemplate.name.like("%AI Engineer Application%"))
            .order_by(EmailTemplate.id.desc())
        ).first()

        if not tpl:
            raise RuntimeError("Could not find the AI Engineer Application template.")

        print(f"Using Template: [{tpl.id}] {tpl.name}")
        print(f"Total recipients in queue: {len(leads)}\n")

        success_count = 0
        failure_count = 0

        for i, lead in enumerate(leads, 1):
            subject = render_template(tpl.subject_template, lead)
            body = render_template(tpl.body_template, lead)

            print(f"[{i}/{len(leads)}] Sending to {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>...")
            try:
                msg_record = send_email_to_lead(
                    session=session,
                    lead=lead,
                    subject=subject,
                    body=body,
                    attach_resume=True,
                    enable_utm_tracking=True
                )
                success_count += 1
                print(f"   [SUCCESS] Message recorded with ID: {msg_record.id} (Status updated to CONTACTED)")
            except Exception as e:
                failure_count += 1
                print(f"   [FAILED] Could not send to {lead.email}: {e}")

            # Safe throttle between Gmail SMTP dispatches
            if i < len(leads):
                time.sleep(2.5)

        print("\n==========================================")
        print(f"Batch dispatch completed!")
        print(f"Total Sent Successfully: {success_count}/{len(leads)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_founder_applications()
