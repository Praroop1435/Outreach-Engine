"""UTM tagging for every outbound link.

Tags are added straight onto the destination URL (no redirect), so the link still points
at the same domain the reader sees. That keeps spam filters happy while praroop.site
analytics (Clarity) can attribute visits to a company.

Values never contain names or emails: campaign is the company slug, content is the lead id.
"""
import re
import urllib.parse
from typing import Optional

URL_REGEX = re.compile(r"(https?://[^\s<>\"'\)]+)", re.IGNORECASE)
TRAILING_PUNCT = ".,;:!?"


def slugify(value: Optional[str]) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or "prospect"


def add_utm(url: str, campaign: Optional[str], content: Optional[str] = None, source: str = "outreach", medium: str = "email") -> str:
    """Adds utm_* params to a URL, keeping any params it already has."""
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    existing = {k for k, _ in query}
    utm = {
        "utm_source": source,
        "utm_medium": medium,
        "utm_campaign": slugify(campaign),
        "utm_content": content,
    }
    query += [(k, v) for k, v in utm.items() if v and k not in existing]
    return urllib.parse.urlunparse(parsed._replace(path=parsed.path or "/", query=urllib.parse.urlencode(query)))


def split_trailing_punct(raw: str) -> tuple[str, str]:
    url = raw.rstrip(TRAILING_PUNCT)
    return url, raw[len(url):]


def tag_links(text: str, campaign: Optional[str], content: Optional[str] = None, source: str = "outreach", medium: str = "email") -> str:
    """Rewrites every http(s) link in plain text with UTM params."""
    def repl(match: re.Match) -> str:
        url, trailing = split_trailing_punct(match.group(1))
        return add_utm(url, campaign, content, source, medium) + trailing

    return URL_REGEX.sub(repl, text)


def lead_utm(lead) -> dict:
    """Standard UTM values for a lead."""
    return {"campaign": lead.company, "content": f"lead_{lead.id}" if getattr(lead, "id", None) else None}
