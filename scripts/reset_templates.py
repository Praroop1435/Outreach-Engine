"""Replace every template in the database with app/email_templates.py.

Old templates are backed up to data/archive/templates_backup_<timestamp>.json first.
Run: uv run python scripts/reset_templates.py
"""
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select

from app.db import engine
from app.email_templates import DEFAULT_TEMPLATES
from app.models import EmailTemplate


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    archive_dir = os.path.join(base_dir, "data", "archive")
    os.makedirs(archive_dir, exist_ok=True)

    with Session(engine) as session:
        old = session.exec(select(EmailTemplate)).all()
        backup_path = os.path.join(archive_dir, f"templates_backup_{datetime.now():%Y%m%d_%H%M%S}.json")
        with open(backup_path, "w") as f:
            json.dump([t.model_dump(mode="json") for t in old], f, indent=2, ensure_ascii=False)
        print(f"Backed up {len(old)} templates to {backup_path}")

        for t in old:
            session.delete(t)
        session.commit()

        for t in DEFAULT_TEMPLATES:
            session.add(EmailTemplate(**t))
        session.commit()
        print(f"Inserted {len(DEFAULT_TEMPLATES)} new templates")


if __name__ == "__main__":
    main()
