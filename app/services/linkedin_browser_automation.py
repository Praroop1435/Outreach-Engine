import os
import json
import time
import random
import re
from datetime import datetime
from typing import Optional, Dict, Any
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import importlib

try:
    cloakbrowser = importlib.import_module("cloakbrowser")
except Exception:
    cloakbrowser = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
SESSION_FILE = os.path.join(BASE_DIR, "linkedin_browser_session.json")
PROFILE_DIR = os.path.join(BASE_DIR, ".linkedin_profile")

def get_stealth_context(headless: bool = True, humanize: bool = True):
    """
    Launches CloakBrowser (CloakHQ) stealth Chromium with persistent profile context.
    Persists localStorage, cookies, and device fingerprints to avoid LinkedIn authwalls.
    """
    try:
        os.makedirs(PROFILE_DIR, exist_ok=True)
        ctx = cloakbrowser.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=headless,
            humanize=humanize,
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )
        # If session file exists, ensure cookies are loaded into context
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r") as f:
                    data = json.load(f)
                cookies = data.get("cookies", [])
                if cookies:
                    ctx.add_cookies(cookies)
            except Exception:
                pass
        return ctx
    except Exception as e:
        print(f"[CloakHQ Warning] Falling back to standard Playwright: {e}")
        p = sync_playwright().start()
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        kwargs = {
            "viewport": {"width": 1280, "height": 900},
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        }
        if os.path.exists(SESSION_FILE):
            kwargs["storage_state"] = SESSION_FILE
        return browser.new_context(**kwargs)

def get_linkedin_browser_session_status() -> Dict[str, Any]:
    """Checks if a valid LinkedIn browser session or profile exists."""
    has_session = os.path.exists(SESSION_FILE) or os.path.exists(PROFILE_DIR)
    
    cookies_count = 0
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r") as f:
                data = json.load(f)
            cookies = data.get("cookies", [])
            cookies_count = len(cookies)
            has_li_at = any(c.get("name") == "li_at" for c in cookies)
            has_session = has_li_at
        except Exception:
            pass

    return {
        "has_session": has_session,
        "engine": "CloakHQ Persistent Stealth Chromium",
        "cookies_count": cookies_count,
        "profile_dir": PROFILE_DIR,
        "details": "LinkedIn CloakHQ persistent session active" if has_session else "No session found"
    }

def save_linkedin_cookies_as_session(li_at: str, jsessionid: Optional[str] = None) -> Dict[str, Any]:
    """Builds and saves a Playwright storage_state JSON using li_at and optional JSESSIONID cookies."""
    li_at_clean = li_at.strip().strip('"').strip("'")
    now = time.time()
    expires = now + 365 * 24 * 3600

    cookies = [
        {
            "name": "li_at",
            "value": li_at_clean,
            "domain": ".www.linkedin.com",
            "path": "/",
            "expires": expires,
            "httpOnly": True,
            "secure": True,
            "sameSite": "None"
        },
        {
            "name": "li_at",
            "value": li_at_clean,
            "domain": ".linkedin.com",
            "path": "/",
            "expires": expires,
            "httpOnly": True,
            "secure": True,
            "sameSite": "None"
        }
    ]

    if jsessionid:
        jsessionid_clean = jsessionid.strip().strip('"').strip("'")
        cookies.extend([
            {
                "name": "JSESSIONID",
                "value": f'"{jsessionid_clean}"' if not jsessionid_clean.startswith('"') else jsessionid_clean,
                "domain": ".www.linkedin.com",
                "path": "/",
                "expires": expires,
                "httpOnly": False,
                "secure": True,
                "sameSite": "None"
            },
            {
                "name": "JSESSIONID",
                "value": f'"{jsessionid_clean}"' if not jsessionid_clean.startswith('"') else jsessionid_clean,
                "domain": ".linkedin.com",
                "path": "/",
                "expires": expires,
                "httpOnly": False,
                "secure": True,
                "sameSite": "None"
            }
        ])

    storage_state = {
        "cookies": cookies,
        "origins": [
            {
                "origin": "https://www.linkedin.com",
                "localStorage": []
            }
        ]
    }

    with open(SESSION_FILE, "w") as f:
        json.dump(storage_state, f, indent=2)

    return {
        "ok": True,
        "engine": "CloakHQ Persistent Stealth Chromium",
        "message": "LinkedIn session saved successfully with CloakHQ persistent engine",
        "session_file": SESSION_FILE
    }

def clean_linkedin_url(raw_url: str) -> str:
    """Normalizes LinkedIn URL to canonical https://www.linkedin.com/in/... format."""
    u = raw_url.strip()
    if not u.startswith("http"):
        u = "https://" + u.lstrip("/")
    clean = u.split("?")[0].rstrip("/")
    if "/in/" not in clean and "/company/" not in clean:
        if not clean.endswith("linkedin.com"):
            slug = clean.split("/")[-1]
            return f"https://www.linkedin.com/in/{slug}"
    return clean

def send_linkedin_connection_request(
    profile_url: str,
    note_text: Optional[str] = None,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Navigates to a LinkedIn profile and sends a personalized connection request
    using CloakHQ persistent stealth browser automation.
    """
    target_url = clean_linkedin_url(profile_url)
    context = get_stealth_context(headless=headless, humanize=True)
    page = context.pages[0] if context.pages else context.new_page()

    try:
        page.goto(target_url, wait_until="domcontentloaded", timeout=35000)
        page.wait_for_timeout(random.randint(2500, 4000))

        if "authwall" in page.url or "login" in page.url or "signup" in page.url:
            raise ValueError("LinkedIn authwall/login detected. Please run one-time interactive login via: `uv run python app/services/linkedin_browser_automation.py login`")

        if "Page not found" in page.content() or "This profile is not available" in page.content():
            raise ValueError(f"LinkedIn profile not available: {target_url}")

        content = page.content()
        if "Pending" in content and "Invitation sent" in content:
            return {
                "ok": True,
                "status": "ALREADY_PENDING",
                "message": f"Connection request is already pending for {target_url}",
                "recipient": target_url
            }

        # Locate Connect Button
        connect_button = None
        primary_selectors = [
            'button[aria-label*="Invite"][aria-label*="to connect"]',
            'button:has-text("Connect")',
            'button.artdeco-button--primary:has-text("Connect")',
            'div.pvs-profile-actions button:has-text("Connect")'
        ]
        for sel in primary_selectors:
            el = page.query_selector(sel)
            if el and el.is_visible() and el.is_enabled():
                connect_button = el
                break

        # Fallback to "More" (3 dots) dropdown
        if not connect_button:
            more_selectors = [
                'button[aria-label="More actions"]',
                'button:has-text("More")',
                'div.pvs-profile-actions button[aria-label*="More"]'
            ]
            more_button = None
            for sel in more_selectors:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    more_button = el
                    break

            if more_button:
                more_button.click()
                page.wait_for_timeout(1000)
                dropdown_connect_selectors = [
                    'div[role="menu"] div[aria-label*="to connect"]',
                    'div[role="menu"] span:has-text("Connect")',
                    'div.artdeco-dropdown__content button:has-text("Connect")',
                    'div.artdeco-dropdown__content li:has-text("Connect")'
                ]
                for d_sel in dropdown_connect_selectors:
                    d_el = page.query_selector(d_sel)
                    if d_el and d_el.is_visible():
                        connect_button = d_el
                        break

        if not connect_button:
            if "Message" in content:
                return {
                    "ok": True,
                    "status": "ALREADY_CONNECTED",
                    "message": f"Already connected or Direct Messaging is open for {target_url}",
                    "recipient": target_url
                }
            raise ValueError(f"Could not locate 'Connect' button on LinkedIn profile {target_url}.")

        connect_button.click()
        page.wait_for_timeout(random.randint(1500, 2500))

        # Handle "Add a note" Modal
        add_note_selectors = [
            'button[aria-label="Add a note"]',
            'button:has-text("Add a note")',
            'button.artdeco-button--secondary:has-text("Add a note")'
        ]
        add_note_button = None
        for sel in add_note_selectors:
            el = page.query_selector(sel)
            if el and el.is_visible():
                add_note_button = el
                break

        if note_text and add_note_button:
            add_note_button.click()
            page.wait_for_timeout(1000)

            textarea_selectors = [
                'textarea[name="message"]',
                'textarea#custom-message',
                'textarea.ember-text-area'
            ]
            textarea = None
            for sel in textarea_selectors:
                try:
                    el = page.wait_for_selector(sel, timeout=5000)
                    if el and el.is_visible():
                        textarea = el
                        break
                except PlaywrightTimeoutError:
                    continue

            if textarea:
                textarea.click()
                page.wait_for_timeout(300)
                note_clean = note_text[:298].strip()
                for char in note_clean:
                    if char == "\n":
                        page.keyboard.down("Shift")
                        page.keyboard.press("Enter")
                        page.keyboard.up("Shift")
                    else:
                        page.keyboard.type(char)
                    time.sleep(random.uniform(0.015, 0.04))
                page.wait_for_timeout(1000)

        # Click Send Invitation
        send_btn_selectors = [
            'button[aria-label="Send invitation"]',
            'button[aria-label="Send now"]',
            'button.artdeco-button--primary:has-text("Send")',
            'button:has-text("Send invitation")',
            'button:has-text("Send")'
        ]
        send_btn = None
        for sel in send_btn_selectors:
            el = page.query_selector(sel)
            if el and el.is_visible() and el.is_enabled():
                send_btn = el
                break

        if send_btn:
            send_btn.click()
            page.wait_for_timeout(3000)
        else:
            page.keyboard.press("Enter")
            page.wait_for_timeout(2000)

        try:
            context.storage_state(path=SESSION_FILE)
        except Exception:
            pass

        return {
            "ok": True,
            "status": "SENT",
            "recipient": target_url,
            "note_included": bool(note_text),
            "sent_at": datetime.utcnow().isoformat(),
            "method": "cloakhq_persistent_stealth_automation"
        }
    except Exception as e:
        raise ValueError(f"LinkedIn CloakHQ Automation Error: {str(e)}")
    finally:
        context.close()

def send_linkedin_direct_message(
    profile_url: str,
    message_text: str,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Sends a Direct Message on LinkedIn using CloakHQ persistent stealth Chromium.
    """
    target_url = clean_linkedin_url(profile_url)
    context = get_stealth_context(headless=headless, humanize=True)
    page = context.pages[0] if context.pages else context.new_page()

    try:
        page.goto(target_url, wait_until="domcontentloaded", timeout=35000)
        page.wait_for_timeout(random.randint(2000, 3500))

        msg_btn = page.query_selector('button[aria-label*="Message"], button.artdeco-button:has-text("Message")')
        if not msg_btn or not msg_btn.is_visible():
            raise ValueError(f"Direct Message button not accessible on profile {target_url}.")

        msg_btn.click()
        page.wait_for_timeout(2000)

        composer = page.wait_for_selector('div.msg-form__contenteditable, div[role="textbox"][aria-label*="Write a message"]', timeout=8000)
        composer.click()
        page.wait_for_timeout(500)

        for char in message_text:
            if char == "\n":
                page.keyboard.down("Shift")
                page.keyboard.press("Enter")
                page.keyboard.up("Shift")
            else:
                page.keyboard.type(char)
            time.sleep(random.uniform(0.015, 0.04))

        page.wait_for_timeout(1000)

        send_btn = page.query_selector('button.msg-form__send-button, button[type="submit"]:has-text("Send")')
        if send_btn and send_btn.is_enabled():
            send_btn.click()
        else:
            page.keyboard.press("Enter")

        page.wait_for_timeout(3000)
        try:
            context.storage_state(path=SESSION_FILE)
        except Exception:
            pass

        return {
            "ok": True,
            "recipient": target_url,
            "sent_at": datetime.utcnow().isoformat(),
            "method": "cloakhq_persistent_stealth_automation"
        }
    except Exception as e:
        raise ValueError(f"LinkedIn Direct Message Error: {str(e)}")
    finally:
        context.close()

def launch_interactive_linkedin_login():
    """Launches headed CloakBrowser with persistent profile for one-time manual login."""
    print("Launching CloakBrowser for LinkedIn login. Please log in in the opened browser window...")
    os.makedirs(PROFILE_DIR, exist_ok=True)
    context = cloakbrowser.launch_persistent_context(
        user_data_dir=PROFILE_DIR,
        headless=False,
        humanize=True,
        viewport={"width": 1280, "height": 900}
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://www.linkedin.com/login")

    print("Waiting for login... CloakBrowser will save persistent state once you reach your feed.")
    for _ in range(180):  # 3 minutes
        time.sleep(1)
        url = page.url
        if "feed" in url or "mynetwork" in url or "messaging" in url:
            print(f"Login detected! (URL: {url})")
            time.sleep(3)
            context.storage_state(path=SESSION_FILE)
            print(f"LinkedIn CloakHQ session and persistent profile saved successfully!")
            break
    context.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        launch_interactive_linkedin_login()
    else:
        print("LinkedIn CloakHQ Persistent Stealth Browser Module. Status:", get_linkedin_browser_session_status())
