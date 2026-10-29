"""Remove Sent Mail sync duplicates of emails the app already logged.

The old IMAP sync dropped the Date header's timezone, so Gmail's Pacific-time copy of each
app-sent email was stored a second time, 7-8 hours earlier. For every lead + subject pair,
this keeps the app's record (correct UTC time), copies the Gmail Message-ID onto it,
and deletes the shifted copy. Deleted rows are backed up to data/archive first.

Run: uv run python scripts/dedupe_sent_messages.py          (dry run)
     uv run python scripts/dedupe_sent_messages.py --apply
"""
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select

from app.db import engine
from app.models import EmailDirection, EmailMessage, MessageChannel

OFFSETS = [timedelta(hours=7), timedelta(hours=8)]  # PDT / PST
TOLERANCE = timedelta(minutes=3)


def main(apply: bool):
    with Session(engine) as session:
        sent = session.exec(
            select(EmailMessage).where(
                EmailMessage.direction == EmailDirection.SENT.value,
                EmailMessage.channel == MessageChannel.EMAIL.value,
            )
        ).all()

        groups = defaultdict(list)
        for m in sent:
            groups[(m.lead_id, m.subject)].append(m)

        to_delete = []
        for msgs in groups.values():
            msgs.sort(key=lambda m: m.sent_at)
            used = set()
            for later in reversed(msgs):
                if later.id in used:
                    continue
                for earlier in msgs:
                    if earlier.id in used or earlier.id == later.id:
                        continue
                    gap = later.sent_at - earlier.sent_at
                    if any(abs(gap - off) <= TOLERANCE for off in OFFSETS):
                        if not later.message_id and earlier.message_id:
                            later.message_id = earlier.message_id
                            session.add(later)
                        to_delete.append(earlier)
                        used.update({earlier.id, later.id})
                        break

        print(f"{len(sent)} sent email records, {len(to_delete)} shifted duplicates, {len(sent) - len(to_delete)} real sends")
        if not apply:
            print("Dry run. Re-run with --apply to delete them.")
            return

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        archive_dir = os.path.join(base_dir, "data", "archive")
        os.makedirs(archive_dir, exist_ok=True)
        backup_path = os.path.join(archive_dir, f"sent_duplicates_{datetime.now():%Y%m%d_%H%M%S}.json")
        with open(backup_path, "w") as f:
            json.dump([m.model_dump(mode="json") for m in to_delete], f, indent=2, ensure_ascii=False)
        print(f"Backed up to {backup_path}")

        for m in to_delete:
            session.delete(m)
        session.commit()
        print(f"Deleted {len(to_delete)} duplicates")


if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
