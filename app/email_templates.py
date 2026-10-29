# Default outreach templates. Facts come from config/projects.json.
# Rules: under 120 words, one Loom per email, one clear ask, no tracking links, no em dashes.
# Placeholders: {{firstName}}, {{company}}, {{custom_hook}}, {{job_role}} (read from lead.notes).

LOOM_INSIGHTFLOW = "https://www.loom.com/share/5f715f784c3142e690f16f8df66f3799"
LOOM_SOCIAL_AUTOMATE = "https://www.loom.com/share/f640c1a4815b424393261574b37d93b4"

DEFAULT_TEMPLATES = [
    {
        "name": "1. Founder Cold Email (Loom First)",
        "category": "Cold Outreach",
        "subject_template": "Loom for {{company}}",
        "body_template": f"""Hi {{{{firstName}}}},

Been reading up on {{{{company}}}}, especially {{{{custom_hook}}}}.

I'm Praroop, an AI engineer at Relu Consultancy. I've shipped 6+ production AI systems for international clients. Rather than pitch, here's a short Loom of one of them:

InsightFlow AI, a 5-module AI platform for a US insurance agency. RAG on pgvector, 92% on RAGAS, 40% faster search.
{LOOM_INSIGHTFLOW}

I work remote and I'm looking for my next AI or backend role. If {{{{company}}}} needs this kind of work, are you open to a 15 minute call this week? Happy to start with a small paid trial.

Praroop
https://praroop.site""",
    },
    {
        "name": "2. Posted Role Application (Two Looms)",
        "category": "Job Application",
        "subject_template": "{{job_role}} at {{company}}",
        "body_template": f"""Hi {{{{firstName}}}},

Saw the remote {{{{job_role}}}} opening at {{{{company}}}} and wanted to reach you directly, not just through the form.

I'm an AI engineer at Relu Consultancy, shipping production AI systems for international clients. Two that match this role:

1. InsightFlow AI: RAG + LLM platform for a US insurance agency (FastAPI, pgvector, Claude). 92% on RAGAS.
Loom: {LOOM_INSIGHTFLOW}

2. AI Social Automate: full backend in Django, Celery and Redis with idempotent Stripe and PayPal webhooks.
Loom: {LOOM_SOCIAL_AUTOMATE}

Resume attached. Can we do a 15 minute chat this week? If you have a take-home or trial task, send it over and I'll start today.

Praroop
https://praroop.site""",
    },
    {
        "name": "3. Ultra Short (Mobile Friendly)",
        "category": "Cold Outreach",
        "subject_template": "quick one, {{firstName}}",
        "body_template": f"""Hi {{{{firstName}}}},

Short version: I build production AI systems (RAG, agents, async backends) and I think I could help {{{{company}}}} ship faster.

Here's one I built for a US insurance agency:
{LOOM_INSIGHTFLOW}

Worth a 15 minute call? Happy to start with a small paid trial so you can judge the work, not the email.

Praroop
https://praroop.site""",
    },
    {
        "name": "4. Internship (Student, Honest Framing)",
        "category": "Job Application",
        "subject_template": "AI engineering intern for {{company}}",
        "body_template": f"""Hi {{{{firstName}}}},

I'm a final-year B.Tech student (graduating May 2027), and for the last 6 months I've been shipping production AI systems at Relu Consultancy. I'd love to do the same at {{{{company}}}}.

The one I'm proudest of: InsightFlow AI, a RAG platform for a US insurance agency. 92% on RAGAS, 40% faster search with pgvector.
Loom: {LOOM_INSIGHTFLOW}

I'm looking for a remote, paid internship and can start right away. Resume attached.

Open to a 15 minute call this week? Or give me a small task and I'll send it back within 48 hours.

Praroop
https://praroop.site""",
    },
    {
        "name": "5. Follow-up 1 (Day 3-4, Second Loom)",
        "category": "Follow-up",
        "subject_template": "Re: Loom for {{company}}",
        "body_template": f"""Hi {{{{firstName}}}},

Bumping this in case it got buried. One more thing I built, this time on the backend side:

AI Social Automate: Django, Celery and Redis, idempotent Stripe and PayPal webhooks, 500+ leads scraped a day.
{LOOM_SOCIAL_AUTOMATE}

Still happy to do a 15 minute call, or start with a small paid trial for {{{{company}}}}. Whichever is easier for you.

Praroop""",
    },
    {
        "name": "6. Follow-up 2 (Day 8, Close Out)",
        "category": "Follow-up",
        "subject_template": "Re: Loom for {{company}}",
        "body_template": """Hi {{firstName}},

Last note from me, I don't want to clutter your inbox.

If {{company}} needs help with AI or backend work, now or later, just reply "yes" and I'll send a few times. If the timing is off, a one-word "no" helps too.

Thanks for reading,
Praroop""",
    },
    {
        "name": "7. Automation Role (n8n + AI Workflows)",
        "category": "Job Application",
        "subject_template": "automation engineer for {{company}}",
        "body_template": f"""Hi {{{{firstName}}}},

Saw what {{{{company}}}} is doing with {{{{custom_hook}}}}. My guess is a good chunk of the ops behind it could run on autopilot.

That's what I do at Relu Consultancy. A few live examples:
- n8n + GPT-4o-mini workflows processing 200+ WhatsApp and Telegram offers a week
- A Gemini + Crawl4AI pipeline that enriches 100+ leads nightly, cutting research time ~85%
- A full social automation backend on Celery and Redis: {LOOM_SOCIAL_AUTOMATE}

I'm looking for a remote automation or AI role. Open to a 15 minute call this week? Happy to start with a small paid trial.

Praroop
https://praroop.site""",
    },
]
