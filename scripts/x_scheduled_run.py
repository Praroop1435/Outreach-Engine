"""One scheduled X session: the X Radar scan, then the DM check. launchd starts it 4 times a day.

launchd also fires a missed time when the Mac wakes up, so this skips anything outside 12 PM to 2 AM or
too close to the last session. It starts a random few minutes late so the times aren't exact.

    .venv/bin/python scripts/x_scheduled_run.py          # what launchd runs
    .venv/bin/python scripts/x_scheduled_run.py --check  # say if a session would run now, touch nothing
"""
import argparse
import json
import random
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE_FILE = Path.home() / ".outreach" / "x_schedule.json"
MIN_GAP = timedelta(hours=3)
MAX_START_DELAY_SECONDS = 15 * 60
PAUSE_BETWEEN_JOBS_SECONDS = (60, 180)


def in_window(now: datetime) -> bool:
    return now.hour >= 12 or now.hour < 2


def skip_reason(now: datetime) -> str | None:
    if not in_window(now):
        return "outside 12 PM to 2 AM"
    try:
        last = datetime.fromisoformat(json.loads(STATE_FILE.read_text())["last_run"])
    except (OSError, ValueError, KeyError):
        return None
    if now - last < MIN_GAP:
        return f"last session was at {last:%H:%M}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    reason = skip_reason(datetime.now())
    if args.check:
        print(f"Would skip: {reason}" if reason else "Would run")
        return
    if reason:
        print(f"{datetime.now():%Y-%m-%d %H:%M} Skipping: {reason}", flush=True)
        return

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"last_run": datetime.now().isoformat()}))
    time.sleep(random.randint(0, MAX_START_DELAY_SECONDS))

    print(f"{datetime.now():%Y-%m-%d %H:%M} X session starting", flush=True)
    subprocess.run([sys.executable, str(ROOT / "scripts" / "x_job_monitor.py")], cwd=ROOT)
    time.sleep(random.randint(*PAUSE_BETWEEN_JOBS_SECONDS))
    subprocess.run([sys.executable, str(ROOT / "scripts" / "x_dm_sync.py")], cwd=ROOT)
    print(f"{datetime.now():%Y-%m-%d %H:%M} X session finished", flush=True)


if __name__ == "__main__":
    main()
