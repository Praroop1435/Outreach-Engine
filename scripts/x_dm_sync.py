"""Check your X DMs for replies to outreach and store them for the dashboard's Founder DMs tab.

Reads x.com/i/chat in its own minimized Brave window. Only conversations with a lead are stored; chats
with anyone else are skipped. A conversation whose last message is theirs is never opened, so no read
receipt goes out: the inbox preview is stored as the reply instead. Nothing is ever sent from here.

    .venv/bin/python scripts/x_dm_sync.py            # sync now
    .venv/bin/python scripts/x_dm_sync.py --dry-run  # print matches, write nothing
    .venv/bin/python scripts/x_dm_sync.py --reread   # refresh text and times of stored threads

Prints one JSON line with the result. scripts/x_scheduled_run.py runs this 4 times a day.
"""
import argparse
import calendar
import fcntl
import hashlib
import json
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from sqlmodel import Session, select  # noqa: E402

from app.cache import app_cache  # noqa: E402
from app.db import engine, init_db  # noqa: E402
from app.models import EmailDirection, EmailMessage, Lead, LeadStatus, MessageChannel, XDmSyncRun  # noqa: E402
from x_job_scan import close_window, navigate, open_hidden_window, run_js  # noqa: E402

LOCK_FILE = Path("/tmp/x_dm_sync.lock")
# Lives outside the repo: it holds the handles of everyone you chat with, and the repo is public
STATE_FILE = Path.home() / ".outreach" / "x_dm_state.json"
MY_USER_ID = "1943576245679329281"
MAX_LIST_SCROLLS = 3    # A new message moves its chat to the top, so a normal check stays near the top of the list
MAX_NEW_LOOKUPS = 5     # numeric id to @handle lookups per run, each costs ~5s
TRAILING_TIME = re.compile(r"(\s*\d{1,2}:\d{2}\s?[AP]M)+$")

# X's chat lives inside shadow roots
ROOTS_JS = (
    "const roots=[document];"
    "const walk=r=>{r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot){roots.push(e.shadowRoot);walk(e.shadowRoot)}})};walk(document);"
    "const qa=s=>roots.flatMap(r=>[...r.querySelectorAll(s)]);"
)

LIST_JS = "(()=>{" + ROOTS_JS + r"""
  const items=qa("[data-testid^='dm-conversation-item-']").map(i=>{
    const leafs=[...i.querySelectorAll('*')].filter(x=>x.children.length===0&&x.textContent.trim()).map(x=>x.textContent.trim());
    return {id:i.getAttribute('data-testid').replace('dm-conversation-item-',''),name:leafs[0]||'',when:leafs[1]||'',preview:leafs.slice(2).join(' '),text:i.textContent};
  });
  return JSON.stringify(items);
})()"""

SCROLL_JS = "(()=>{" + ROOTS_JS + r"""
  const sc=qa("[data-testid='dm-conversation-scroller']")[0];
  if(!sc) return 'false';
  const before=sc.scrollTop;
  sc.scrollTop=before+sc.clientHeight;
  return String(sc.scrollTop!==before);
})()"""

OPEN_THREAD_JS = "(()=>{" + ROOTS_JS + r"""
  const a=qa("a[href='/i/chat/%s']")[0];
  if(!a) return 'NOT_FOUND';
  a.click();
  return 'OK';
})()"""

THREAD_JS = "(()=>{" + ROOTS_JS + r"""
  const list=qa("[data-testid='dm-message-list']")[0];
  if(!list) return '[]';
  const out=[];
  list.querySelectorAll('*').forEach(e=>{
    const tid=e.getAttribute('data-testid')||'';
    if(tid.startsWith('message-')&&!tid.startsWith('message-text-')){
      const body=e.querySelector("[data-testid^='message-text-']");
      const time=e.querySelector("[id$='-time']");
      if(body) out.push({uuid:tid.replace('message-',''),mine:e.className.includes('justify-end'),text:body.innerText||body.textContent,time:time?time.textContent.trim():''});
    } else if(e.children.length===0&&!e.closest("[data-testid^='message-']")&&/[0-9]:[0-9][0-9] ?[AP]M$/.test(e.textContent.trim())){
      out.push({day:e.textContent.trim()});
    }
  });
  return JSON.stringify(out);
})()"""


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except (OSError, ValueError):
        return {"handles": {}, "previews": {}}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=1))


def open_inbox(win: str):
    navigate(win, "https://x.com/notifications")
    time.sleep(5)
    # Setting the URL straight to /i/chat doesn't load in a script-driven window, the in-app link does
    if "ok" not in run_js(win, "(()=>{const a=document.querySelector(\"[data-testid='AppTabBar_DirectMessage_Link']\");if(!a)return 'missing';a.click();return 'ok'})()"):
        raise RuntimeError("X is not logged in in Brave")
    for _ in range(12):
        time.sleep(2)
        if json.loads(run_js(win, LIST_JS) or "[]"):
            return
    raise RuntimeError("X DM list did not load")


def read_conversations(win: str) -> list[dict]:
    """The list is virtualized, so collect rows while scrolling."""
    seen: dict[str, dict] = {}
    stuck = 0
    for _ in range(MAX_LIST_SCROLLS):
        for row in json.loads(run_js(win, LIST_JS)):
            seen.setdefault(row["id"], row)
        # The list can pause while older chats load, so only stop once it stays put
        stuck = 0 if run_js(win, SCROLL_JS) == "true" else stuck + 1
        if stuck >= 4:
            break
        time.sleep(1.5)
    return list(seen.values())


def is_mine(row: dict) -> bool:
    return row["text"].startswith(f"{row['name']}{row['when']}You:")


def relative_time(label: str) -> datetime:
    m = re.fullmatch(r"(\d+)([smhdw])", label.strip())
    if not m:
        return datetime.utcnow()
    unit = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days", "w": "weeks"}[m.group(2)]
    return datetime.utcnow() - timedelta(**{unit: int(m.group(1))})


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def separator_date(label: str, today: date) -> date | None:
    """X heads each group of messages with "Today 1:24 PM", "Thursday 4:39 PM" or "Thu, Oct 8 at 9:54 PM"."""
    word = label.split()[0].rstrip(",")
    if word == "Today":
        return today
    if word == "Yesterday":
        return today - timedelta(days=1)
    m = re.search(r"([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?", label)
    if m:
        year = int(m.group(3) or today.year)
        found = datetime.strptime(f"{m.group(1)} {m.group(2)} {year}", "%b %d %Y").date()
        return found.replace(year=year - 1) if found > today else found
    if word in calendar.day_name:
        return today - timedelta(days=(today.weekday() - list(calendar.day_name).index(word)) % 7)
    return None


def dated_messages(items: list[dict], today: date | None = None) -> list[dict]:
    """Gives each message its real time as naive UTC, the format the database uses."""
    today = today or date.today()
    day, last_time, out = None, None, []
    for item in items:
        if "day" in item:
            day, last_time = separator_date(item["day"], today), None
            continue
        msg, msg["at"] = dict(item), None
        try:
            clock = datetime.strptime(item["time"], "%I:%M %p").time()
        except ValueError:
            clock = last_time  # X only labels the last of a quick run of messages
        if day and clock:
            if last_time and clock < last_time:  # Past midnight with no new heading
                day += timedelta(days=1)
            last_time = clock
            msg["at"] = datetime.combine(day, clock).astimezone(timezone.utc).replace(tzinfo=None)
        out.append(msg)
    # A message X left unlabeled belongs with the next one that has a time
    for earlier, later in zip(reversed(out[:-1]), reversed(out[1:])):
        earlier["at"] = earlier["at"] or later["at"]
    return out


def store_reply(session: Session, lead: Lead, thread: str, message_id: str, text: str, when: datetime) -> bool:
    if session.exec(select(EmailMessage).where(EmailMessage.message_id == message_id)).first():
        return False
    session.add(EmailMessage(
        lead_id=lead.id, message_id=message_id, thread_id=thread, channel=MessageChannel.X_DM.value,
        direction=EmailDirection.RECEIVED.value, sender=lead.x_handle or "", recipient="me", subject="X DM reply",
        snippet=text[:500], body_text=text, sent_at=when,
    ))
    if lead.status not in (LeadStatus.INTERESTED.value, LeadStatus.NOT_INTERESTED.value):
        lead.status = LeadStatus.REPLIED.value
    lead.follow_up_due_at = None
    lead.updated_at = datetime.utcnow()
    session.add(lead)
    return True


def store_thread(session: Session, lead: Lead, thread: str, messages: list[dict]) -> int:
    """Stores a thread read from X, which is the source of truth for text and times. Nothing doubles."""
    logged = session.exec(select(EmailMessage).where(EmailMessage.lead_id == lead.id, EmailMessage.channel == MessageChannel.X_DM.value).order_by(EmailMessage.sent_at)).all()
    unlinked_sent = [m for m in logged if m.direction == EmailDirection.SENT.value and not (m.message_id or "").startswith("xdm:")]
    previews = [m for m in logged if (m.message_id or "").startswith("xdm-preview:")]
    known = {m.message_id: m for m in logged if m.message_id}
    new_replies = 0
    last_mine = None
    for msg in dated_messages(messages):
        message_id = f"xdm:{msg['uuid']}"
        text = TRAILING_TIME.sub("", norm(msg["text"]))  # The bubble's text ends with its time label
        if msg["mine"] and msg["at"]:
            last_mine = max(last_mine or msg["at"], msg["at"])
        row = known.get(message_id)
        if not row and msg["mine"] and unlinked_sent:  # A DM we logged when it was sent
            row = unlinked_sent.pop(0)
        if not row and not msg["mine"]:                # We saved the inbox preview earlier
            row = next((p for p in previews if text.startswith(norm(p.snippet).rstrip("…. "))), None)
            if row:
                previews.remove(row)
        if row:
            row.message_id, row.thread_id, row.body_text, row.snippet = message_id, thread, text, text[:500]
            row.sent_at = msg["at"] or row.sent_at
            session.add(row)
        elif msg["mine"]:                              # You typed this one in X yourself, for example a follow-up
            session.add(EmailMessage(
                lead_id=lead.id, message_id=message_id, thread_id=thread, channel=MessageChannel.X_DM.value,
                direction=EmailDirection.SENT.value, sender="me", recipient=lead.x_handle or "", subject="X DM",
                snippet=text[:500], body_text=text, sent_at=msg["at"] or datetime.utcnow(),
            ))
        elif store_reply(session, lead, thread, message_id, text, msg["at"] or datetime.utcnow()):
            new_replies += 1
    if last_mine:
        lead.last_contacted_at = last_mine
        session.add(lead)
    return new_replies


def sync(dry_run: bool = False, reread: bool = False) -> dict:
    state = load_state()
    new_replies = 0
    win = open_hidden_window("https://x.com/notifications")
    try:
        open_inbox(win)
        rows = read_conversations(win)

        # Conversation ids are "<user id>:<user id>", and x.com/i/user/<id> redirects to the @handle
        lookups = 0
        for row in rows:
            other = next((p for p in row["id"].split(":") if p != MY_USER_ID), None)
            row["user_id"] = other
            if other and other not in state["handles"] and lookups < MAX_NEW_LOOKUPS:
                navigate(win, f"https://x.com/i/user/{other}")
                time.sleep(4)
                state["handles"][other] = run_js(win, "location.pathname").strip("/").split("/")[0]
                lookups += 1
        if lookups:
            save_state(state)

        with Session(engine) as session:
            leads = {(l.x_handle or "").lstrip("@").lower(): l.id for l in session.exec(select(Lead).where(Lead.x_handle.is_not(None))).all()}

        matched = [r for r in rows if state["handles"].get(r.get("user_id"), "").lower() in leads and state["handles"].get(r.get("user_id"))]
        to_open = []
        for row in matched:
            lead_id = leads[state["handles"][row["user_id"]].lower()]
            thread = row["id"].replace(":", "-")
            if not reread and state["previews"].get(row["id"]) == row["preview"]:
                continue
            mine = is_mine(row)
            if dry_run:
                print(f"  @{state['handles'][row['user_id']]}: {'you sent last' if mine else 'THEY REPLIED'} ({row['when']})", file=sys.stderr)
                continue
            if mine:
                to_open.append((row, lead_id, thread))
            elif "reacted" not in row["preview"]:
                with Session(engine) as session:
                    digest = hashlib.sha1(norm(row["preview"]).encode()).hexdigest()[:16]
                    if store_reply(session, session.get(Lead, lead_id), thread, f"xdm-preview:{thread}:{digest}", norm(row["preview"]), relative_time(row["when"])):
                        new_replies += 1
                    session.commit()
                state["previews"][row["id"]] = row["preview"]

        if to_open:
            open_inbox(win)
            # The row has to be on screen to be clicked, and the list only renders what's in view
            for row, lead_id, thread in to_open:
                opened = False
                for _ in range(MAX_LIST_SCROLLS):
                    if run_js(win, OPEN_THREAD_JS % thread) == "OK":
                        opened = True
                        break
                    if run_js(win, SCROLL_JS) != "true":
                        break
                    time.sleep(1)
                if not opened:
                    open_inbox(win)
                    continue
                time.sleep(4)
                messages = json.loads(run_js(win, THREAD_JS) or "[]")
                with Session(engine) as session:
                    new_replies += store_thread(session, session.get(Lead, lead_id), thread, messages)
                    session.commit()
                state["previews"][row["id"]] = row["preview"]
                save_state(state)
                open_inbox(win)
        if not dry_run:
            save_state(state)
    finally:
        close_window(win)
    return {"ok": True, "conversations": len(rows), "matched": len(matched), "new_replies": new_replies}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--reread", action="store_true", help="Reopen every safe thread, even if unchanged")
    args = ap.parse_args()

    lock = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print(json.dumps({"ok": False, "error": "A DM check is already running"}))
        return

    init_db()
    run = XDmSyncRun()
    try:
        result = sync(dry_run=args.dry_run, reread=args.reread)
        run.conversations, run.new_replies = result["conversations"], result["new_replies"]
    except Exception as e:  # The dashboard shows this instead of an endless spinner
        result = {"ok": False, "error": str(e)[:300]}
        run.error = result["error"]
    if not args.dry_run:
        run.finished_at = datetime.utcnow()
        with Session(engine) as session:
            session.add(run)
            session.commit()
        app_cache.invalidate()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
