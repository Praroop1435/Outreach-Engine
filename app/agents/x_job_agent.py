import os
import sys
import json
import time
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright, Page, BrowserContext

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

CONFIG_DIR = PROJECT_ROOT / "config"
STORAGE_STATE_PATH = CONFIG_DIR / "x_storage_state.json"
LOGS_DIR = PROJECT_ROOT / "data"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
APPLIED_LOG_FILE = LOGS_DIR / "applied_jobs.json"

from app.agents.fast_form_filler import FastFormFiller

# Target high-intent hiring queries
DEFAULT_SEARCH_QUERY = '("hiring" OR "looking for") ("AI Engineer" OR "Agentic AI" OR "Full Stack AI" OR "Founding AI" OR "AI intern") -filter:replies'

FORM_DOMAINS = [
    "docs.google.com/forms",
    "forms.gle",
    "ashbyhq.com",
    "jobs.ashbyhq.com",
    "jobs.lever.co",
    "lever.co",
    "boards.greenhouse.io",
    "greenhouse.io",
    "tally.so",
    "typeform.com",
    "workable.com",
    "breezy.hr",
    "notion.site",
    "airtable.com"
]

def load_applied_cache() -> List[str]:
    if APPLIED_LOG_FILE.exists():
        try:
            with open(APPLIED_LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_applied_cache(seen_ids: List[str]):
    with open(APPLIED_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(seen_ids, f, indent=2)

def resolve_redirect(url: str) -> str:
    """Follows t.co short links to find the real destination"""
    if "t.co/" not in url:
        return url
    try:
        with httpx.Client(follow_redirects=True, timeout=5.0) as client:
            resp = client.head(url)
            return str(resp.url)
    except Exception:
        return url

class XJobAgent:
    def __init__(self, headless: bool = False, auto_submit: bool = False):
        self.headless = headless
        self.auto_submit = auto_submit
        self.form_filler = FastFormFiller(headless=headless)
        self.applied_cache = load_applied_cache()

    def run(self, query: str = DEFAULT_SEARCH_QUERY, max_scrolls: int = 10, max_forms_to_fill: int = 5):
        if not STORAGE_STATE_PATH.exists():
            print(f"[!] Storage state file not found at: {STORAGE_STATE_PATH}")
            print("    Please run: uv run python scripts/x_auth_setup.py --login (or --auth-token YOUR_TOKEN)")
            return

        print(f"[*] Starting X Job Agent...")
        print(f"    Query: {query}")
        print(f"    Mode: {'AUTO-SUBMIT' if self.auto_submit else 'REVIEW (stage forms & screenshot)'}")

        encoded_query = urllib.parse.quote(query)
        search_url = f"https://x.com/search?q={encoded_query}&f=live"

        forms_filled = 0

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                storage_state=str(STORAGE_STATE_PATH),
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            page = context.new_page()

            print(f"[*] Navigating to X search: {search_url}")
            page.goto(search_url, wait_until="domcontentloaded")
            time.sleep(3.0)

            # Check if login active
            if "login" in page.url:
                print("[!] X session expired or not authenticated. Please re-authenticate via scripts/x_auth_setup.py")
                browser.close()
                return

            print("[✓] Authenticated on X! Monitoring live stream...")

            for scroll in range(1, max_scrolls + 1):
                print(f"\n--- [Scroll {scroll}/{max_scrolls}] Scanning stream ---")
                
                # Extract all tweet elements
                tweet_articles = page.locator("article[data-testid='tweet']").all()
                print(f"    Found {len(tweet_articles)} tweets in view")

                for article in tweet_articles:
                    try:
                        text_content = article.inner_text()
                        
                        # Find all links in the tweet
                        links = article.locator("a[href*='t.co']").all()
                        extracted_urls = [l.get_attribute("href") for l in links if l.get_attribute("href")]

                        if not extracted_urls:
                            continue

                        # Check if matches AI engineer / intern profile
                        is_match = any(term in text_content.lower() for term in ["ai engineer", "intern", "agentic", "full stack", "fullstack", "founding"])
                        if not is_match:
                            continue

                        for short_url in extracted_urls:
                            resolved = resolve_redirect(short_url)
                            
                            # Deduplicate
                            if resolved in self.applied_cache:
                                continue

                            print(f"\n[🔥] High-Signal Job Lead Found!")
                            print(f"     Tweet Snippet: {text_content[:140]}...")
                            print(f"     Resolved Target URL: {resolved}")

                            # Check if form URL
                            is_form = any(domain in resolved for domain in FORM_DOMAINS) or "careers" in resolved or "apply" in resolved or "jobs" in resolved
                            if is_form:
                                print(f"[*] Opening application page instantly...")
                                form_page = context.new_page()
                                try:
                                    form_page.goto(resolved, wait_until="domcontentloaded", timeout=35000)
                                    fill_res = self.form_filler.fill_form_page(form_page, auto_submit=self.auto_submit)
                                    forms_filled += 1
                                    self.applied_cache.append(resolved)
                                    save_applied_cache(self.applied_cache)
                                    print(f"[✓] Form completed! Fields populated: {fill_res['fields_filled_count']}")
                                finally:
                                    form_page.close()

                                if forms_filled >= max_forms_to_fill:
                                    print(f"\n[!] Reached max forms cap ({max_forms_to_fill}). Stopping.")
                                    browser.close()
                                    return
                    except Exception as e:
                        continue

                # Scroll down
                page.mouse.wheel(0, 1500)
                time.sleep(2.5)

            browser.close()
            print(f"\n[✓] Session finished. Total forms filled: {forms_filled}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="X Job Hunting & Fast Form-Filling Agent")
    parser.add_argument("--query", type=str, default=DEFAULT_SEARCH_QUERY, help="Search query on X")
    parser.add_argument("--scrolls", type=int, default=8, help="Number of scrolls down the timeline")
    parser.add_argument("--max-forms", type=int, default=5, help="Max number of forms to fill in one run")
    parser.add_argument("--submit", action="store_true", help="Auto-submit forms immediately (default is review mode)")
    parser.add_argument("--headless", action="store_true", help="Run in headless browser mode")
    args = parser.parse_args()

    agent = XJobAgent(headless=args.headless, auto_submit=args.submit)
    agent.run(query=args.query, max_scrolls=args.scrolls, max_forms_to_fill=args.max_forms)
