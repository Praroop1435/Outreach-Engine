"""Scan X search results for remote AI / backend / automation job posts.

Runs in its own minimized Brave window (never the user's front window), searches X's
Latest tab for each query, scrolls, and saves every post it sees.

    .venv/bin/python scripts/x_job_scan.py --since 2026-10-23 --scrolls 6
"""
import argparse
import json
import subprocess
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "x_jobs"

QUERIES = {
    "ai_engineer": '(hiring OR "we\'re hiring" OR "looking for") ("AI engineer" OR "LLM engineer" OR "applied AI" OR "GenAI engineer") remote',
    "backend": '(hiring OR "we\'re hiring" OR "looking for") ("backend engineer" OR "backend developer" OR "python developer" OR fastapi) remote',
    "automation": '(hiring OR "looking for") ("automation engineer" OR "AI automation" OR n8n OR "workflow automation") remote',
    "internship": '(hiring OR "looking for") ("AI intern" OR "AI internship" OR "backend intern" OR "ML intern" OR "SDE intern") remote',
    "founding": '("founding engineer" OR "first engineer") (AI OR agents OR LLM) hiring remote',
    "india_ai": '(hiring OR "we\'re hiring") (remote OR wfh) india ("AI engineer" OR "GenAI" OR LLM OR agents OR RAG)',
    "india_intern": '(hiring OR "we\'re hiring") (intern OR internship) (remote OR wfh) (AI OR backend OR python OR "full stack") stipend',
    "dm_founders": '("we\'re hiring" OR "i\'m hiring" OR "we are hiring") (AI OR agents OR LLM OR backend) ("DM me" OR "DMs open" OR "send me") remote',
    "n8n": '(hiring OR "looking for") (n8n OR make.com OR zapier) developer remote',
    "junior_ai": '(hiring OR "we\'re hiring") (junior OR fresher OR "new grad" OR "0-1 years" OR "entry level") (AI OR LLM OR agents OR python OR backend) remote',
    "intern_ppo": '(intern OR internship) (PPO OR stipend) (AI OR LLM OR agents OR backend OR GenAI) remote',
    "founder_intern": '("hiring an intern" OR "hiring interns" OR "looking for an intern" OR "need an intern") (AI OR agents OR backend OR python OR automation)',
    "fullstack": '(hiring OR "we\'re hiring" OR "looking for") ("full stack" OR fullstack OR "full-stack" OR MERN OR "next.js developer") (remote OR wfh)',
    "backend_junior": '(hiring OR "we\'re hiring" OR "looking for") (intern OR internship OR junior OR fresher OR "new grad" OR "entry level") (backend OR "full stack" OR fullstack OR node OR django OR fastapi OR golang) remote',
    "sde_india": '(hiring OR "we\'re hiring") ("SDE 1" OR "SDE-1" OR "SDE intern" OR "software engineer intern" OR "backend intern" OR "full stack intern") (remote OR wfh OR india)',
}

EXTRACT_JS = r"""
(() => {
  const out = [];
  document.querySelectorAll("article[data-testid='tweet']").forEach(art => {
    try {
      const user = art.querySelector("div[data-testid='User-Name']");
      const links = user ? [...user.querySelectorAll("a")] : [];
      const name = links[0] ? links[0].innerText.split("\n")[0] : "";
      const h = links.find(l => l.innerText.startsWith("@"));
      const text = (art.querySelector("div[data-testid='tweetText']") || {}).innerText || "";
      const time = art.querySelector("time");
      const url = time && time.parentElement && time.parentElement.tagName === "A" ? time.parentElement.href : "";
      const ext = [...art.querySelectorAll("div[data-testid='tweetText'] a, div[data-testid='card.wrapper'] a")]
        .map(a => ({ href: a.href, text: a.innerText })).filter(a => !a.href.includes("/hashtag/") && !a.href.startsWith("https://x.com/"));
      const truncated = !!art.querySelector("[data-testid='tweet-text-show-more-link']");
      if (text) out.push({ name, handle: h ? h.innerText.split("\n")[0] : "", text, url, posted: time ? time.getAttribute("datetime") : null, links: ext, truncated });
    } catch (e) {}
  });
  return JSON.stringify(out);
})()
"""


def osa(script: str) -> str:
    p = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip())
    return p.stdout.strip()


def open_hidden_window(url: str) -> str:
    return osa(f'''
    tell application "Brave Browser"
        set w to make new window
        set URL of active tab of w to {json.dumps(url)}
        set minimized of w to true
        return id of w
    end tell''')


def navigate(win_id: str, url: str):
    osa(f'tell application "Brave Browser" to set URL of active tab of window id {win_id} to {json.dumps(url)}')


def run_js(win_id: str, js: str) -> str:
    return osa(f'tell application "Brave Browser" to execute active tab of window id {win_id} javascript {json.dumps(js)}')


def close_window(win_id: str):
    try:
        osa(f'tell application "Brave Browser" to close window id {win_id}')
    except RuntimeError:
        pass


def search_url(q: str, since: str) -> str:
    return "https://x.com/search?" + urllib.parse.urlencode({"q": f"{q} since:{since} lang:en -filter:replies", "src": "typed_query", "f": "live"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=datetime.now().strftime("%Y-%m-%d"))
    ap.add_argument("--scrolls", type=int, default=6)
    ap.add_argument("--only", nargs="*", help="Subset of query keys")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    queries = {k: v for k, v in QUERIES.items() if not args.only or k in args.only}
    seen: dict[str, dict] = {}
    win = None
    try:
        for key, q in queries.items():
            url = search_url(q, args.since)
            if win is None:
                win = open_hidden_window(url)
            else:
                navigate(win, url)
            time.sleep(7)
            if "Log in" in run_js(win, "document.title") or "login" in run_js(win, "location.href"):
                raise SystemExit("X is not logged in in Brave.")
            before = len(seen)
            for _ in range(args.scrolls + 1):
                for post in json.loads(run_js(win, EXTRACT_JS) or "[]"):
                    if post["url"] and post["url"] not in seen:
                        post["query"] = key
                        seen[post["url"]] = post
                run_js(win, "window.scrollBy(0, 2200); true")
                time.sleep(2.5)
            print(f"{key}: +{len(seen) - before} posts", flush=True)
    finally:
        if win:
            close_window(win)

    out = OUT_DIR / f"x_posts_{datetime.now():%Y%m%d_%H%M}.json"
    out.write_text(json.dumps(list(seen.values()), indent=1, ensure_ascii=False))
    print(f"Saved {len(seen)} posts to {out}")


if __name__ == "__main__":
    main()
