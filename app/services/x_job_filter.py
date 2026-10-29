"""Scores X posts as job leads for Praroop: remote, AI / backend / automation, intern or junior, paid.

Rule-based on purpose: it runs every scan with no API cost, and every point is explainable in the UI
through the tags it returns.
"""
import re
from typing import Optional

MATCH_THRESHOLD = 5   # shown on the X Radar page
NOTIFY_THRESHOLD = 8  # also pops a macOS notification

def _rx(*words: str) -> re.Pattern:
    return re.compile(r"(?<![\w])(" + "|".join(words) + r")(?![\w])", re.IGNORECASE)

HIRING = _rx(r"hiring", r"we'?re hiring", r"i'?m hiring", r"looking for (?:an?|our|some)", r"join (?:us|our team)",
             r"open (?:role|position)s?", r"apply", r"send (?:me )?(?:your )?(?:resume|cv|portfolio)", r"dm me",
             r"dms? (?:are )?open", r"internship", r"opening")
# Job seekers and engagement bait look like hiring posts but are not
SEEKER = _rx(r"looking for (?:a |an )?(?:job|internship|role|opportunit\w+)", r"open to work", r"#opentowork",
             r"hire me", r"anyone hiring", r"i need a job", r"got (?:the )?offer", r"fumbled", r"rejected",
             r"comment (?:below|\"?interested\"?)", r"drop (?:your|a) comment", r"never sleep", r"who's looking for")

ROLE = _rx(r"ai engineer", r"ml engineer", r"llm", r"genai", r"gen ai", r"agents?", r"agentic", r"rag",
           r"backend", r"back-end", r"python", r"fastapi", r"django", r"full[- ]?stack", r"automation", r"n8n",
           r"sde", r"software engineer", r"founding engineer", r"applied ai", r"node\.?js", r"next\.?js",
           r"forward deployed", r"ai", r"ml", r"developers?", r"engineers?", r"tech intern", r"mern", r"golang",
           r"sde[- ]?(?:1|i|intern)", r"software engineer intern")
AI_ROLES = {"ai engineer", "llm", "genai", "gen ai", "agents", "agent", "agentic", "rag", "applied ai", "ml engineer", "ai", "ml"}
BACKEND_ROLES = {"backend", "back-end", "python", "fastapi", "django", "golang", "node.js", "nodejs", "n8n", "automation"}
FULLSTACK_ROLES = {"full stack", "fullstack", "full-stack", "mern", "next.js", "nextjs"}
JUNIOR = _rx(r"interns?", r"internship", r"freshers?", r"new grads?", r"entry[- ]level", r"junior", r"associate",
             r"0[-–]1 ?y(?:ea)?rs?", r"0[-–]2 ?y(?:ea)?rs?", r"1[-–]2 ?y(?:ea)?rs?", r"6 months", r"students?",
             r"202[5-8] (?:batch|grads?)", r"ppo", r"experience: none")
REMOTE = _rx(r"remote", r"wfh", r"work from home", r"anywhere", r"fully distributed")
INDIA = _rx(r"india", r"indian", r"bengaluru", r"bangalore", r"lpa", r"inr", r"stipend", r"₹")
SENIOR = _rx(r"senior", r"staff", r"principal", r"lead", r"head of", r"[5-9]\+ ?y(?:ea)?rs?", r"10\+ ?y(?:ea)?rs?")
ONSITE = _rx(r"on-?site", r"in-?office", r"in person", r"relocat\w+", r"hybrid")
US_ONLY = re.compile(r"(?:\b(?:us|usa|u\.s\.|eu|uk|canada|latam|europe|americas)[- ]only\b|must be (?:based )?in the (?:us|usa)|"
                     r"us citizens?|green card|remote\s*[-–(,:|]\s*(?:united states|usa|us|canada|latam|europe|eu|uk|emea|americas)\b|"
                     r"(?:multiple )?us locations?|\(us\)|remote \(us\)|jobs usa|🇺🇸|"
                     # "Remote (Australia, Singapore)" style lists that leave India out
                     r"remote\s*\((?![^)]*(?:global|worldwide|anywhere|india|apac|asia))[^)]{2,60}\))", re.IGNORECASE)
NON_ENG = _rx(r"evaluators?", r"annotat\w+", r"graphic designer", r"designer", r"sales", r"marketing", r"recruiter",
              r"account executive", r"strategist", r"\w*\s?manager", r"content writer", r"trader", r"problem finder",
              r"operations", r"hr", r"analyst")
UNPAID = _rx(r"unpaid", r"no stipend", r"equity only", r"volunteer")

PAY = re.compile(r"(₹\s?[\d,.]+\s?(?:k|l|lpa|lakh|/\s?month|/mo|per month)?(?:\s?[-–to]+\s?₹?\s?[\d,.]+\s?(?:k|l|lpa|lakh)?)?(?:\s?/\s?month|\s?per month|\s?lpa)?"
                 r"|[\d.]+\s?(?:-|–|to)\s?[\d.]+\s?lpa|[\d.]+\s?lpa|\$\s?[\d,.]+\s?k?(?:\s?[-–]\s?\$?[\d,.]+\s?k?)?)", re.IGNORECASE)


def extract_pay(text: str) -> Optional[str]:
    m = PAY.search(text)
    return m.group(0).strip() if m else None


def score_post(text: str) -> tuple[int, list[str]]:
    """Returns (score, tags). Posts at or above MATCH_THRESHOLD are worth a look."""
    t = text or ""
    tags: list[str] = []
    score = 0

    if not HIRING.search(t):
        return 0, ["not-hiring"]
    if SEEKER.search(t):
        return 0, ["job-seeker"]

    roles = {m.lower() for m in ROLE.findall(t)}
    if not roles:
        return 0, ["off-role"]
    score += min(3, len(roles)) + 1
    kinds = [k for k, group in (("ai", AI_ROLES), ("backend", BACKEND_ROLES), ("full-stack", FULLSTACK_ROLES)) if roles & group]
    tags.extend(kinds or ["eng"])

    if JUNIOR.search(t):
        score += 3
        tags.append("intern/junior")
    if REMOTE.search(t):
        score += 2
        tags.append("remote")
    if INDIA.search(t):
        score += 1
        tags.append("india")
    pay = extract_pay(t)
    if pay and not pay.startswith("$"):
        score += 1
        tags.append("pay")

    headline = t.strip().split("\n", 1)[0]
    if SENIOR.search(headline) or (SENIOR.search(t) and not JUNIOR.search(t)):
        score -= 5
        tags.append("senior")
    if ONSITE.search(t) and not REMOTE.search(t):
        score -= 3
        tags.append("onsite")
    if US_ONLY.search(t):
        score -= 6
        tags.append("region-locked")
    if NON_ENG.search(headline) or (NON_ENG.search(t) and not (roles - {"ai", "ml", "developers", "developer", "engineers", "engineer"})):
        score -= 4
        tags.append("non-eng")
    if UNPAID.search(t):
        score -= 5
        tags.append("unpaid")

    return score, tags
