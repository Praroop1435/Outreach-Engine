import os
import sys
import time
from typing import List, Dict, Any

project_root = "/Users/praroopanand/Realm/Code/Personal Outrech"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlmodel import Session, select
from app.db import engine
from app.models import Lead, EmailTemplate, LeadStatus
from app.services.email_sender import send_email_to_lead, render_template
from app.services.email_verifier import verify_email_deliverability

def dispatch_startup_finder_leads():
    print("=== Starting Outreach Dispatch for Startup Finder Leads (IDs 93 to 107) ===")

    with Session(engine) as session:
        leads = session.exec(
            select(Lead)
            .where(Lead.id >= 93)
            .where(Lead.id <= 107)
            .where(Lead.status == LeadStatus.NOT_CONTACTED.value)
            .order_by(Lead.id)
        ).all()

        if not leads:
            print("No pending NOT_CONTACTED leads found in range 93-107.")
            return

        tpl = session.exec(
            select(EmailTemplate)
            .where(EmailTemplate.name.like("%AI Engineer Application%"))
            .order_by(EmailTemplate.id.desc())
        ).first()

        if not tpl:
            raise RuntimeError("Could not find the AI Engineer Application template.")

        print(f"Using Template: [{tpl.id}] {tpl.name}")
        print(f"Template Subject: {tpl.subject_template}")
        print(f"Total targets in queue: {len(leads)}\n")

        success_count = 0
        failure_count = 0

        for idx, lead in enumerate(leads, 1):
            # Pre-flight deliverability check
            verif = verify_email_deliverability(lead.email)
            if not verif.get("valid"):
                print(f"[{idx}/{len(leads)}] Deliverability check failed for {lead.email}: {verif.get('error')}")
                failure_count += 1
                continue

            subject = render_template(tpl.subject_template, lead)
            body = render_template(tpl.body_template, lead)

            print(f"[{idx}/{len(leads)}] Sending to {lead.first_name} {lead.last_name or ''} ({lead.company}) <{lead.email}>...")
            print(f"   Subject: {subject}")
            print(f"   Target Role: {lead.notes}")

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
                print(f"   [SUCCESS] Email sent! Message ID: {msg_record.id} (Status updated to CONTACTED)")
            except Exception as e:
                failure_count += 1
                print(f"   [FAILED] Could not send to {lead.email}: {e}")

            # Safe throttle between Gmail SMTP dispatches
            if idx < len(leads):
                time.sleep(2.5)

        print("\n==========================================")
        print("Startup Finder Outreach Dispatch Complete!")
        print(f"Total Queue: {len(leads)}")
        print(f"Total Sent Successfully: {success_count}/{len(leads)}")
        print(f"Total Failed: {failure_count}")
        print("==========================================")

if __name__ == "__main__":
    dispatch_startup_finder_leads()
