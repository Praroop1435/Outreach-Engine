"""Background X job monitor: scrolls your X home feed, scores posts, stores matches for the dashboard's X Radar page.

Scrolls the For you and Following tabs of x.com/home in its own minimized Brave window (your
logged-in X session), so no server or RDP is needed, only an awake Mac. scripts/x_scheduled_run.py runs it 4 times a day:

    .venv/bin/python scripts/x_job_monitor.py            # one scan now
    .venv/bin/python scripts/x_job_monitor.py --dry-run  # score and print, write nothing

Truncated posts ("Show more") that look promising are opened once to score the full text.
Strong new matches pop a macOS notification.
"""
import argparse
import fcntl
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from sqlmodel import Session, select  # noqa: E402

from app.db import engine  # noqa: E402
from app.models import Lead, XJobPost, XScanRun  # noqa: E402
from app.services.x_job_filter import MATCH_THRESHOLD, NOTIFY_THRESHOLD, extract_pay, score_post  # noqa: E402
from x_job_scan import EXTRACT_JS, close_window, navigate, open_hidden_window, run_js  # noqa: E402

LOCK_FILE = Path("/tmp/x_job_monitor.lock")
HOME_URL = "https://x.com/home"
FEED_TABS = ["For you", "Following"]
KEEP_SCORE = 2          # store anything this promising so it is not re-expanded every run
MAX_EXPANSIONS = 12     # full-text fetches per run, each costs ~6s

FULL_TEXT_JS = r"""
(() => {
  const art = document.querySelector("article[data-testid='tweet']");
  const t = art && art.querySelector("div[data-testid='tweetText']");
  return t ? t.innerText : "";
})()
"""


def notify(title: str, message: str):
    subprocess.run(["osascript", "-e", f"display notification {json.dumps(message)} with title {json.dumps(title)} sound name \"Glass\""],
                   capture_output=True)


SELECT_TAB_JS = r"""
(() => {
  const tab = [...document.querySelectorAll("[role='tab']")].find(t => t.innerText.trim() === %s);
  if (!tab) return "missing";
  tab.click();
  window.scrollTo(0, 0);
  return "ok";
})()
"""


def scan(scrolls: int, since: datetime) -> tuple[dict[str, dict], str]:
    seen: dict[str, dict] = {}
    win = open_hidden_window(HOME_URL)
    try:
        time.sleep(7)
        if "login" in run_js(win, "location.href"):
            raise RuntimeError("X is not logged in in Brave")
        for tab in FEED_TABS:
            if run_js(win, SELECT_TAB_JS % json.dumps(tab)) != "ok":
                print(f"{tab}: tab not found, skipped", flush=True)
                continue
            time.sleep(5)
            for _ in range(scrolls + 1):
                for post in json.loads(run_js(win, EXTRACT_JS) or "[]"):
                    posted = parse_time(post.get("posted"))
                    if post["url"] and post["url"] not in seen and (posted is None or posted >= since):
                        post["query"] = "home:" + tab.lower().replace(" ", "_")
                        seen[post["url"]] = post
                run_js(win, "window.scrollBy(0, 2200); true")
                time.sleep(2.5)
            print(f"{tab}: {len(seen)} posts so far", flush=True)
        run_js(win, SELECT_TAB_JS % json.dumps(FEED_TABS[0]))  # X remembers the last tab; leave yours as it was
        return seen, win
    except Exception:
        close_window(win)
        raise


def expand(win: str, posts: list[dict]):
    for post in posts[:MAX_EXPANSIONS]:
        navigate(win, post["url"])
        time.sleep(6)
        full = run_js(win, FULL_TEXT_JS)
        if full and len(full) > len(post["text"]):
            post["text"] = full


def rescore_new(session: Session):
    """Applies the current rules to posts still waiting in NEW, so rule fixes also clean up old results."""
    for post in session.exec(select(XJobPost).where(XJobPost.status == "NEW")).all():
        score, tags = score_post(post.text)
        if score != post.score or ",".join(tags) != post.tags:
            post.score, post.tags = score, ",".join(tags)
            session.add(post)


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scrolls", type=int, default=15, help="Scrolls per feed tab")
    ap.add_argument("--days", type=int, default=3, help="Ignore feed posts older than this")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("Another scan is running, skipping.")
        return

    since = datetime.utcnow() - timedelta(days=args.days)
    with Session(engine) as session:
        run = XScanRun()
        if not args.dry_run:
            session.add(run)
            session.commit()
            session.refresh(run)

        win = None
        try:
            seen, win = scan(args.scrolls, since)
            known = set(session.exec(select(XJobPost.url).where(XJobPost.url.in_(list(seen)))).all()) if seen else set()
            fresh = [p for p in seen.values() if p["url"] not in known]

            # Promising but cut off: read the whole post before deciding
            to_expand = [p for p in fresh if p.get("truncated") and score_post(p["text"])[0] >= KEEP_SCORE]
            expand(win, to_expand)

            contacted = {h.lstrip("@").lower() for h in session.exec(select(Lead.x_handle).where(Lead.x_handle.is_not(None))).all()}
            new_matches = []
            for p in fresh:
                score, tags = score_post(p["text"])
                if score < KEEP_SCORE:
                    continue
                handle = p["handle"].lstrip("@")
                row = XJobPost(
                    url=p["url"], handle=handle, author_name=p.get("name"), text=p["text"],
                    links_json=json.dumps(p.get("links") or []), query=p.get("query"),
                    posted_at=parse_time(p.get("posted")), score=score, tags=",".join(tags),
                    pay=extract_pay(p["text"]), already_contacted=handle.lower() in contacted,
                )
                if score >= MATCH_THRESHOLD:
                    new_matches.append(row)
                if args.dry_run:
                    print(f"{score:>3} {row.tags:<36} @{handle:<18} {p['text'][:80]!r}")
                else:
                    session.add(row)

            print(f"Seen {len(seen)}, new {len(fresh)}, new matches {len(new_matches)}")
            if not args.dry_run:
                rescore_new(session)
            if not args.dry_run:
                run.posts_seen, run.new_matches, run.finished_at = len(seen), len(new_matches), datetime.utcnow()
                session.add(run)
                session.commit()
                strong = sorted((m for m in new_matches if m.score >= NOTIFY_THRESHOLD), key=lambda m: -m.score)
                if strong:
                    top = strong[0]
                    notify(f"X Radar: {len(strong)} strong job post{'s' if len(strong) > 1 else ''}",
                           f"@{top.handle}: {top.text[:110]}")
        except Exception as e:
            print(f"Scan failed: {e}", file=sys.stderr)
            if not args.dry_run:
                session.rollback()
                run.error, run.finished_at = str(e)[:500], datetime.utcnow()
                session.add(run)
                session.commit()
            raise SystemExit(1)
        finally:
            if win:
                close_window(win)


if __name__ == "__main__":
    main()
