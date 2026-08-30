import re
import socket
import dns.resolver
from typing import Dict, Any, Tuple
from email_validator import validate_email, EmailNotValidError

# Common typo / dead domain mappings to prevent outreach misfires
DOMAIN_CORRECTIONS = {
    "braintrustdata.com": "braintrust.dev",
    "gmai.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "yaho.com": "yahoo.com",
    "outlok.com": "outlook.com"
}

def verify_email_deliverability(email_str: str, check_mx: bool = True) -> Dict[str, Any]:
    """
    Performs comprehensive pre-flight verification on an email address:
    1. Syntax & RFC compliance check
    2. Typo / dead domain detection
    3. Live DNS MX record lookup
    """
    clean_email = email_str.strip()
    result = {
        "valid": False,
        "email": clean_email,
        "normalized_email": clean_email,
        "domain": "",
        "mx_records": [],
        "error": None,
        "suggestion": None
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

    # 3. Live DNS MX Record Verification
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
            # Check for fallback A record
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
            # Allow through on DNS timeout to prevent blocking when offline, but flag warning
            result["valid"] = True
            result["error"] = "DNS MX lookup timed out; proceeding with caution."
            return result
        except Exception as e:
            result["error"] = f"DNS resolution error: {str(e)}"
            return result
    else:
        result["valid"] = True

    return result
