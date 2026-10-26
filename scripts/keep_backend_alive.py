import time
import requests
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
LOG_FILE = PROJECT_ROOT / "data" / "keep_alive.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

RENDER_HEALTH_URL = "https://outreach-engine-h5lx.onrender.com/health"
RENDER_CRON_URL = "https://outreach-engine-h5lx.onrender.com/api/sync/cron"

def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def run_pinger():
    log("Keep-Alive & Cronjob Daemon started.")
    iteration = 0
    while True:
        iteration += 1
        # 1. Health ping (every iteration, ~4 mins)
        try:
            r = requests.get(RENDER_HEALTH_URL, timeout=30)
            log(f"Health Ping (Render): HTTP {r.status_code} | {r.text[:60]}")
        except Exception as e:
            log(f"Health Ping Error: {e}")

        # 2. Sync Cron ping (every 2nd iteration, ~8-10 mins)
        if iteration % 2 == 0:
            try:
                r_cron = requests.get(RENDER_CRON_URL, timeout=90)
                log(f"Cron Mailbox Sync Ping: HTTP {r_cron.status_code} | {r_cron.text[:120]}")
            except Exception as e:
                log(f"Cron Mailbox Sync Error: {e}")

        # Sleep 4 minutes (240s) to prevent Render from ever spinning down (timeout is 15 min)
        time.sleep(240)

if __name__ == "__main__":
    run_pinger()
