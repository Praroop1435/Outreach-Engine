import os
import json
import time
import random
from datetime import datetime
from typing import Optional, Dict, Any
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

SESSION_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "x_browser_session.json")

def get_browser_session_status() -> Dict[str, Any]:
    """Checks if a valid X browser session exists."""
    if not os.path.exists(SESSION_FILE):
        return {
            "has_session": False,
            "username": None,
            "updated_at": None,
            "details": "No browser session found. You can paste your auth_token & ct0 cookies or run interactive login."
        }
    try:
        with open(SESSION_FILE, "r") as f:
            data = json.load(f)
        
        cookies = data.get("cookies", [])
        has_auth = any(c.get("name") == "auth_token" for c in cookies)
        has_ct0 = any(c.get("name") == "ct0" for c in cookies)
        
        stat = os.stat(SESSION_FILE)
        return {
            "has_session": has_auth and has_ct0,
            "cookies_count": len(cookies),
            "updated_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "details": "Browser session active (auth_token & ct0 present)"
        }
    except Exception as e:
        return {
            "has_session": False,
            "username": None,
            "updated_at": None,
            "details": f"Error reading session: {str(e)}"
        }

def save_cookies_as_session(auth_token: str, ct0: str, username: Optional[str] = None) -> Dict[str, Any]:
    """Builds and saves a Playwright storage_state JSON using auth_token and ct0 cookies."""
    auth_clean = auth_token.strip().strip('"').strip("'")
    ct0_clean = ct0.strip().strip('"').strip("'")

    now = time.time()
    expires = now + 365 * 24 * 3600  # 1 year expiry

    cookies = [
        {
            "name": "auth_token",
            "value": auth_clean,
            "domain": ".x.com",
            "path": "/",
            "expires": expires,
            "httpOnly": True,
            "secure": True,
            "sameSite": "None"
        },
        {
            "name": "ct0",
            "value": ct0_clean,
            "domain": ".x.com",
            "path": "/",
            "expires": expires,
            "httpOnly": False,
            "secure": True,
            "sameSite": "Lax"
        },
        {
            "name": "auth_token",
            "value": auth_clean,
            "domain": ".twitter.com",
            "path": "/",
            "expires": expires,
            "httpOnly": True,
            "secure": True,
            "sameSite": "None"
        },
        {
            "name": "ct0",
            "value": ct0_clean,
            "domain": ".twitter.com",
            "path": "/",
            "expires": expires,
            "httpOnly": False,
            "secure": True,
            "sameSite": "Lax"
        }
    ]

    storage_state = {
        "cookies": cookies,
        "origins": [
            {
                "origin": "https://x.com",
                "localStorage": []
            }
        ]
    }

    with open(SESSION_FILE, "w") as f:
        json.dump(storage_state, f, indent=2)

    return {
        "ok": True,
        "message": "X browser session successfully saved from cookies",
        "session_file": SESSION_FILE
    }

def clean_x_handle(raw_handle: str) -> str:
    """Normalizes X handle to username without @ or URLs."""
    h = raw_handle.strip()
    h = h.replace("https://x.com/", "").replace("http://x.com/", "")
    h = h.replace("https://twitter.com/", "").replace("http://twitter.com/", "")
    return h.lstrip("@").split("/")[0].split("?")[0].strip()

def send_x_dm_browser(
    recipient_handle: str,
    message_text: str,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Sends a Direct Message on X (Twitter) using Playwright browser automation
    with human-like typing and saved session state.
    """
    if not os.path.exists(SESSION_FILE):
        raise ValueError("No X browser session found. Please configure your cookies (auth_token & ct0) in settings.")

    clean_user = clean_x_handle(recipient_handle)
    if not clean_user:
        raise ValueError("Invalid X username / handle provided.")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )
        context = browser.new_context(
            storage_state=SESSION_FILE,
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        try:
            profile_url = f"https://x.com/{clean_user}"
            page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(random.randint(2000, 3000))

            # Verify if user exists
            if "This account doesn’t exist" in page.content() or "Account suspended" in page.content():
                raise ValueError(f"X account @{clean_user} does not exist or is suspended.")

            # Look for Message button on profile
            dm_button_selectors = [
                '[data-testid="sendDMFromProfile"]',
                'button[aria-label*="Direct message"]',
                'button[aria-label*="Message"]',
                'a[data-testid="sendDMFromProfile"]',
                'div[data-testid="sendDMFromProfile"]'
            ]

            dm_button = None
            for sel in dm_button_selectors:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    dm_button = el
                    break

            if not dm_button:
                # Check if we can navigate directly to DM conversation
                page.goto("https://x.com/messages/compose", wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(2000)
                
                search_input = page.query_selector('input[placeholder*="Search people"], input[data-testid="searchPeople"]')
                if search_input:
                    search_input.fill(clean_user)
                    page.wait_for_timeout(2000)
                    # Click first user result
                    user_cell = page.query_selector(f'[data-testid="TypeaheadUser"]')
                    if user_cell:
                        user_cell.click()
                        page.wait_for_timeout(1000)
                        next_btn = page.query_selector('[data-testid="nextButton"]')
                        if next_btn:
                            next_btn.click()
                            page.wait_for_timeout(2000)
                else:
                    raise ValueError(f"Direct Messages appear closed or restricted for @{clean_user}.")
            else:
                dm_button.click()
                page.wait_for_timeout(random.randint(2000, 3000))

            # Locate DM message input box
            input_selectors = [
                '[data-testid="dmComposerTextInput"]',
                'div[role="textbox"][aria-label*="Direct message"]',
                'div[role="textbox"][data-testid="dmComposerTextInput"]',
                'div[contenteditable="true"][data-testid="dmComposerTextInput"]'
            ]

            composer_input = None
            for sel in input_selectors:
                try:
                    el = page.wait_for_selector(sel, timeout=7000)
                    if el and el.is_visible():
                        composer_input = el
                        break
                except PlaywrightTimeoutError:
                    continue

            if not composer_input:
                raise ValueError(f"Could not open message composer for @{clean_user}. DMs might be closed to non-verified users.")

            # Click input box
            composer_input.click()
            page.wait_for_timeout(500)

            # Human-like typing with randomized delays
            for char in message_text:
                if char == "\n":
                    page.keyboard.down("Shift")
                    page.keyboard.press("Enter")
                    page.keyboard.up("Shift")
                else:
                    page.keyboard.type(char)
                time.sleep(random.uniform(0.02, 0.06))

            page.wait_for_timeout(random.randint(1000, 1800))

            # Locate and click Send button
            send_btn_selectors = [
                '[data-testid="dmComposerSendButton"]',
                'button[aria-label="Send message"]',
                'button[data-testid="dmComposerSendButton"]'
            ]

            send_btn = None
            for s_sel in send_btn_selectors:
                el = page.query_selector(s_sel)
                if el and el.is_enabled():
                    send_btn = el
                    break

            if send_btn:
                send_btn.click()
            else:
                page.keyboard.press("Enter")

            # Wait 3s to ensure message is dispatched
            page.wait_for_timeout(3000)

            # Save updated storage state
            context.storage_state(path=SESSION_FILE)

            return {
                "ok": True,
                "recipient": f"@{clean_user}",
                "sent_at": datetime.utcnow().isoformat(),
                "method": "playwright_browser_automation"
            }

        except Exception as e:
            raise ValueError(f"Playwright X DM automation error: {str(e)}")
        finally:
            browser.close()

def launch_interactive_login():
    """Launches headed browser for one-time manual login to save cookies."""
    print("Launching headed browser for X login. Please log in to your account...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        page.goto("https://x.com/login")

        print("Waiting for login... Browser will save state once you reach home/messages.")
        
        # Poll until user reaches home or messages or closes
        for _ in range(120): # 2 minutes
            time.sleep(1)
            url = page.url
            if "home" in url or "messages" in url or "explore" in url:
                print(f"Login detected! (Current URL: {url})")
                time.sleep(2)
                context.storage_state(path=SESSION_FILE)
                print(f"Browser session saved to {SESSION_FILE}!")
                break
        browser.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        launch_interactive_login()
    else:
        print("X Browser Automation Module. Status:", get_browser_session_status())
