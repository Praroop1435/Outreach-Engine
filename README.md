# Personal Outreach Engine

A high-performance, self-hosted personal outreach and prospect pipeline management engine built with **FastAPI**, **SQLite**, **Next.js 16**, and **Tailwind CSS**.

Designed specifically for engineers and founders who want authentic, high-converting outreach via **Gmail SMTP** with **PDF resume attachments**, **disguised UTM parameter tracking**, and deep **Antigravity IDE** agentic pairing.

---

## Core Features

- **Minimalist Dashboard (Next.js 16 + Tailwind CSS)**: Pure white `#ffffff` canvas, modern typography, zero emoji clutter, and real-time live data binding.
- **Local SQLite Database (SQLModel & Pydantic)**: Full local data ownership, privacy, and zero telemetry leakage.
- **Email Dispatch Engine (Gmail SMTP SSL)**: Send personalized outreach directly from your Gmail address with `Praroop_Anand.pdf` resume attached and auto-disguised UTM links.
- **Background Reply & Bounce Sync (IMAP SSL)**: Automated background sync loop checks inbox every 5 minutes for replies and bounces.
- **Resume PDF Management**: Automatically attaches your PDF resume (`resume/Praroop_Anand.pdf`) to outbound emails. Includes an in-dashboard file uploader to swap resumes at any time.
- **Disguised UTM Parameter Link Tracking**:
  - Links look natural in emails (e.g. `Portfolio: https://praroop.site`).
  - Underlying HTML anchor tags pass rich UTM attribution (`utm_source=outreach&utm_campaign=outreach_{company}&utm_content={name}`).
  - Built-in **Link Clicks Pop-up Modal** in the dashboard to audit which prospect clicked which link and when.
- **Interactive Template Builder**: Create and edit reusable cold outreach and follow-up templates with one-click placeholder chips (`+{{firstName}}`, `+{{company}}`, `+{{role}}`, `+{{custom_hook}}`) and subject presets.
- **CSV & Spreadsheet Importer**: Paste CSV text or upload `.csv` files with automatic column detection and MX deliverability checks.
- **Antigravity IDE Agentic Integration**: Autonomous batch research, lead discovery, verification, and dispatch via conversational AI commands.

---

## Using with Antigravity IDE

This repository is optimized for autonomous operation inside **Antigravity IDE**. You can run complete end-to-end outreach cycles directly through natural language instructions to the Antigravity agent.

### 1. Autonomous Founder Discovery & Dispatch
In Antigravity IDE chat, you can prompt the agent:
> *"Find 6 YC AI founders building developer tooling, research their custom hooks, and send personalized emails with my resume attached."*

The Antigravity agent will:
1. Search and verify founder contacts and company hooks.
2. Insert prospect records into local SQLite database (`outreach.db`).
3. Compile personalized emails highlighting your production projects (`aisocialautomate.com`, `portal.e360insurance.com`, `praroop.site`).
4. Attach `resume/Praroop_Anand.pdf` and dispatch via Gmail SMTP with UTM tracking.

### 2. Background Autonomous Monitoring (`/goal` & `/schedule`)
* **Run continuous outreach:** Type `/goal` in the chat to let the agent autonomously research leads, verify deliverability, and dispatch outreach over extended sessions.
* **Scheduled Follow-ups:** Use `/schedule` or ask the agent to set a background timer to check for email replies and link clicks.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Python 3.13, FastAPI, SQLModel, SQLite, Pydantic, UV |
| **Frontend UI** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TypeScript |
| **Protocols** | SMTP (SSL:465), IMAP (SSL:993) |
| **Package Manager** | `uv` (Python), `npm` (Frontend) |

---

## Quickstart Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Praroop1435/Outreach-Engine.git
cd Outreach-Engine
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```ini
APP_NAME="Personal Outreach Engine"
ENVIRONMENT="development"
PORT=8000

GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-16-char-app-password"
SENDER_NAME="Your Name"

BASE_TRACKING_URL="http://localhost:8000"
RESUME_PATH="resume/Praroop_Anand.pdf"
```

### 3. Install Python Dependencies & Run Backend

```bash
# Sync dependencies using uv
uv sync

# Launch FastAPI backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
👉 **`http://localhost:8000/docs`**

### 4. Install Frontend Dependencies & Run Dashboard

```bash
cd frontend
npm install
npm run dev
```

Open your browser at:
👉 **`http://localhost:3000`**

---

## Repository Structure

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
│   │   ├── resume.py                   # Resume PDF upload, status & download
│   │   ├── sync.py                     # Manual IMAP inbox sync trigger
│   │   ├── templates.py                # Outreach template builder
│   │   └── tracking.py                 # Disguised UTM link redirection & click logging
│   └── services/
│       ├── email_sender.py             # Gmail SMTP dispatcher with UTM tracking & PDF attachment
│       ├── email_verifier.py           # MX record deliverability verification
│       ├── mailbox_sync.py             # Gmail IMAP background sync engine
│       └── sheet_importer.py           # CSV & spreadsheet parser
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── globals.css             # Tailwind CSS styles
│   │       ├── layout.tsx              # Root layout & Google Inter font
│   │       └── page.tsx                # Clean Email Outreach Dashboard
│   ├── next.config.ts                  # Next.js config with API proxy rewrites
│   └── package.json
├── resume/
│   └── Praroop_Anand.pdf               # Attached resume PDF
├── .gitignore                          # Ignores credentials, SQLite DBs, and virtual environments
├── pyproject.toml                      # Python dependencies (managed via uv)
└── README.md
```

---

## Author & License

Created by **[Praroop Anand](https://praroop.site)**  
GitHub: [@Praroop1435](https://github.com/Praroop1435)  
Portfolio: [praroop.site](https://praroop.site)

Released under the **MIT License**.
