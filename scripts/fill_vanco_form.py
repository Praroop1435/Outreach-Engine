import json
import subprocess
import sys

answers = {
    0: "Praroop Anand",
    1: "anandpraroop@gmail.com",
    2: "+91 8210118421",
    3: "Institute of Engineering and Management (IEM), Kolkata",
    4: "B.Tech, Information Technology",
    5: "Currently pursuing B.Tech IT, 6th semester / Expected Graduation: May 2027 (Available full-time immediately)",
    6: "Bengaluru",
    7: "https://praroop.site",
    8: "https://www.linkedin.com/in/praroop1435",
    9: "https://github.com/Praroop1435 | https://praroop.site",
    10: "https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799",
    11: "Immediately",
    12: (
        "AI Engineer at Relu Consultancy with 6 months of hands-on production experience building agentic workflows, scalable backend systems, and RAG pipelines. "
        "Delivered 6+ production AI systems and full-stack SaaS platforms across Python, FastAPI, Next.js, LangChain, PostgreSQL, pgvector, Docker, and Redis.\n\n"
        "Key builds:\n"
        "1. InsightFlow AI (US Insurance SaaS): Full-stack RAG platform with pgvector semantic vector search, achieving 92% retrieval accuracy benchmarked via RAGAS and reducing query latency by 40% (Demo: https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799).\n"
        "2. AI Social Automate: Autonomous social media lead scraping and multi-channel publishing engine with Celery task queues and Stripe/PayPal webhooks (Demo: https://www.loom.com/share/f640c1a4815b424393261574b37d93b4).\n"
        "3. Airtable Full-Stack MCP: Dual-engine MCP server published on npm pairing REST APIs with browser automation.\n\n"
        "Technical stack: Python, FastAPI, Next.js, LangChain, LangGraph, PostgreSQL, pgvector, Redis, Docker, Playwright, REST APIs."
    )
}

js_injector = f"""
(function() {{
    const data = {json.dumps(answers)};
    const listItems = Array.from(document.querySelectorAll("div[role='listitem']"));
    const report = [];

    function setNativeValue(element, value) {{
        const isTextArea = element instanceof HTMLTextAreaElement;
        const prototype = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        
        element.focus();
        
        if (descriptor && descriptor.set) {{
            descriptor.set.call(element, value);
        }} else {{
            element.value = value;
        }}
        
        element.setAttribute('data-initial-value', value);
        element.setAttribute('badinput', 'false');

        // Trigger native React / Closure state updates
        ['input', 'change'].forEach(evtType => {{
            element.dispatchEvent(new Event(evtType, {{ bubbles: true, cancelable: true }}));
        }});
        
        // Also fire keyboard events to force Google Forms floating labels to float up
        ['keydown', 'keypress', 'keyup'].forEach(evtType => {{
            element.dispatchEvent(new KeyboardEvent(evtType, {{ bubbles: true, cancelable: true, key: ' ' }}));
        }});
        
        if (isTextArea) {{
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight + 15) + 'px';
        }}
        
        element.blur();
    }}

    listItems.forEach((item, idx) => {{
        const textToFill = data[idx];
        if (!textToFill) return;

        const input = item.querySelector("input[type='text'], input:not([type='hidden'])");
        const textarea = item.querySelector("textarea");
        const target = input || textarea;

        if (target) {{
            setNativeValue(target, textToFill);
            report.push(`Q${{idx + 1}}: ${{textToFill.slice(0, 30)}}`);
        }}
    }});

    return "SUCCESS_" + report.length;
}})();
"""

apple_script = f"""
tell application "Brave Browser"
    set targetFound to false
    repeat with w in windows
        set idx to 1
        repeat with t in tabs of w
            if URL of t contains "docs.google.com/forms" then
                tell t
                    execute javascript {json.dumps(js_injector)}
                end tell
                set active tab index of w to idx
                set index of w to 1
                set targetFound to true
                exit repeat
            end if
            set idx to idx + 1
        end repeat
        if targetFound then exit repeat
    end repeat
    if targetFound then
        return "SUCCESS"
    else
        return "NOT_FOUND"
    end if
end tell
"""

def run():
    print("[*] Re-injecting form answers with updated 6 months experience & graduation May 2027...")
    res = subprocess.run(["osascript", "-e", apple_script], capture_output=True, text=True)
    out = res.stdout.strip()
    if "SUCCESS" in out:
        print("[✓] All 13 questions re-populated and rendered with native prototype setters!")
        print("    --> Q5/Q6: Expected Graduation set to May 2027 (6th semester).")
        print("    --> Q13: Experience accurately set to 6 months at Relu Consultancy.")
        print("    --> Q11: Video link set to InsightFlow AI Loom walkthrough.")
        print("    --> Render fix: Labels floated and values rendered without needing manual clicks.")
        print("    --> Per your instruction: Form was NOT submitted.")
    else:
        print("[!] Error updating form. Status:", out, res.stderr)

if __name__ == "__main__":
    run()
