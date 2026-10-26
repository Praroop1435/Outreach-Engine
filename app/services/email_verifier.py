import os
import re
import socket
import urllib.request
import urllib.parse
import json
import logging
from typing import Dict, Any, Tuple
import dns.resolver
from email_validator import validate_email, EmailNotValidError
from app.config import settings

logger = logging.getLogger("email_verifier")

# Common typo / dead domain mappings to prevent outreach misfires
DOMAIN_CORRECTIONS = {
    "braintrustdata.com": "braintrust.dev",
    "gmai.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "outlok.com": "outlook.com"
}

RESTRICTED_GROUP_USERS = {"team", "all", "group", "internal", "staff", "everyone", "dev", "engineering"}

def verify_via_bouncify(email_str: str, api_key: str) -> Dict[str, Any]:
    """Verify deliverability via Bouncify API v1 with strict deliverability filtering."""
    encoded_email = urllib.parse.quote(email_str.strip())
    url = f"https://api.bouncify.io/v1/verify?apikey={api_key}&email={encoded_email}"
    req = urllib.request.Request(url, headers={"User-Agent": "Personal-Outreach-Engine/1.0"})
    
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    result_status = data.get("result", "").lower()
    is_spamtrap = data.get("spamtrap", 0) == 1
    is_disposable = data.get("disposable", 0) == 1
    is_role = data.get("role", 0) == 1
    user_part = data.get("user", "").lower()
    
    if is_spamtrap:
        return {
            "valid": False,
            "status": "spamtrap",
            "error": "Bouncify flagged email as known spamtrap.",
            "provider": "bouncify",
            "raw": data
        }
    if is_disposable:
        return {
            "valid": False,
            "status": "disposable",
            "error": "Bouncify flagged domain as disposable/temporary.",
            "provider": "bouncify",
            "raw": data
        }
    if result_status == "undeliverable":
        return {
            "valid": False,
            "status": "undeliverable",
            "error": f"Bouncify: undeliverable ({data.get('message', 'address will bounce')})",
            "provider": "bouncify",
            "raw": data
        }
    if result_status in ("accept all", "accept_all"):
        return {
            "valid": False,
            "status": "accept_all_catchall",
            "error": "Bouncify flagged domain as accept-all catchall. Mailbox existence cannot be verified.",
            "provider": "bouncify",
            "raw": data
        }
    if is_role and user_part in RESTRICTED_GROUP_USERS:
        return {
            "valid": False,
            "status": "restricted_group",
            "error": f"Bouncify role distribution group '{user_part}@' flagged. Google Groups / distribution lists block external senders.",
            "provider": "bouncify",
            "raw": data
        }
        
    is_deliverable = (result_status == "deliverable")
    return {
        "valid": is_deliverable,
        "status": result_status,
        "error": None if is_deliverable else f"Bouncify status: {result_status}",
        "provider": "bouncify",
        "raw": data
    }

def verify_email_deliverability(email_str: str, check_mx: bool = True) -> Dict[str, Any]:
    """
    Performs comprehensive pre-flight verification on an email address:
    1. Syntax & RFC compliance check
    2. Typo / dead domain detection
    3. Bouncify live API deliverability check (if BOUNCIFY_API_KEY configured)
    4. Live DNS MX record lookup (fallback)
    """
    clean_email = email_str.strip()
    result = {
        "valid": False,
        "email": clean_email,
        "normalized_email": clean_email,
        "domain": "",
        "mx_records": [],
        "error": None,
        "suggestion": None,
        "verifier": "dns_mx"
    }

    if not clean_email or "@" not in clean_email:
        result["error"] = "Invalid email format: missing '@' character."
        return result

    # 1. Syntax Validation via email_validator
    try:
        validated = validate_email(clean_email, check_deliverability=False)
        result["normalized_email"] = validated.normalized
        domain = validated.domain.lower()
        result["domain"] = domain
    except EmailNotValidError as e:
        result["error"] = f"Invalid email syntax: {str(e)}"
        return result

    # 2. Check for domain corrections / known misconfigurations
    if domain in DOMAIN_CORRECTIONS:
        suggested_domain = DOMAIN_CORRECTIONS[domain]
        local_part = result["normalized_email"].split("@")[0]
        suggested_email = f"{local_part}@{suggested_domain}"
        result["suggestion"] = suggested_email
        if domain == "braintrustdata.com":
            result["error"] = f"Domain '{domain}' does not accept direct mail for this user. Did you mean '{suggested_email}'?"
            return result

    # 3. Bouncify verification if key configured
    bouncify_key = settings.BOUNCIFY_API_KEY or os.getenv("BOUNCIFY_API_KEY")
    if bouncify_key:
        try:
            bouncify_res = verify_via_bouncify(clean_email, bouncify_key)
            result["verifier"] = "bouncify"
            result["bouncify_status"] = bouncify_res.get("status")
            if not bouncify_res["valid"]:
                result["valid"] = False
                result["error"] = bouncify_res["error"]
                return result
            else:
                result["valid"] = True
                return result
        except Exception as exc:
            logger.error(f"Bouncify check failed for {clean_email} ({exc}). Strict mode active: rejecting without Bouncify confirmation.")
            result["verifier"] = "bouncify"
            result["valid"] = False
            result["error"] = f"Bouncify verification timed out or failed ({exc}). Mailbox deliverability unconfirmed."
            return result

    # 4. Live DNS MX Record Verification (fallback)
    if check_mx:
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 3.0
            resolver.lifetime = 4.0
            
            answers = resolver.resolve(domain, 'MX')
            mx_list = [str(r.exchange).rstrip('.') for r in answers]
            
            if not mx_list:
                result["error"] = f"No MX (Mail Exchange) records found for domain '{domain}'."
                return result
                
            result["mx_records"] = mx_list
            result["valid"] = True
            
        except (dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
            result["error"] = f"Domain '{domain}' does not exist (NXDOMAIN)."
            return result
        except dns.resolver.NoAnswer:
            try:
                a_answers = resolver.resolve(domain, 'A')
                if a_answers:
                    result["valid"] = True
                    result["mx_records"] = [str(domain)]
                else:
                    result["error"] = f"Domain '{domain}' has no MX or A records configured."
                    return result
            except Exception:
                result["error"] = f"Domain '{domain}' has no valid mail records."
                return result
        except dns.resolver.Timeout:
            result["valid"] = True
            result["error"] = "DNS MX lookup timed out; proceeding with caution."
            return result
        except Exception as e:
            result["error"] = f"DNS resolution error: {str(e)}"
            return result
    else:
        result["valid"] = True

    return result
