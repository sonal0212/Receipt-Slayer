# 🧾 Receipt Slayer

> AI-powered expense intake that turns receipt photos into submission-ready reports — no manual data entry.

Receipt Slayer is a full-stack expense management module that uses Claude Vision to extract structured data from receipt images (merchant, date, tax, totals, line items), auto-suggests expense categories, and lets users generate, edit, and export reports with a chat-based insights layer.

Built as a hackathon MVP with a graceful fallback path — the demo works even without an API key.

---

## ✨ Features

- **OCR receipt extraction** — Upload a JPG/PNG and Claude Vision pulls out merchant, date, amount, tax, and line items with per-field confidence scores (High / Medium / Low).
- **Smart categorization** — Rule-based keyword matching with an LLM fallback for edge cases. Categories are DB-backed and auto-expand as new ones are confirmed.
- **Review & edit flow** — Every extracted field is editable before it's saved. Confidence indicators tell users where to look first.
- **Report builder** — Aggregate expenses into a submission-ready report, export to CSV.
- **Chat insights** — Ask natural-language questions about your expenses (e.g. *"How much did I spend on travel last month?"*). Math is deterministic in Python; Claude only phrases the answer.
- **Works without an API key** — Fallback sample data keeps the demo alive when `ANTHROPIC_API_KEY` isn't set.
- **Optional S3 storage** — Stash receipt images in S3 if AWS creds are provided.

---

## 🏗️ Architecture

```
┌────────────────┐      /api/*       ┌────────────────┐      asyncpg      ┌─────────────┐
│   React SPA    │ ───────────────▶  │   FastAPI      │ ─────────────────▶│ PostgreSQL  │
│ (Vite + TS)    │  (Vite proxy /    │  (Python 3.12) │                   └─────────────┘
│  Tailwind v4   │   Nginx in prod)  │                │
└────────────────┘                   │                │      Claude       ┌─────────────┐
                                     │                │ ─────────────────▶│  Anthropic  │
                                     │                │   (Vision + NL)   └─────────────┘
                                     │                │
                                     │                │      boto3        ┌─────────────┐
                                     │                │ ─────────────────▶│   AWS S3    │
                                     └────────────────┘   (optional)      └─────────────┘
```

### Repo layout

```
├── backend/              FastAPI backend (Python 3.12, async)
│   ├── main.py           All route handlers (single file)
│   ├── models.py         Pydantic request/response models
│   ├── db_models.py      SQLAlchemy ORM + converters
│   ├── database.py       Async engine + session factory
│   ├── store.py          CRUD for expenses & categories
│   ├── extraction.py     Claude Vision receipt OCR (with fallback)
│   ├── category_engine.py  Keyword rules + Claude fallback
│   ├── chat_engine.py    Deterministic aggregates + Claude phrasing
│   ├── report_builder.py Report assembly from stored expenses
│   ├── s3_upload.py      Optional S3 image storage
│   └── alembic/          Database migrations
│
├── frontend/             React SPA (Vite + TypeScript)
│   └── src/
│       ├── api.ts        Single API client
│       ├── types.ts      Shared TS types
│       ├── pages/        Upload → Review → Report → Dashboard
│       └── components/
│
├── stitch/               UI mockup reference (HTML + screenshots)
├── docs/                 BRD, FRD, TRD
├── .github/workflows/    CI
└── docker-compose.yml    Full-stack orchestration
```

### Data flow

1. **Extract** — User uploads image → Claude Vision extracts fields → `ExtractResponse` returned with confidence scores.
2. **Confirm** — User edits as needed → `POST /confirm` → expense saved to PostgreSQL.
3. **Report** — `GET /report` → `build_report()` aggregates from DB → `ReportResponse`.
4. **Chat** — Frontend sends full report + user query → backend computes aggregates in Python → Claude rephrases the answer.
5. **Export** — `GET /export/csv` streams a CSV.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 14+ (or Docker)
- *(Optional)* Anthropic API key for full AI features
- *(Optional)* AWS credentials for S3 image storage

### Option 1 — Docker (recommended)

```bash
# 1. Copy env template and fill in values
cp .env.example .env

# 2. Build and run the full stack
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend → http://localhost:8001

### Option 2 — Local development

**Backend**

```bash
cd backend
pip install -r requirements.txt

# Set DATABASE_URL or let it default to postgresql+asyncpg://localhost/receipt_slayer
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost/receipt_slayer"

# Run migrations
alembic upgrade head

# Start the API
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**

```bash
cd frontend
npm ci
npm run dev          # Dev server on :5173, proxies /api → :8000
```

Other scripts:

```bash
npm run build        # tsc -b && vite build
npm run lint         # eslint
```

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL async connection string (e.g. `postgresql+asyncpg://user:pass@host/db`) |
| `ANTHROPIC_API_KEY` | ⚠️ Optional | Claude API key. Without it, the app runs in fallback mode with sample data. |
| `AWS_ACCESS_KEY_ID` | Optional | For S3 receipt image storage |
| `AWS_SECRET_ACCESS_KEY` | Optional | For S3 receipt image storage |
| `AWS_S3_BUCKET` | Optional | S3 bucket name |
| `AWS_REGION` | Optional | Defaults to `ap-south-1` |
| `FALLBACK_MODE` | Optional | Force fallback JSON extraction |
| `TESSERACT_PATH` | Optional | Path to Tesseract binary if using local OCR |

---

## 🧩 API Overview

All routes are defined in `backend/main.py` (single-file, no router splitting).

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/extract` | Upload receipt image, returns extracted fields + confidence |
| `POST` | `/confirm` | Save a reviewed expense to the database |
| `PUT`  | `/expenses/{id}` | Update an existing expense |
| `GET`  | `/report` | Aggregated expense report |
| `POST` | `/chat` | Natural-language insights over the current report |
| `GET`  | `/export/csv` | CSV download of report data |
| `GET`  | `/categories` | List of available categories |

In dev, the Vite proxy rewrites `/api/*` → `http://localhost:8000/*`. In Docker/prod, Nginx proxies `/api/` → `backend:8000`. **Backend routes have no `/api` prefix** — the proxy layer handles it.

---

## 📊 Validation & Data Rules

- **Amount** — numeric, `> 0` (enforced in Pydantic `Field(gt=0)` and DB `CHECK` constraint)
- **Date** — `YYYY-MM-DD` format
- **Merchant** — required, non-empty
- **Category** — from DB-backed list, auto-expanded, case-insensitive dedup
- **Uploads** — JPG/PNG only, max 10MB

### Default categories

Travel · Meals & Entertainment · Office Supplies · Transportation · Accommodation · Equipment · Other

---

## 🎯 Key Design Decisions

- **Fallback-first** — Every Claude call (extraction, categorization, chat) degrades gracefully when the API key is unset. The demo runs end-to-end without one.
- **Deterministic math** — Chat insights compute aggregates in Python; Claude only rephrases the answer. No LLM-generated numbers.
- **Single-file routes** — All endpoints live in `main.py`. Flat beats nested for a hackathon MVP.
- **Explicit converters** — `db_models.py` has `expense_row_to_pydantic` / `pydantic_to_expense_row`. No magic ORM-Pydantic auto-mapping.
- **Per-field confidence** — Merchant, date, amount, and category each carry a High/Medium/Low confidence label from extraction through to the saved expense.

---

## 🧪 Tech Stack

**Frontend** — React · Vite · TypeScript · Tailwind v4 · React Router v7
**Backend** — FastAPI · Python 3.12 · SQLAlchemy (async) · asyncpg · Pydantic v2 · Alembic
**AI** — Anthropic Claude (Vision + text)
**Infra** — PostgreSQL · AWS S3 (optional) · Docker Compose · Nginx

---

## 📁 Project Docs

- `Receipt_Slayer_BRD.docx` — Business Requirements Document
- `TRD.docx` — Technical Requirements Document
- `docs/problem-statement.txt` — Combined BRD + FRD + TRD
- `figma-ui-mockup.html` — UI mockup reference
- `stitch/` — Additional mockup files and screenshots

---

## 👤 Author

Built by [@sonal0212](https://github.com/sonal0212)
