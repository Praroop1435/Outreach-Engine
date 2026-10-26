import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/praroopanand/Realm/Code/Personal Outrech")
CONFIG_PATH = PROJECT_ROOT / "config" / "candidate_profile.json"

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    profile = json.load(f)

personal = profile["personal"]

# Script to inject into Brave Browser on the Thales tab - NO single line comments!
js_code = f"""
try {{
    (function() {{
        const logs = [];

        function setVal(id, v) {{
            const el = document.getElementById(id);
            if (!el) {{
                logs.push("MISSING: " + id);
                return false;
            }}
            el.focus();
            el.value = v;
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            el.dispatchEvent(new Event('blur', {{ bubbles: true }}));
            logs.push("SET: " + id + " = " + el.value);
            return true;
        }}

        function setSelect(id, targetVal) {{
            const el = document.getElementById(id);
            if (!el) {{
                logs.push("MISSING SELECT: " + id);
                return false;
            }}
            el.focus();
            let matched = false;
            for (let i = 0; i < el.options.length; i++) {{
                if (el.options[i].value === targetVal || el.options[i].text.toLowerCase().includes(targetVal.toLowerCase())) {{
                    el.selectedIndex = i;
                    el.options[i].selected = true;
                    el.value = el.options[i].value;
                    matched = true;
                    break;
                }}
            }}
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            el.dispatchEvent(new Event('blur', {{ bubbles: true }}));
            logs.push("SELECT: " + id + " = " + el.value);
            return matched;
        }}

        function setCheck(id, checked) {{
            const el = document.getElementById(id);
            if (!el) {{
                logs.push("MISSING CHECK: " + id);
                return false;
            }}
            el.focus();
            if (el.checked !== checked) {{
                el.click();
            }}
            el.checked = checked;
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            logs.push("CHECK: " + id + " = " + el.checked);
            return true;
        }}

        setSelect("sourceType", "Social Media");

        setVal("cntryFields.firstName", "{personal['first_name']}");
        setVal("cntryFields.lastName", "{personal['last_name']}");
        setVal("cntryFields.localFirstName", "{personal['first_name']}");
        setVal("cntryFields.localPrimary", "{personal['last_name']}");
        setSelect("cntryFields.preferredName", "No");

        setVal("cntryFields.addressLine1", "Koramangala");
        setVal("cntryFields.city", "{personal['city']}");
        setVal("cntryFields.postalCode", "{personal['postal_code']}");

        setVal("email", "{personal['email']}");
        setSelect("deviceType", "Mobile");
        setSelect("phoneWidget.countryPhoneCode", "IND_91");
        setVal("phoneWidget.phoneNumber", "{personal['phone_national']}");

        setCheck("fitScoreYes", true);
        setCheck("shareProfile", true);
        setCheck("emailCommunication", true);

        window.name = JSON.stringify({{
            status: "SUCCESS",
            logs: logs,
            snapshot: {{
                sourceType: document.getElementById("sourceType") ? document.getElementById("sourceType").value : null,
                firstName: document.getElementById("cntryFields.firstName") ? document.getElementById("cntryFields.firstName").value : null,
                lastName: document.getElementById("cntryFields.lastName") ? document.getElementById("cntryFields.lastName").value : null,
                localFirstName: document.getElementById("cntryFields.localFirstName") ? document.getElementById("cntryFields.localFirstName").value : null,
                localPrimary: document.getElementById("cntryFields.localPrimary") ? document.getElementById("cntryFields.localPrimary").value : null,
                preferredName: document.getElementById("cntryFields.preferredName") ? document.getElementById("cntryFields.preferredName").value : null,
                addressLine1: document.getElementById("cntryFields.addressLine1") ? document.getElementById("cntryFields.addressLine1").value : null,
                city: document.getElementById("cntryFields.city") ? document.getElementById("cntryFields.city").value : null,
                postalCode: document.getElementById("cntryFields.postalCode") ? document.getElementById("cntryFields.postalCode").value : null,
                email: document.getElementById("email") ? document.getElementById("email").value : null,
                deviceType: document.getElementById("deviceType") ? document.getElementById("deviceType").value : null,
                countryPhoneCode: document.getElementById("phoneWidget.countryPhoneCode") ? document.getElementById("phoneWidget.countryPhoneCode").value : null,
                phoneNumber: document.getElementById("phoneWidget.phoneNumber") ? document.getElementById("phoneWidget.phoneNumber").value : null,
                fitScoreYes: document.getElementById("fitScoreYes") ? document.getElementById("fitScoreYes").checked : null,
                shareProfile: document.getElementById("shareProfile") ? document.getElementById("shareProfile").checked : null,
                emailCommunication: document.getElementById("emailCommunication") ? document.getElementById("emailCommunication").checked : null
            }}
        }});
    }})();
}} catch (e) {{
    window.name = JSON.stringify({{ status: "ERROR", error: e.message, stack: e.stack }});
}}
"""

escaped_js = js_code.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ')

apple_script = f'''
tell application "Brave Browser"
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "thalesgroup.com" then
                tell t
                    execute javascript "{escaped_js}"
                    return execute javascript "window.name;"
                end tell
            end if
        end repeat
    end repeat
    return "NO_THALES_TAB"
end tell
'''

res = subprocess.run(["osascript", "-e", apple_script], capture_output=True, text=True)
if res.returncode != 0:
    print("Error running AppleScript:", res.stderr)
    sys.exit(1)

out = res.stdout.strip()
try:
    parsed = json.loads(out)
    print("Execution Result:")
    print(json.dumps(parsed, indent=2))
except Exception as e:
    print("Could not parse JSON:", e)
    print("Raw output:", out)
