import os
import sys
import json
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
CONFIG_DIR = PROJECT_ROOT / "config"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_STATE_PATH = CONFIG_DIR / "x_storage_state.json"

def create_state_from_tokens(auth_token: str, ct0: str = "") -> None:
    """
    Builds Playwright storage_state.json directly from your X auth_token and ct0 cookies.
    """
    state = {
        "cookies": [
            {
                "name": "auth_token",
                "value": auth_token.strip(),
                "domain": ".x.com",
                "path": "/",
                "expires": -1,
                "httpOnly": True,
                "secure": True,
                "sameSite": "None"
            }
        ],
        "origins": []
    }
    if ct0:
        state["cookies"].append({
            "name": "ct0",
            "value": ct0.strip(),
            "domain": ".x.com",
            "path": "/",
            "expires": -1,
            "httpOnly": False,
            "secure": True,
            "sameSite": "Lax"
        })
    with open(STORAGE_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    print(f"[✓] Saved X session storage state directly to: {STORAGE_STATE_PATH}")

def interactive_login():
    """
    Opens Chromium headed window, lets user log in on X, and saves storage state on exit.
    """
    print("[*] Launching browser for X (Twitter) authentication...")
    print("    Please log into your X account in the browser window.")
    print("    Once you are logged into your feed, close the browser or press Enter in this terminal.")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("https://x.com/login", wait_until="domcontentloaded")
        
        try:
            input("\n--> Press Enter here AFTER you have logged in on X.com... ")
        except KeyboardInterrupt:
            pass
            
        context.storage_state(path=str(STORAGE_STATE_PATH))
        print(f"\n[✓] Successfully captured and saved X session state to: {STORAGE_STATE_PATH}")
        browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="X (Twitter) Session Authenticator")
    parser.add_argument("--auth-token", type=str, help="Directly provide auth_token cookie from browser DevTools")
    parser.add_argument("--ct0", type=str, default="", help="Optional ct0 cookie from browser DevTools")
    parser.add_argument("--login", action="store_true", help="Launch interactive browser to log in manually")
    args = parser.parse_args()

    if args.auth_token:
        create_state_from_tokens(args.auth_token, args.ct0)
    elif args.login:
        interactive_login()
    else:
        print("Usage:")
        print("  1. Quick Token method: uv run python scripts/x_auth_setup.py --auth-token YOUR_TOKEN --ct0 YOUR_CT0")
        print("  2. Interactive window:  uv run python scripts/x_auth_setup.py --login")
