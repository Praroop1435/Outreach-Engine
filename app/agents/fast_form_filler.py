import os
import sys
import json
import time
import re
from typing import Dict, Any, Optional, List
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, ElementHandle, Locator

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
CONFIG_PATH = PROJECT_ROOT / "config" / "candidate_profile.json"
SCREENSHOTS_DIR = PROJECT_ROOT / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

def load_profile() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Candidate profile not found at {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

class FastFormFiller:
    def __init__(self, profile: Optional[Dict[str, Any]] = None, headless: bool = False):
        self.profile = profile or load_profile()
        self.headless = headless

    def _match_input_type(self, element: Locator, label_text: str, placeholder: str, name_attr: str, id_attr: str) -> Optional[str]:
        combined = f"{label_text} {placeholder} {name_attr} {id_attr}".lower()
        
        # Resume file upload
        if "resume" in combined or "cv" in combined or "curriculum" in combined:
            return "resume"
        
        # Email
        if "email" in combined or "e-mail" in combined:
            return "email"
            
        # First name specifically
        if re.search(r"\bfirst[\s_]*name\b", combined) or name_attr in ("first_name", "firstname", "fname"):
            return "first_name"
            
        # Last name specifically
        if re.search(r"\blast[\s_]*name\b", combined) or name_attr in ("last_name", "lastname", "lname"):
            return "last_name"
            
        # Full name
        if "full name" in combined or "your name" in combined or re.search(r"\bname\b", combined):
            return "full_name"
            
        # Phone
        if "phone" in combined or "mobile" in combined or "contact number" in combined or "telephone" in combined:
            return "phone"
            
        # LinkedIn
        if "linkedin" in combined:
            return "linkedin"
            
        # GitHub
        if "github" in combined:
            return "github"
            
        # Portfolio / Website
        if "portfolio" in combined or "website" in combined or "personal site" in combined or "url" in combined:
            return "portfolio"
            
        # Twitter / X
        if "twitter" in combined or re.search(r"\bx\.com\b", combined) or "x handle" in combined:
            return "twitter"
            
        # Location / City
        if "location" in combined or "city" in combined or "address" in combined or "where are you based" in combined:
            return "location"
            
        # Current company
        if "current company" in combined or "current employer" in combined:
            return "current_company"
            
        # Current title / role
        if "current title" in combined or "current role" in combined:
            return "current_title"
            
        # College / University
        if "college" in combined or "university" in combined or "school" in combined:
            return "college"

        # Degree / Branch
        if "degree" in combined or "branch" in combined or "major" in combined or "field of study" in combined:
            return "degree"

        # Graduation / Current status
        if "graduation" in combined or "passed out" in combined or "semester" in combined or "current status" in combined:
            return "graduation"

        # Notice period
        if "notice period" in combined or "how soon can you start" in combined:
            return "notice_period"

        # Sponsorship
        if "sponsorship" in combined or "visa" in combined:
            return "sponsorship"
            
        # Authorized to work
        if "authorized to work" in combined or "eligible to work" in combined:
            return "authorized_to_work"

        # Project links / Loom demos
        if "loom" in combined or "demo" in combined or "walkthrough" in combined or "video" in combined:
            return "loom_demo"

        # Cover letter / Note / Pitch
        if "cover letter" in combined or "why do you want" in combined or "additional info" in combined or "note" in combined or "anything else" in combined or "experience" in combined:
            return "pitch"

        return None

    def fill_form_page(self, page: Page, auto_submit: bool = False) -> Dict[str, Any]:
        """
        Scans all visible form inputs on the current page and fills them at high speed.
        """
        start_time = time.time()
        filled_fields = []
        p = self.profile["personal"]
        links = self.profile["links"]
        docs = self.profile["documents"]
        defaults = self.profile["default_answers"]
        cover = self.profile["cover_letter_snippets"]

        print(f"[*] Analyzing page: {page.title()} ({page.url})")
        page.wait_for_load_state("domcontentloaded")
        time.sleep(1.0) # brief settle time for dynamic React/Ashby frameworks

        # 1. File Uploads (Resume)
        resume_path = docs.get("resume_path")
        if resume_path and os.path.exists(resume_path):
            file_inputs = page.locator("input[type='file']").all()
            for finput in file_inputs:
                try:
                    finput.set_input_files(resume_path)
                    filled_fields.append("resume_file_upload")
                    print(f"   [+] Uploaded resume: {resume_path}")
                except Exception as e:
                    print(f"   [-] File upload failed: {e}")

        # 2. Text, Email, Tel, URL, Textarea inputs
        input_elements = page.locator("input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']):not([type='submit']), textarea").all()
        
        for el in input_elements:
            try:
                if not el.is_visible():
                    continue
                
                # Retrieve contextual identifiers
                tag_name = el.evaluate("e => e.tagName.toLowerCase()")
                name_attr = el.get_attribute("name") or ""
                id_attr = el.get_attribute("id") or ""
                placeholder = el.get_attribute("placeholder") or ""
                aria_label = el.get_attribute("aria-label") or ""
                
                # Find associated label text if exists
                label_text = ""
                if id_attr:
                    label_el = page.locator(f"label[for='{id_attr}']").first
                    if label_el.count() > 0:
                        label_text = label_el.inner_text()
                if not label_text:
                    # check parent label
                    parent_label = el.locator("xpath=ancestor::label").first
                    if parent_label.count() > 0:
                        label_text = parent_label.inner_text()

                matched_type = self._match_input_type(el, label_text, placeholder, name_attr, id_attr)
                
                current_val = el.input_value() if tag_name != "textarea" else el.inner_text()
                if current_val and len(current_val.strip()) > 0:
                    continue # already has value

                val_to_fill = None
                if matched_type == "first_name":
                    val_to_fill = p["first_name"]
                elif matched_type == "last_name":
                    val_to_fill = p["last_name"]
                elif matched_type == "full_name":
                    val_to_fill = p["full_name"]
                elif matched_type == "email":
                    val_to_fill = p["email"]
                elif matched_type == "phone":
                    val_to_fill = p["phone"]
                elif matched_type == "linkedin":
                    val_to_fill = links["linkedin"]
                elif matched_type == "github":
                    val_to_fill = links["github"]
                elif matched_type == "portfolio":
                    val_to_fill = links["portfolio"]
                elif matched_type == "twitter":
                    val_to_fill = links.get("twitter", "")
                elif matched_type == "location":
                    val_to_fill = p["location"]
                elif matched_type == "college":
                    val_to_fill = p.get("college", "Institute of Engineering and Management (IEM), Kolkata")
                elif matched_type == "degree":
                    val_to_fill = p.get("degree", "B.Tech, Information Technology")
                elif matched_type == "graduation":
                    val_to_fill = p.get("current_status", "Currently pursuing B.Tech IT, 6th semester (Expected Graduation: May 2027)")
                elif matched_type == "current_company":
                    val_to_fill = p["current_company"]
                elif matched_type == "current_title":
                    val_to_fill = p["current_title"]
                elif matched_type == "notice_period":
                    val_to_fill = defaults["notice_period"]
                elif matched_type == "loom_demo":
                    val_to_fill = links["loom_demo_2"]  # InsightFlow AI Loom walkthrough as preferred
                elif matched_type == "pitch":
                    val_to_fill = (
                        f"AI Engineer at Relu Consultancy with 6 months of hands-on production experience building agentic workflows, "
                        f"scalable FastAPI backends, and RAG pipelines (FastAPI, Next.js, LangChain, PostgreSQL, pgvector, Docker, Redis). "
                        f"Built InsightFlow AI (92% RAGAS accuracy) and AI Social Automate. Demo: {links['loom_demo_2']}"
                    )
                elif tag_name == "textarea":
                    val_to_fill = (
                        f"AI Engineer at Relu Consultancy with 6 months of production experience. "
                        f"Delivered 6+ AI systems across FastAPI, Next.js, pgvector, Docker, and Redis. "
                        f"InsightFlow AI Demo: {links['loom_demo_2']} | Portfolio: {links['portfolio']}"
                    )

                if val_to_fill:
                    el.fill(val_to_fill)
                    # Trigger native prototype setter to guarantee instant rendering in Google Forms / React
                    try:
                        el.evaluate("""(e, val) => {
                            const isTextArea = e instanceof HTMLTextAreaElement;
                            const proto = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                            if (setter) setter.call(e, val);
                            e.setAttribute('data-initial-value', val);
                            e.dispatchEvent(new Event('input', { bubbles: true }));
                            e.dispatchEvent(new Event('change', { bubbles: true }));
                            e.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
                            e.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
                        }""", val_to_fill)
                    except Exception:
                        pass

                    filled_fields.append(f"{matched_type}:{val_to_fill[:20]}")
                    print(f"   [+] Filled [{matched_type}]: {val_to_fill[:35]}...")
            except Exception as e:
                continue

        # 3. Radio Buttons & Checkboxes (Sponsorship / Legal authorization)
        try:
            # Check for "authorized to work" radios -> click Yes
            auth_radios = page.locator("input[type='radio']:visible, div[role='radio']:visible").all()
            for r in auth_radios:
                text_near = r.evaluate("e => e.closest('label')?.innerText || e.parentElement?.innerText || ''").lower()
                if "yes" in text_near and not ("sponsorship" in text_near and "require" in text_near):
                    r.click()
                    filled_fields.append("radio_authorized_yes")
                elif "no" in text_near and "sponsorship" in text_near:
                    r.click()
                    filled_fields.append("radio_sponsorship_no")
        except Exception:
            pass

        duration = round(time.time() - start_time, 2)
        print(f"[✓] Form processing completed in {duration}s. Filled fields: {len(filled_fields)}")

        # Capture verification screenshot
        timestamp = int(time.time())
        screenshot_path = SCREENSHOTS_DIR / f"form_filled_{timestamp}.png"
        page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"   [📸] Screenshot saved: {screenshot_path}")

        # Submission handling
        submitted = False
        if auto_submit:
            print("   [!] Auto-submit enabled: searching for submit button...")
            submit_selectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button:has-text('Submit Application')",
                "button:has-text('Submit application')",
                "button:has-text('Submit')",
                "button:has-text('Apply')",
                "button:has-text('Send application')"
            ]
            for sel in submit_selectors:
                btn = page.locator(sel).first
                if btn.count() > 0 and btn.is_visible():
                    print(f"   [!] Clicking submit button: {sel}")
                    btn.click()
                    time.sleep(3.0)
                    submitted = True
                    after_screenshot = SCREENSHOTS_DIR / f"form_submitted_{timestamp}.png"
                    page.screenshot(path=str(after_screenshot), full_page=True)
                    print(f"   [📸] Submission confirmation screenshot: {after_screenshot}")
                    break
        else:
            print("   [i] Review mode: Form filled but NOT submitted. Review screenshot or inspect browser.")

        return {
            "url": page.url,
            "title": page.title(),
            "duration_seconds": duration,
            "fields_filled_count": len(filled_fields),
            "fields": filled_fields,
            "screenshot": str(screenshot_path),
            "submitted": submitted
        }

    def process_url(self, url: str, auto_submit: bool = False) -> Dict[str, Any]:
        """
        Launches Playwright, navigates to the target URL, fills the form, and returns metrics.
        """
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=self.headless,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                result = self.fill_form_page(page, auto_submit=auto_submit)
                if not self.headless and not auto_submit:
                    print("   [i] Browser staying open for 10 seconds for visual inspection...")
                    time.sleep(10)
                return result
            finally:
                browser.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="High-Speed Form Filler Agent")
    parser.add_argument("--url", type=str, required=True, help="Job form URL to open and fill")
    parser.add_argument("--submit", action="store_true", help="Auto-click submit button (default is review mode)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()

    filler = FastFormFiller(headless=args.headless)
    res = filler.process_url(url=args.url, auto_submit=args.submit)
    print("\nResult:")
    print(json.dumps(res, indent=2))
