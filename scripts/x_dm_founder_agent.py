import sys
import json
import time
import subprocess
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
sys.path.insert(0, str(PROJECT_ROOT))

from sqlmodel import Session, select, col
from app.db import engine
from app.models import Lead, EmailMessage, MessageChannel, EmailDirection
from app.cache import app_cache

from app.services.utm import tag_links

# Candidate links and portfolio
PORTFOLIO_URL = "https://praroop.site"
LOOM_URL = "https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799"

def generate_human_dm(founder_name: str, company: str, hook: str = "", lead_id: int | None = None) -> str:
    first_name = founder_name.split()[0] if founder_name else "there"

    message = (
        f"Hey {first_name}, been following {company}.\n\n"
        f"I'm an AI engineer at Relu Consultancy, shipping production RAG, agent and backend systems for clients. "
        f"Here's a short Loom of one I built for a US insurance agency:\n"
        f"{LOOM_URL}\n\n"
        f"I'm looking for a remote AI or backend role. Open to a quick call? Happy to start with a small paid trial.\n"
        f"{PORTFOLIO_URL}"
    )
    # Every link carries UTM so portfolio visits can be traced back to the DM
    message = tag_links(message, campaign=company, content=f"lead_{lead_id}" if lead_id else None, medium="x_dm")

    # Strict validation: zero dashes
    assert "\u2014" not in message, "Forbidden em dash found"
    assert "\u2013" not in message, "Forbidden en dash found"
    assert " - " not in message, "Forbidden spaced hyphen found"

    return message

def execute_js_in_brave(js_code: str) -> str:
    escaped = js_code.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')
    ascript = f'''
    tell application "Brave Browser"
        repeat with w in windows
            repeat with t in tabs of w
                if URL of t contains "x.com" or URL of t contains "twitter.com" then
                    tell t
                        execute javascript "{escaped}"
                        return execute javascript "window.name;"
                    end tell
                end if
            end repeat
        end repeat
        return "NO_X_TAB"
    end tell
    '''
    res = subprocess.run(["osascript", "-e", ascript], capture_output=True, text=True)
    return res.stdout.strip()

def navigate_x_tab(url: str):
    ascript = f'''
    tell application "Brave Browser"
        repeat with w in windows
            repeat with t in tabs of w
                if URL of t contains "x.com" or URL of t contains "twitter.com" then
                    set URL of t to "{url}"
                    return "NAVIGATED"
                end if
            end repeat
        end repeat
        return "NO_X_TAB"
    end tell
    '''
    subprocess.run(["osascript", "-e", ascript], capture_output=True, text=True)

def copy_to_clipboard(text: str):
    subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)

def send_clipboard_in_active_window():
    ascript = '''
    tell application "Brave Browser" to activate
    delay 0.4
    tell application "System Events"
        keystroke "v" using command down
        delay 0.8
        key code 36
    end tell
    '''
    subprocess.run(["osascript", "-e", ascript], check=True)

def process_founder_dms(batch_size: int = None, auto_send: bool = True):
    print("=" * 65)
    print("X AUTONOMOUS FOUNDER DM AGENT - FULL EXECUTION")
    print(f"Batch Size: {'ALL REMAINING' if batch_size is None else batch_size} | Auto-Send: {auto_send}")
    print("=" * 65)

    with Session(engine) as session:
        # Prioritize DM_STAGED and PENDING_DM
        query = (
            select(Lead)
            .where(col(Lead.status).in_(["DM_STAGED", "PENDING_DM"]))
            .where(Lead.x_handle != None)
            .order_by(Lead.id)
        )
        if batch_size is not None:
            query = query.limit(batch_size)

        leads = session.exec(query).all()

        if not leads:
            print("No pending or staged leads found in Neon DB.")
            return

        print(f"Loaded {len(leads)} target founders to process from Neon DB.\n")
        sent_count = 0
        closed_count = 0
        invalid_count = 0

        for idx, lead in enumerate(leads, 1):
            handle = lead.x_handle.lstrip("@")
            founder_name = lead.first_name or "Founder"
            company = lead.company or "Startup"
            profile_url = f"https://x.com/{handle}"

            print(f"[{idx}/{len(leads)}] Target: @{handle} ({founder_name} at {company}) | Prior Status: {lead.status}")
            
            # 1. Navigate to profile
            navigate_x_tab(profile_url)
            time.sleep(3.5)

            # 2. Check profile existence and initial DM button
            check_js = """
            window.name = (function() {
                const dmBtn = document.querySelector("[data-testid='sendDMFromProfile']");
                const followBtn = document.querySelector("[data-testid$='-follow']");
                const unfollowBtn = document.querySelector("[data-testid$='-unfollow']");
                const isNotFound = document.body.innerText.includes("This account doesn’t exist") || document.body.innerText.includes("Account suspended");
                
                return JSON.stringify({
                    hasDmBtn: !!dmBtn,
                    exists: !isNotFound,
                    following: !!unfollowBtn,
                    url: window.location.href
                });
            })();
            """
            status_json = execute_js_in_brave(check_js)
            try:
                info = json.loads(status_json)
            except Exception:
                info = {"hasDmBtn": False, "exists": True}

            if not info.get("exists"):
                print(f"  ❌ Profile @{handle} does not exist or suspended. Marking INVALID_PROFILE.")
                lead.status = "INVALID_PROFILE"
                session.add(lead)
                session.commit()
                app_cache.invalidate()
                invalid_count += 1
                continue

            if not info.get("hasDmBtn"):
                print(f"  🔒 DM button not found for @{handle}. Marking DM_CLOSED.")
                print(f"     (Strict Guardrail: NOT visiting website for now).")
                lead.status = "DM_CLOSED"
                lead.notes = (lead.notes or "") + " | DM closed on profile"
                session.add(lead)
                session.commit()
                app_cache.invalidate()
                closed_count += 1
                continue

            # 3. Click DM button to inspect chat room
            open_dm_js = """
            window.name = (function() {
                const btn = document.querySelector("[data-testid='sendDMFromProfile']");
                if (btn) {
                    btn.click();
                    return "CLICKED";
                }
                return "BTN_NOT_FOUND";
            })();
            """
            execute_js_in_brave(open_dm_js)
            time.sleep(3.5)

            # 4. Pierce Shadow DOM on /i/chat to check if chat is writable or in read-only mode
            inspect_chat_js = """
            window.name = (function() {
                const sh = Array.from(document.querySelectorAll("*")).find(el => el.shadowRoot);
                if (!sh) {
                    return JSON.stringify({ canSend: false, reason: "NO_SHADOW_ROOT" });
                }
                const sr = sh.shadowRoot;

                // Dismiss any 'Not Now' prompt if present
                const notNowBtn = Array.from(sr.querySelectorAll("button")).find(b => b.textContent.trim() === "Not Now");
                if (notNowBtn) notNowBtn.click();

                const readOnlyNotice = sr.querySelector("[data-testid='dm-read-only-notice']");
                const bodyText = sr.textContent || "";
                const isReadOnly = (
                    !!readOnlyNotice ||
                    bodyText.includes("read-only mode") ||
                    bodyText.includes("You can't message this account") ||
                    bodyText.includes("has a closed inbox") ||
                    bodyText.includes("closed inbox") ||
                    bodyText.includes("Use X Number") ||
                    bodyText.includes("Only verified users can send Direct Message requests") ||
                    bodyText.includes("Get verified to message") ||
                    bodyText.includes("Get verified to continue") ||
                    bodyText.includes("Upgrade to Plus")
                );
                const textarea = sr.querySelector("[data-testid='dm-composer-textarea']");

                return JSON.stringify({
                    canSend: !isReadOnly && !!textarea,
                    isReadOnly: isReadOnly,
                    hasTextarea: !!textarea
                });
            })();
            """
            chat_status_json = execute_js_in_brave(inspect_chat_js)
            try:
                chat_info = json.loads(chat_status_json)
            except Exception:
                chat_info = {"canSend": False, "isReadOnly": True}

            if not chat_info.get("canSend"):
                print(f"  🔒 DM for @{handle} is restricted (Closed inbox / verified accounts only required).")
                print(f"     (Strict Guardrail: Marking DM_CLOSED, NOT visiting website).")
                lead.status = "DM_CLOSED"
                lead.notes = (lead.notes or "") + " | DM closed / verified only on X chat"
                session.add(lead)
                session.commit()
                app_cache.invalidate()
                closed_count += 1
                continue

            # 5. DM is OPEN and WRITABLE!
            print(f"  🔓 DM is fully OPEN and WRITABLE for @{handle}!")
            dm_text = generate_human_dm(founder_name, company, lead.custom_hook or "", lead_id=lead.id)
            print(f"  📝 Message:\n{'-'*40}\n{dm_text}\n{'-'*40}")

            if auto_send:
                print(f"  🚀 Sending DM to @{handle} via direct composer dispatch...")
                send_js = f"""
                window.name = (function() {{
                    const sh = Array.from(document.querySelectorAll('*')).find(el => el.shadowRoot);
                    if (!sh) return JSON.stringify({{ ok: false, error: "NO_SHADOW" }});
                    const sr = sh.shadowRoot;
                    const textarea = sr.querySelector("[data-testid='dm-composer-textarea']");
                    if (!textarea) return JSON.stringify({{ ok: false, error: "NO_TEXTAREA" }});

                    textarea.focus();
                    textarea.value = {json.dumps(dm_text)};
                    textarea.dispatchEvent(new Event("input", {{ bubbles: true }}));
                    textarea.dispatchEvent(new Event("change", {{ bubbles: true }}));

                    const sendBtn = sr.querySelector("[data-testid='dm-composer-send-button']");
                    if (!sendBtn) return JSON.stringify({{ ok: false, error: "NO_SEND_BTN" }});

                    sendBtn.click();
                    return JSON.stringify({{ ok: true }});
                }})();
                """
                send_res_str = execute_js_in_brave(send_js)
                time.sleep(2.5)

                lead.status = "DMED"
                lead.last_contacted_at = datetime.utcnow()
                lead.notes = (lead.notes or "") + " | Sent via X DM Agent"
                msg = EmailMessage(
                    lead_id=lead.id,
                    channel=MessageChannel.X_DM.value,
                    direction=EmailDirection.SENT.value,
                    sender="anand_praroop",
                    recipient=f"@{handle}",
                    subject=f"X DM to {founder_name} at {company}",
                    body_text=dm_text
                )
                session.add(lead)
                session.add(msg)
                session.commit()
                app_cache.invalidate()
                sent_count += 1
                print(f"  ✅ Message SENT! Status updated to DMED in Neon DB.\n")
            else:
                # Stage only (inject into composer without clicking send)
                stage_js = f"""
                window.name = (function() {{
                    const sh = Array.from(document.querySelectorAll('*')).find(el => el.shadowRoot);
                    if (!sh) return "NO_SHADOW";
                    const sr = sh.shadowRoot;
                    const textarea = sr.querySelector("[data-testid='dm-composer-textarea']");
                    if (!textarea) return "NO_TEXTAREA";

                    textarea.focus();
                    textarea.value = {json.dumps(dm_text)};
                    textarea.dispatchEvent(new Event("input", {{ bubbles: true }}));
                    return "STAGED";
                }})();
                """
                execute_js_in_brave(stage_js)
                lead.status = "DM_STAGED"
                session.add(lead)
                session.commit()
                app_cache.invalidate()
                print(f"  📋 Message STAGED in composer. Status: DM_STAGED in Neon DB.\n")

            time.sleep(2)

    print("\n" + "=" * 65)
    print("ALL REMAINING DMS EXECUTION COMPLETED!")
    print(f"Total Processed: {len(leads)} | Sent: {sent_count} | Closed: {closed_count} | Invalid: {invalid_count}")
    print("=" * 65)

if __name__ == "__main__":
    process_founder_dms(batch_size=None, auto_send=True)
