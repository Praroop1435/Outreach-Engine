import os
import sys
import json
import time
import re
import random
import subprocess
import urllib.parse
from pathlib import Path
from typing import List, Dict, Any, Optional

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
EXTRACT_JS_PATH = PROJECT_ROOT / "scripts" / "extract_tweets.js"
OUTPUT_ALL_POSTS = DATA_DIR / "x_scraped_posts_100.json"
OUTPUT_CATEGORIZED = DATA_DIR / "x_categorized_jobs.json"

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

JOB_KEYWORDS = [
    "hiring", "looking for", "join our team", "we are hiring", "intern", 
    "internship", "engineer", "developer", "sde", "founding", "apply here",
    "dm me", "send resume", "drop portfolio", "opportunity", "contractor",
    "opening", "careers", "work with us", "role"
]

AI_FIT_KEYWORDS = [
    "ai", "agent", "agentic", "llm", "rag", "fullstack", "full stack", 
    "backend", "python", "fastapi", "next.js", "nextjs", "sde", "intern",
    "internship", "founding engineer", "software engineer"
]

def load_js_code() -> str:
    return EXTRACT_JS_PATH.read_text(encoding="utf-8")

def execute_in_brave(js_code: str) -> str:
    escaped = json.dumps(js_code)
    apple_script = f"""
    tell application "Brave Browser"
        execute active tab of front window javascript {escaped}
        set res to execute active tab of front window javascript "window.name;"
        return res
    end tell
    """
    p = subprocess.run(["osascript", "-e", apple_script], capture_output=True, text=True)
    return p.stdout.strip()

def scroll_in_brave(distance: int = 1600):
    scroll_js = f"window.scrollBy(0, {distance});"
    execute_in_brave(scroll_js)

def extract_first_name(full_name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", "", full_name).strip()
    parts = cleaned.split()
    if parts:
        return parts[0].capitalize()
    return "there"

def generate_dm_copy(first_name: str, email: Optional[str], role: str, tweet_context: str) -> str:
    """
    Generates tailored, human DM strictly enforcing:
    - No em dashes (\u2014)
    - No en dashes (\u2013)
    - No spaced hyphens ( - )
    - Human, friendly tone
    - Loom demo links and portfolio
    """
    if email:
        dm = (
            f"Hey {first_name}, dropped an email at {email} for the {role} role! "
            f"Built out production-ready backend systems and autonomous AI agents (FastAPI, Next.js, PostgreSQL, Docker). "
            f"Dropped a couple of short Loom demos and my portfolio (praroop.site) in the mail. Would love to chat!"
        )
    else:
        dm = (
            f"Hey {first_name}, saw your post looking for {role}! "
            f"I am an AI Engineer building production agent workflows and scalable backend systems (FastAPI, Next.js, PostgreSQL, Redis, Docker). "
            f"Here is a quick Loom walkthrough of a production intelligence system I built: "
            f"https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799 "
            f"and my portfolio: https://praroop.site. Would love to chat!"
        )

    # Strict compliance check
    for forbidden in ["\u2014", "\u2013", " - "]:
        if forbidden in dm:
            raise ValueError(f"Forbidden dash character '{forbidden}' found in generated DM!")

    return dm

def categorize_tweet(tweet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = tweet.get("text", "")
    text_lower = text.lower()

    # Check if hiring/job post
    is_job = any(k in text_lower for k in JOB_KEYWORDS)
    if not is_job:
        return None

    # Check fit for Praroop
    fit_score = sum(1 for k in AI_FIT_KEYWORDS if k in text_lower)
    is_high_fit = fit_score >= 1

    # Extract emails
    found_emails = EMAIL_REGEX.findall(text)
    primary_email = found_emails[0] if found_emails else None

    # Determine role title
    role = "AI / Software Engineer"
    if "intern" in text_lower or "internship" in text_lower:
        role = "AI / SDE Intern"
    elif "agent" in text_lower or "agentic" in text_lower:
        role = "Agentic AI Engineer"
    elif "founding" in text_lower:
        role = "Founding Engineer"
    elif "backend" in text_lower:
        role = "Backend Engineer"
    elif "fullstack" in text_lower or "full stack" in text_lower:
        role = "Full-Stack AI Engineer"

    first_name = extract_first_name(tweet.get("name", ""))
    dm_copy = generate_dm_copy(first_name, primary_email, role, text)

    return {
        "author_name": tweet.get("name"),
        "author_handle": tweet.get("handle"),
        "tweet_url": tweet.get("tweetUrl"),
        "tweet_text": text,
        "external_links": tweet.get("links", []),
        "detected_email": primary_email,
        "role_category": role,
        "is_high_fit": is_high_fit,
        "fit_score": fit_score,
        "dm_candidate_first_name": first_name,
        "dm_copy": dm_copy
    }

def run_scroller(target_scrolls: int = 100):
    print("=" * 70)
    print(f"[*] Starting X Scroller & Categorizer for {target_scrolls} scrolls...")
    print("    Targeting active X tab in Brave Browser")
    print("=" * 70)

    js_code = load_js_code()
    all_seen_tweets = {}
    categorized_jobs = []

    for scroll_idx in range(1, target_scrolls + 1):
        try:
            raw_response = execute_in_brave(js_code)
            if raw_response and raw_response != "missing value":
                data = json.loads(raw_response)
                new_in_scroll = 0
                for item in data:
                    t_url = item.get("tweetUrl") or (item.get("handle", "") + ":" + item.get("text", "")[:30])
                    if t_url and t_url not in all_seen_tweets:
                        all_seen_tweets[t_url] = item
                        new_in_scroll += 1
                        
                        job_cat = categorize_tweet(item)
                        if job_cat:
                            categorized_jobs.append(job_cat)
                            tag = "🔥 [HIGH FIT]" if job_cat["is_high_fit"] else "ℹ️ [OTHER JOB]"
                            print(f"\n{tag} Found: {job_cat['role_category']} by {job_cat['author_name']} ({job_cat['author_handle']})")
                            print(f"   Tweet: {job_cat['tweet_text'][:110]}...")
                            if job_cat["detected_email"]:
                                print(f"   Email: {job_cat['detected_email']}")
                            if job_cat["external_links"]:
                                print(f"   Links: {job_cat['external_links']}")
                            print(f"   Prepared DM:")
                            print(f"   \"{job_cat['dm_copy']}\"")

            print(f"--> [Scroll {scroll_idx}/{target_scrolls}] Seen so far: {len(all_seen_tweets)} tweets | Jobs identified: {len(categorized_jobs)}")
            
            # Scroll down
            scroll_dist = random.randint(1500, 2000)
            scroll_in_brave(scroll_dist)
            time.sleep(random.uniform(1.6, 2.4))

        except KeyboardInterrupt:
            print("\n[!] Scroller stopped by user.")
            break
        except Exception as e:
            print(f"[-] Scroll error at {scroll_idx}: {e}")
            time.sleep(1.0)
            continue

    # Save results to disk
    with open(OUTPUT_ALL_POSTS, "w", encoding="utf-8") as f:
        json.dump(list(all_seen_tweets.values()), f, indent=2)

    with open(OUTPUT_CATEGORIZED, "w", encoding="utf-8") as f:
        json.dump(categorized_jobs, f, indent=2)

    print("\n" + "=" * 70)
    print(f"[✓] Completed! Total tweets scanned: {len(all_seen_tweets)}")
    print(f"    Total job opportunities categorized: {len(categorized_jobs)}")
    print(f"    High-fit AI / SDE roles: {len([j for j in categorized_jobs if j['is_high_fit']])}")
    print(f"    Saved all tweets to: {OUTPUT_ALL_POSTS}")
    print(f"    Saved categorized jobs to: {OUTPUT_CATEGORIZED}")
    print("=" * 70)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="X 100-Scroll Live Job Hunter & Categorizer")
    parser.add_argument("--scrolls", type=int, default=100, help="Number of scrolls down timeline")
    args = parser.parse_args()

    run_scroller(target_scrolls=args.scrolls)
