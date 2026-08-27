# Personal Outreach Engine

A high-performance, self-hosted personal outreach and prospect pipeline management engine built with **FastAPI**, **SQLite**, **Next.js 16**, and **Tailwind CSS**. 

Designed specifically for engineers and founders who want clean, authentic, high-converting outreach with **Gmail SMTP**, **X (Twitter) DMs**, **PDF resume attachments**, **disguised UTM parameter tracking**, and an **interactive template builder**.

---

## Features

- **Minimalist Dashboard (Next.js 16 + Tailwind CSS)**: Pure white `#ffffff` canvas, clean typography, zero emoji clutter, and real-time live data binding.
- **Local SQLite Database (SQLModel & Pydantic)**: Full local data ownership and privacy.
- **Multi-Channel Dispatch**:
  - **Email (Gmail SMTP SSL)**: Send personalized outreach directly from your Gmail address.
  - **X (Twitter) Direct Messages**: OAuth 2.0 PKCE integration for direct messaging on X.
- **Resume PDF Management**: Automatically attaches your PDF resume (`Praroop_Anand.pdf`) to outreach emails. Includes an in-dashboard file uploader that replaces old resumes cleanly.
- **Disguised UTM Parameter Link Tracking**:
  - Links in emails look clean and human (e.g. `Portfolio: https://praroop.site`).
  - Underlying HTML anchor tags pass complete UTM attribution (`utm_source=outreach&utm_campaign=outreach_{company}&utm_content={name}`).
  - Built-in **Link Clicks Pop-up Modal** in the dashboard to audit which prospect clicked which link and when.
- **Interactive Template Builder**: Create and edit reusable cold outreach and follow-up templates with one-click placeholder chips (`+{{firstName}}`, `+{{company}}`, `+{{role}}`, `+{{custom_hook}}`).
- **CSV & Google Sheets Importer**: Paste CSV text or upload spreadsheet files with automatic header mapping.
- **Message & Activity Timeline**: Slide-over drawer with full chronological conversation history and link click events.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, SQLModel, SQLite, Pydantic, HTTPX, UV |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TypeScript |
| **Protocols** | SMTP (SSL:465), IMAP (SSL:993), OAuth 2.0 PKCE (Twitter API v2) |

---

## Prerequisites

Ensure you have the following installed on your machine:

1. **[uv](https://docs.astral.sh/uv/)** (Fast Python package manager):
   ```bash
   # macOS / Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # or via Homebrew
   brew install uv
   ```
2. **[Node.js](https://nodejs.org/)** (v18.17 or higher) and `npm`.
3. **Gmail Account & App Password**:
   - Go to your [Google Account Security Settings](https://myaccount.google.com/security).
   - Enable **2-Step Verification**.
   - Create an **App Password** (Select App: *Mail*, Device: *Other*).
   - Copy the 16-character password.

---

## Quickstart (Get Running in 2 Minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/Praroop1435/Outreach-Engine.git
cd Outreach-Engine
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```ini
# Gmail Configuration
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Local SQLite Database
DATABASE_URL=sqlite:///./outreach.db
PORT=8437

# Resume Path (relative to root)
RESUME_PATH=resume/Praroop_Anand.pdf

# X (Twitter) OAuth 2.0 (Optional)
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret
X_REDIRECT_URI=http://localhost:8437/api/auth/x/callback
```

### 3. Add Your Resume (PDF)

Place your resume PDF in the `resume/` directory:

```bash
mkdir -p resume
cp /path/to/your/resume.pdf resume/Praroop_Anand.pdf
```
*(You can also upload or swap it directly from the dashboard header at any time).*

---

### 4. Start the FastAPI Backend

Run with `uv`:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8437 --reload
```

The API backend will start on **`http://127.0.0.1:8437`** (Interactive docs available at **`http://127.0.0.1:8437/docs`**).

---

### 5. Start the Next.js Frontend

In a new terminal window:

```bash
cd frontend
npm install
npm run dev -- -p 3001
```

Open your browser at:
👉 **`http://localhost:3001`** (or `http://localhost:3000`)

---

## Project Structure

```
Outreach-Engine/
├── app/
│   ├── config.py                 # Pydantic environment configuration
│   ├── db.py                     # SQLite engine, session & template seeding
│   ├── models.py                 # SQLModel database schemas (Lead, EmailMessage, LinkClick, EmailTemplate)
│   ├── main.py                   # FastAPI application & router mounts
│   ├── routers/
│   │   ├── analytics.py          # KPI metrics & Link Click logs
│   │   ├── leads.py              # Lead CRUD, CSV import, and email dispatch
│   │   ├── resume.py             # Resume PDF upload, status & download
│   │   ├── templates.py          # Template builder CRUD
│   │   ├── tracking.py           # Disguised UTM link redirection & tracking
│   │   └── twitter.py            # X (Twitter) OAuth 2.0 and DMs
│   └── services/
│       ├── email_sender.py       # Gmail SMTP dispatcher with UTM & attachments
│       ├── mailbox_sync.py       # Gmail IMAP sync engine
│       ├── sheet_importer.py     # CSV & Google Sheet parser
│       └── twitter_service.py    # X API v2 PKCE client & DM sender
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── globals.css       # Tailwind CSS styles
│   │       ├── layout.tsx        # Root HTML layout & fonts
│   │       └── page.tsx          # Complete interactive Outreach dashboard
│   ├── next.config.ts            # Next.js config with API proxy rewrites
│   └── package.json
├── resume/
│   └── Praroop_Anand.pdf         # Attached resume PDF
├── .env.example                  # Sample environment file
├── pyproject.toml                # Python dependencies (managed via uv)
└── README.md
```

---

## Usage Guide

### 1. Adding and Importing Prospects
- **Manual Contact**: Click **"Add Contact"** to enter name, company, email, role, and custom icebreakers.
- **Spreadsheet / CSV**: Click **"Import Sheet / CSV"** to paste comma-separated data or click **"Upload CSV"** to load a `.csv` file. Auto-detects columns (`Name`, `Email`, `Company`, `Role`, `X Handle`, `Custom Hook`).

### 2. Customizing Outreach Copy & Templates
- Click **"Templates"** in the top header.
- Use the **Variable Placeholders** (`+{{firstName}}`, `+{{company}}`, `+{{custom_hook}}`, `+{{role}}`) to dynamically customize messages.
- The repository comes pre-seeded with 4 high-converting, genuine engineering & founder outreach templates.

### 3. Sending Personalized Outreach
- Click **"Message"** on any contact row in the table.
- Choose **Email (Gmail)** or **X Direct Message**.
- Toggle **"Attach Resume"** (checked by default).
- Toggle **"Disguise links with UTM parameters"** (checked by default).
- Click **"Send via Gmail"** to dispatch immediately.

### 4. Tracking Link Clicks & Engagement
- When a prospect opens links to your portfolio, GitHub, or demo projects, their click event is recorded with timestamp and UTM tags.
- Click on any **`[# Clicks]`** badge in the table or the **"Link Clicks"** card in the top KPI grid to open the **Activity Log Pop-up Modal**.

---

## Author & License

Created by **[Praroop Anand](https://praroop.site)**  
GitHub: [@Praroop1435](https://github.com/Praroop1435)

Open source and available under the **MIT License**.
