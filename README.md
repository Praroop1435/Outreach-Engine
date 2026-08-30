# Personal Outreach Engine

A high-performance, self-hosted personal outreach and prospect pipeline management engine built with **FastAPI**, **SQLite**, **Next.js 16**, **Tailwind CSS**, and **CloakHQ Stealth Browser Automation**.

Designed specifically for engineers and founders who want authentic, high-converting outreach across **Gmail SMTP**, **X (Twitter) Direct Messages**, and **LinkedIn Connection Requests** with **PDF resume attachments**, **disguised UTM parameter tracking**, and deep **Antigravity IDE** agentic pairing.

---

## ⚡ Core Features

- **Minimalist Dashboard (Next.js 16 + Tailwind CSS)**: Pure white `#ffffff` canvas, modern typography, zero emoji clutter, and real-time live data binding.
- **Local SQLite Database (SQLModel & Pydantic)**: Full local data ownership, privacy, and zero telemetry leakage.
- **Multi-Channel Dispatch Engine**:
  - **Email (Gmail SMTP SSL)**: Send personalized outreach directly from your Gmail address with `Praroop_Anand.pdf` resume attached and auto-disguised UTM links.
  - **X (Twitter) Stealth DMs**: Cookie-based CloakHQ stealth Chromium browser automation with human-like typing delays, auto-recovery PIN decryption (`1435`), and modern composer targeting (bypasses $100/mo API paywalls).
  - **LinkedIn Connection Requests & DMs**: CloakHQ persistent profile automation (`.linkedin_profile/`) with 300-character note validation and anti-bot evasion.
- **Resume PDF Management**: Automatically attaches your PDF resume (`resume/Praroop_Anand.pdf`) to outbound emails. Includes an in-dashboard file uploader to swap resumes at any time.
- **Disguised UTM Parameter Link Tracking**:
  - Links look natural in emails (e.g. `Portfolio: https://praroop.site`).
  - Underlying HTML anchor tags pass rich UTM attribution (`utm_source=outreach&utm_campaign=outreach_{company}&utm_content={name}`).
  - Built-in **Link Clicks Pop-up Modal** in the dashboard to audit which prospect clicked which link and when.
- **Interactive Template Builder**: Create and edit reusable cold outreach and follow-up templates with one-click placeholder chips (`+{{firstName}}`, `+{{company}}`, `+{{role}}`, `+{{custom_hook}}`) and subject presets.
- **CSV & Spreadsheet Importer**: Paste CSV text or upload `.csv` files with automatic column detection.
- **Antigravity IDE Agentic Integration**: Autonomous batch research, lead discovery, verification, and dispatch via conversational AI commands.

---

## 🤖 Using with Antigravity IDE

This repository is optimized for autonomous operation inside **Antigravity IDE**. You can run complete end-to-end outreach cycles directly through natural language instructions to the Antigravity agent.

### 1. Autonomous Founder Discovery & Dispatch
In Antigravity IDE chat, you can prompt the agent:
> *"Find 6 YC S24/W24 AI founders building developer tooling, research their custom hooks, and send personalized emails with my resume attached."*

The Antigravity agent will:
1. Search and verify founder contacts, company hooks, and open X/LinkedIn handles.
2. Insert prospect records into local SQLite database (`outreach.db`).
3. Compile personalized emails highlighting your production projects (`aisocialautomate.com`, `portal.e360insurance.com`, `praroop.site`).
4. Attach `resume/Praroop_Anand.pdf` and dispatch via Gmail SMTP with UTM tracking.

### 2. Autonomous Stealth X & LinkedIn DMs
> *"Check which founders have open DMs on X and send them a tailored 2-sentence pitch using CloakHQ."*

The Antigravity agent will:
1. Launch CloakHQ stealth Chromium with your saved session cookies.
2. Navigate to profiles, test DM availability, solve PIN recovery prompts automatically, and enter text with human-like typing cadence.
3. Log sent message records in the local SQLite database.

### 3. Background Autonomous Monitoring (`/goal` & `/schedule`)
* **Run continuous outreach:** Type `/goal` in the chat to let the agent autonomously research leads, verify deliverability, and dispatch outreach over extended sessions.
* **Scheduled Follow-ups:** Use `/schedule` or ask the agent to set a background cron/timer to check for email replies and link clicks every few hours.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Python 3.13, FastAPI, SQLModel, SQLite, Pydantic, UV |
| **Stealth Browser** | CloakHQ (`cloakbrowser`), Playwright, Chromium Persistent Profiles |
| **Frontend UI** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TypeScript |
| **Protocols** | SMTP (SSL:465), IMAP (SSL:993), Headless / Headed Stealth Chromium |
| **Package Manager** | `uv` (Python), `npm` (Frontend) |

---

## 🚀 Quickstart Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Praroop1435/Outreach-Engine.git
cd Outreach-Engine
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```ini
# Gmail SMTP Configuration
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Local SQLite Database
DATABASE_URL=sqlite:///./outreach.db
PORT=8437

# Resume Configuration
RESUME_PATH=resume/Praroop_Anand.pdf

# Optional X Encrypted Chat PIN
X_CHAT_PIN=1435
```

### 3. Add Your Resume (PDF)

```bash
mkdir -p resume
cp /path/to/your/resume.pdf resume/Praroop_Anand.pdf
```
*(You can also upload or replace your resume directly from the dashboard header).*

---

### 4. Start the Backend API (FastAPI + UV)

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8437 --reload
```

Interactive API documentation will be available at:
👉 **`http://127.0.0.1:8437/docs`**

---

### 5. Start the Frontend Dashboard (Next.js 16)

In a separate terminal window:

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

Open your browser at:
👉 **`http://localhost:3001`**

---

## 🔐 Cookie Setup for Stealth Browser Automation

### X (Twitter) Session Setup
1. In the dashboard header, click **"X Setup"** &rarr; **"Export Cookies"**.
2. Export your cookies from your browser (e.g. using *EditThisCookie* or *Cookie-Editor* on `x.com`) and paste the JSON array.
3. Required cookies: `auth_token`, `ct0`, `twid`.
4. CloakHQ will automatically ingest these into `x_browser_session.json` (gitignored).

### LinkedIn Session Setup
1. In the dashboard header, click **"LinkedIn Setup"**.
2. Paste your exported `.linkedin.com` cookie array (must include `li_at`, `JSESSIONID`, `bcookie`, `bscookie`).
3. CloakHQ will initialize a persistent stealth profile in `.linkedin_profile/` (gitignored) for background connection requests and InMails.

---

## 📁 Repository Structure

```
Outreach-Engine/
├── app/
│   ├── config.py                       # Pydantic environment settings
│   ├── db.py                           # SQLite engine, session & template seeding
│   ├── models.py                       # SQLModel schemas (Lead, EmailMessage, LinkClick, EmailTemplate)
│   ├── main.py                         # FastAPI application & router mounting
│   ├── routers/
│   │   ├── analytics.py                # Analytics KPI endpoints & Link Click audits
│   │   ├── leads.py                    # Lead CRUD, CSV import, and email dispatch
│   │   ├── linkedin.py                 # LinkedIn cookie ingestion & automated connect
│   │   ├── resume.py                   # Resume PDF upload, status & download
│   │   ├── templates.py                # Outreach template builder
│   │   ├── tracking.py                 # Disguised UTM link redirection & click logging
│   │   └── twitter.py                  # X DM automation & session management
│   └── services/
│       ├── email_sender.py             # Gmail SMTP dispatcher with UTM tracking & PDF attachment
│       ├── linkedin_browser_automation.py # CloakHQ persistent LinkedIn stealth automation
│       ├── mailbox_sync.py             # Gmail IMAP background sync engine
│       ├── sheet_importer.py           # CSV & spreadsheet parser
│       └── x_browser_automation.py     # CloakHQ stealth X DM automation & PIN recovery
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── globals.css             # Tailwind CSS styles
│   │       ├── layout.tsx              # Root layout & Google Inter font
│   │       └── page.tsx                # Complete 4-Channel Outreach Dashboard
│   ├── next.config.ts                  # Next.js config with API proxy rewrites
│   └── package.json
├── resume/
│   └── Praroop_Anand.pdf               # Attached resume PDF
├── .gitignore                          # Ignores credentials, sessions, and SQLite DBs
├── pyproject.toml                      # Python dependencies (managed via uv)
└── README.md
```

---

## 🎯 Outreach Workflow

1. **Add Prospects**: Click **"Add Contact"** or **"Import Sheet / CSV"** to bulk import founder leads.
2. **Select Channel**: Open the **Compose Modal** and pick from:
   - `EMAIL` (Gmail SMTP with PDF resume & UTM tracking)
   - `X_DM` (CloakHQ Stealth Direct Message)
   - `LINKEDIN_CONNECT` (CloakHQ Connection Note with <300 char validation)
   - `LINKEDIN_DM` (Direct Message to existing connection)
3. **Dispatch & Track**: Review the rendered preview and click Send. Real-time delivery status and click telemetry update instantly on your dashboard.

---

## 👤 Author & License

Created by **[Praroop Anand](https://praroop.site)**  
GitHub: [@Praroop1435](https://github.com/Praroop1435)  
Portfolio: [praroop.site](https://praroop.site)

Released under the **MIT License**.
