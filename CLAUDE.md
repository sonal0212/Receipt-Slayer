# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Receipt Slayer is an AI-enabled expense intake and reporting module (hackathon MVP). It converts receipt images into structured expenses, auto-suggests categories, and generates submission-ready reports with chat-based insights.

Full requirements are in `docs/problem-statement.txt` (BRD + FRD + TRD).

## Development Commands

### Backend (FastAPI + Python 3.12)
```bash
cd backend
pip install -r requirements.txt
# Requires PostgreSQL (async via asyncpg)
# Set DATABASE_URL env var or defaults to postgresql+asyncpg://localhost/receipt_slayer
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm ci
npm run dev       # Dev server on port 5173, proxies /api → localhost:8000
npm run build     # tsc -b && vite build
npm run lint      # eslint
```

### Docker (full stack)
```bash
# Requires .env file with DATABASE_URL, ANTHROPIC_API_KEY, AWS credentials
docker-compose up --build
# Frontend: http://localhost:3000, Backend: http://localhost:8001
```

## Architecture

```
frontend/        React SPA (Vite + Tailwind v4 + React Router v7)
  src/api.ts     All backend calls — single API client, base path /api
  src/types.ts   Shared TypeScript types
  src/pages/     UploadPage → ReviewPage → ReportPage → DashboardPage
  src/components/

backend/         FastAPI (async, Python 3.12)
  main.py        All route handlers — single file, no router splitting
  models.py      Pydantic models (request/response + data model)
  db_models.py   SQLAlchemy ORM models + Pydantic ↔ ORM converters
  database.py    Async engine + session factory (asyncpg)
  store.py       CRUD operations (expenses + categories)
  extraction.py  Receipt OCR via Claude Vision, with no-API-key fallback
  category_engine.py  Rule-based keyword matching + Claude fallback
  chat_engine.py      Deterministic aggregates + Claude NL phrasing
  report_builder.py   Builds report from stored expenses
  sample_data.py      Hardcoded sample receipts for demo/fallback mode
  s3_upload.py        Optional S3 receipt image storage
  alembic/            Database migrations

stitch/          UI mockup reference files (HTML + screenshots)
```

### Key Data Flow

1. **Extract**: Image uploaded → Claude Vision extracts fields (or fallback sample data) → `ExtractResponse` returned
2. **Confirm**: User edits fields → `POST /confirm` → expense saved to PostgreSQL
3. **Report**: `GET /report` → `build_report()` aggregates from DB → `ReportResponse`
4. **Chat**: Frontend sends full `ReportResponse` + query → backend computes deterministic aggregates in Python → Claude only phrases the NL answer
5. **Export**: `GET /export/csv` → streams CSV from report data

### API Proxy

- **Dev**: Vite proxy rewrites `/api/*` → `http://localhost:8000/*` (strips `/api` prefix)
- **Docker/Prod**: Nginx proxies `/api/` → `http://backend:8000/`
- Backend routes have no `/api` prefix — the proxy layer handles it

## Key Design Decisions

- **Fallback everywhere**: All Claude API calls (extraction, categorization, chat) gracefully degrade when `ANTHROPIC_API_KEY` is unset. Demo must work without it.
- **Chat Insights are deterministic**: `compute_aggregates()` in `chat_engine.py` does all math; Claude only rephrases the result. No LLM-generated numbers.
- **Single-file routes**: All endpoints live in `main.py` — no router blueprints.
- **Pydantic ↔ SQLAlchemy bridging**: `db_models.py` has explicit `expense_row_to_pydantic` / `pydantic_to_expense_row` converters; there's no ORM-Pydantic auto-mapping.
- **Categories are DB-backed**: Default 7 categories seeded on startup; new categories auto-registered on confirm. Case-insensitive dedup.
- **Confidence scores**: Per-field (merchant, date, amount, category) with High/Medium/Low literals — tracked from extraction through to the expense record.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (async, e.g. `postgresql+asyncpg://user:pass@host/db`)
- `ANTHROPIC_API_KEY` — Claude API key (optional; backend gracefully falls back without it)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION` — Optional S3 for receipt images
- `FALLBACK_MODE` — Toggle fallback JSON extraction
- `TESSERACT_PATH` — Optional path to Tesseract binary

## Validation Rules

- Amount: numeric, > 0 (enforced in Pydantic `Field(gt=0)` and DB `CHECK` constraint)
- Date: YYYY-MM-DD format (validated in confirm/update handlers)
- Merchant: required, non-empty (`Field(min_length=1)`)
- Category: required, from DB-backed list (auto-expanded)
- File upload: JPG/PNG only, max 10MB

## Categories

Travel, Meals & Entertainment, Office Supplies, Transportation, Accommodation, Equipment, Other.
