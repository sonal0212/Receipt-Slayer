# Receipt Slayer - Technical Documentation

**Version:** 1.0 (MVP)
**Date:** 2026-02-28
**Project:** AI-Enabled Expense Intelligence Engine (Hackathon MVP)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Application Flow — End to End](#4-application-flow--end-to-end)
5. [Screen-by-Screen Flow](#5-screen-by-screen-flow)
   - 5.1 [Upload Screen](#51-upload-screen)
   - 5.2 [Review & Categorize Screen](#52-review--categorize-screen)
   - 5.3 [Report Screen](#53-report-screen)
   - 5.4 [Chat Insights Panel](#54-chat-insights-panel)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Data Models](#7-data-models)
8. [Extraction Pipeline](#8-extraction-pipeline)
9. [Category Engine](#9-category-engine)
10. [Chat Insights Engine](#10-chat-insights-engine)
11. [Report Builder & Export](#11-report-builder--export)
12. [Frontend-Backend Communication](#12-frontend-backend-communication)
13. [Error Handling Strategy](#13-error-handling-strategy)
14. [Environment & Configuration](#14-environment--configuration)
15. [File Structure](#15-file-structure)

---

## 1. System Overview

Receipt Slayer converts receipt images into structured expenses, auto-suggests categories using AI, and generates submission-ready reports with natural-language chat insights. It is designed as a single-user MVP with in-memory storage, no authentication, and a stateless API.

**Core Capabilities:**
- Receipt image upload with AI-powered field extraction (Claude Vision)
- Pre-built sample receipts for reliable demo mode
- Rule-based + AI-assisted category suggestion (with user-defined custom categories)
- Editable review screen with confidence scoring
- Expense report with totals by category
- CSV export
- Chat-based insights panel powered by deterministic aggregates + Claude NL phrasing

---

## 2. High-Level Architecture

```mermaid
graph LR
    subgraph Frontend ["React SPA (Vite + Tailwind)"]
        A[Upload Page] --> B[Review Page]
        B --> C[Report Page]
        C --> D[Chat Insights Panel]
    end

    subgraph Backend ["FastAPI (Python)"]
        E["/extract"]
        F["/confirm"]
        G["/report"]
        H["/export/csv"]
        I["/chat-insight"]
        J["/categories"]
        K["/samples"]
    end

    subgraph Services
        L[Extraction Layer]
        M[Category Engine]
        N[Report Builder]
        O[Chat Engine]
        P[In-Memory Store]
    end

    subgraph External
        Q[Claude API - Vision]
        R[Claude API - NL Phrasing]
    end

    A -->|POST /extract| E
    B -->|POST /confirm| F
    B -->|GET & POST /categories| J
    C -->|GET /report| G
    C -->|GET /export/csv| H
    D -->|POST /chat-insight| I

    E --> L
    L -->|Image upload| Q
    L -->|Sample mode| P
    E --> M
    F --> P
    G --> N
    N --> P
    H --> N
    I --> O
    O -->|NL phrasing| R
```

### Request Flow Summary

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as React Frontend
    participant VP as Vite Proxy (/api -> :8000)
    participant BE as FastAPI Backend
    participant CL as Claude API
    participant ST as In-Memory Store

    U->>FE: Upload receipt image
    FE->>VP: POST /api/extract (FormData)
    VP->>BE: POST /extract
    BE->>CL: Claude Vision (base64 image)
    CL-->>BE: JSON {merchant, date, amount, currency, suggested_category}
    BE-->>FE: ExtractResponse

    U->>FE: Edit fields & Confirm
    FE->>VP: POST /api/confirm (JSON)
    VP->>BE: POST /confirm
    BE->>ST: store.add_expense(expense)
    BE-->>FE: {status: "confirmed", expense_id}

    FE->>VP: GET /api/report
    VP->>BE: GET /report
    BE->>ST: get_all_expenses()
    BE-->>FE: ReportResponse

    U->>FE: Ask chat question
    FE->>VP: POST /api/chat-insight
    VP->>BE: POST /chat-insight
    BE->>BE: compute_aggregates() [deterministic]
    BE->>CL: Claude NL phrasing (aggregates + query)
    CL-->>BE: JSON {answer, referenced_values, confidence}
    BE-->>FE: ChatResponse
```

---

## 3. Technology Stack

| Layer          | Technology                        | Purpose                              |
|----------------|-----------------------------------|--------------------------------------|
| Frontend       | React 19 + TypeScript             | Single Page Application              |
| Styling        | Tailwind CSS v4                   | Utility-first CSS framework          |
| Bundler        | Vite 7                            | Dev server + HMR + API proxy         |
| Routing        | React Router DOM v7               | Client-side routing                  |
| Icons          | Lucide React                      | UI iconography                       |
| File Upload    | react-dropzone                    | Drag-and-drop file upload            |
| Backend        | FastAPI (Python)                  | REST API server                      |
| Server         | Uvicorn                           | ASGI server with hot reload          |
| LLM            | Claude API (Anthropic SDK)        | Vision extraction + NL phrasing      |
| Validation     | Pydantic v2                       | Request/response data models         |
| Storage        | Python in-memory (list)           | Expense storage (no DB for MVP)      |
| Export         | Python csv module                 | CSV report generation                |

---

## 4. Application Flow — End to End

```mermaid
flowchart TD
    START([User Opens App]) --> UPLOAD[Upload Screen]

    UPLOAD --> CHOOSE{Choose Input Mode}
    CHOOSE -->|Sample Mode| SELECT[Select Sample Receipt]
    CHOOSE -->|OCR Mode| DROP[Drag & Drop / Browse Image]

    SELECT --> EXTRACT_SAMPLE[POST /extract with receipt_id]
    DROP --> EXTRACT_IMAGE[POST /extract with image file]

    EXTRACT_SAMPLE --> SAMPLE_DATA[Return pre-built sample data]
    EXTRACT_IMAGE --> HAS_KEY{API Key Set?}

    HAS_KEY -->|Yes| CLAUDE_VISION[Claude Vision extracts fields + suggests category]
    HAS_KEY -->|No| FALLBACK[Return placeholder from filename]

    CLAUDE_VISION --> PARSE[Parse JSON response]
    PARSE --> NEW_CAT_AI{AI suggested new category?}
    NEW_CAT_AI -->|Yes| REGISTER_AI[Auto-register new category]
    NEW_CAT_AI -->|No| SKIP_REG[Use existing category]

    SAMPLE_DATA --> REVIEW[Review & Categorize Screen]
    FALLBACK --> REVIEW
    REGISTER_AI --> REVIEW
    SKIP_REG --> REVIEW

    REVIEW --> USER_EDIT[User edits merchant, date, amount]
    USER_EDIT --> CAT_DECISION{Category Decision}

    CAT_DECISION -->|Accept AI suggestion| ACCEPT[Use suggested category]
    CAT_DECISION -->|Pick from dropdown| DROPDOWN[Select existing category]
    CAT_DECISION -->|Create new| ADD_NEW[Type custom category name]

    ADD_NEW --> POST_CAT[POST /categories]
    POST_CAT --> DROPDOWN

    ACCEPT --> CONFIRM[POST /confirm]
    DROPDOWN --> CONFIRM

    CONFIRM --> VALIDATE{Server Validation}
    VALIDATE -->|Pass| STORE[Store expense in memory]
    VALIDATE -->|Fail| ERROR[Show validation error]
    ERROR --> USER_EDIT

    STORE --> REPORT[Report Screen]

    REPORT --> VIEW_TABLE[View expenses table]
    REPORT --> VIEW_SUMMARY[View summary cards + category breakdown]
    REPORT --> EXPORT[GET /export/csv -> Download CSV]
    REPORT --> ADD_MORE[Navigate back to Upload]
    REPORT --> OPEN_CHAT[Open Chat Insights Panel]

    OPEN_CHAT --> CHAT[Chat Insights Panel]
    CHAT --> ASK[User asks question]
    ASK --> AGGREGATE[Compute deterministic aggregates]
    AGGREGATE --> PHRASE[Claude phrases response in NL]
    PHRASE --> DISPLAY[Display answer with referenced values]
    DISPLAY --> ASK

    ADD_MORE --> UPLOAD
```

---

## 5. Screen-by-Screen Flow

### 5.1 Upload Screen

**Route:** `/` | **Component:** `UploadPage.tsx`

```mermaid
flowchart TD
    LOAD[Page Load] --> FETCH_SAMPLES[GET /samples]
    FETCH_SAMPLES --> RENDER[Render Upload UI]

    RENDER --> MODE{Extraction Mode Toggle}

    MODE -->|"Demo Safe (Sample JSON)"| SAMPLE_UI[Show sample dropdown + Extract button]
    MODE -->|"OCR Mode"| OCR_UI[Show drag-and-drop zone]

    SAMPLE_UI --> SELECT[User selects sample]
    SELECT --> CLICK_EXTRACT[Click Extract Receipt]
    CLICK_EXTRACT --> POST_SAMPLE["POST /extract {receipt_id}"]
    POST_SAMPLE --> NAV_REVIEW["Navigate to /review with extraction data"]

    OCR_UI --> DROP_FILE[User drops/browses JPG/PNG file]
    DROP_FILE --> VALIDATE_FILE{Validate file}
    VALIDATE_FILE -->|"Invalid type or > 10MB"| SHOW_ERROR[Show error message]
    VALIDATE_FILE -->|Valid| POST_IMAGE["POST /extract {file}"]
    POST_IMAGE --> NAV_REVIEW_IMG["Navigate to /review with extraction + imageUrl"]
```

**Key Details:**
- Samples are fetched from `GET /samples` on mount (5 pre-built receipts)
- Mode toggle switches between sample JSON mode and OCR upload mode
- File validation: JPG/PNG only, max 10MB (client-side + server-side)
- On successful extraction, navigates to `/review` via React Router state

---

### 5.2 Review & Categorize Screen

**Route:** `/review` | **Component:** `ReviewPage.tsx`

```mermaid
flowchart TD
    LOAD[Page Load] --> CHECK_STATE{Extraction data in router state?}
    CHECK_STATE -->|No| EMPTY[Show "No extraction data" + link to Upload]
    CHECK_STATE -->|Yes| FETCH_CATS[GET /categories]

    FETCH_CATS --> CHECK_AI_CAT{AI suggested category in list?}
    CHECK_AI_CAT -->|No| ADD_LOCAL[Add AI category to local dropdown]
    CHECK_AI_CAT -->|Yes| RENDER[Render form with pre-filled fields]
    ADD_LOCAL --> RENDER

    RENDER --> POPUP[Show Category Suggestion Popup]
    POPUP --> POPUP_CHOICE{User choice}
    POPUP_CHOICE -->|Accept| SET_CAT[Set category to AI suggestion]
    POPUP_CHOICE -->|Change| CLOSE_POPUP[Close popup, user picks manually]

    RENDER --> EDIT[User edits fields]
    EDIT --> CATEGORY{Category action}
    CATEGORY -->|Select existing| USE_EXISTING[Pick from dropdown]
    CATEGORY -->|"Click + New"| SHOW_INPUT[Show new category input]
    SHOW_INPUT --> TYPE_NAME[User types category name]
    TYPE_NAME --> SAVE_CAT["POST /categories {name}"]
    SAVE_CAT --> UPDATE_DROPDOWN[Update dropdown + select new category]
    UPDATE_DROPDOWN --> USE_EXISTING

    USE_EXISTING --> CLICK_CONFIRM[Click Confirm Expense]
    SET_CAT --> CLICK_CONFIRM

    CLICK_CONFIRM --> CLIENT_VALIDATE{Client-side validation}
    CLIENT_VALIDATE -->|Fail| SHOW_ERRORS[Show field errors]
    CLIENT_VALIDATE -->|Pass| POST_CONFIRM["POST /confirm {expense data}"]
    POST_CONFIRM --> SERVER_VALIDATE{Server validation}
    SERVER_VALIDATE -->|Fail| SHOW_SERVER_ERR[Show server error]
    SERVER_VALIDATE -->|Pass| NAV_REPORT["Navigate to /report"]
```

**Validation Rules (Client + Server):**
| Field    | Rule                          | Confidence Indicator        |
|----------|-------------------------------|-----------------------------|
| Merchant | Required, non-empty           | Low = amber border + "Needs review" |
| Date     | Must match `YYYY-MM-DD`       | Low = amber border + "Needs review" |
| Amount   | Numeric, > 0                  | Low = amber border + "Needs review" |
| Category | Required, non-empty           | Shown in suggestion popup   |

**Dynamic Categories Feature:**
- Categories fetched from `GET /categories` on mount (not hardcoded)
- AI can suggest new categories during extraction (shown with "AI New" badge)
- Users can add custom categories via the "+ New" button
- New categories are persisted server-side via `POST /categories`
- The `/confirm` endpoint auto-registers any unknown category

---

### 5.3 Report Screen

**Route:** `/report` | **Component:** `ReportPage.tsx`

```mermaid
flowchart TD
    LOAD[Page Load] --> FETCH["GET /report"]
    FETCH --> RENDER[Render Report UI]

    RENDER --> SUMMARY[Summary Cards]
    SUMMARY --> CARD1["Total Spend ($)"]
    SUMMARY --> CARD2["# Receipts"]
    SUMMARY --> CARD3["Top Category (name + total + count)"]

    RENDER --> TOGGLES[Column Visibility Toggles]
    TOGGLES --> TABLE[Expenses Table]
    TABLE --> COLS["Columns: Merchant | Date | Amount | Category | Type"]

    RENDER --> BREAKDOWN[Category Breakdown Grid]
    BREAKDOWN --> CAT_CARDS["Per-category cards: name, total, count"]

    RENDER --> ACTIONS[Action Buttons]
    ACTIONS --> ADD_RECEIPT["+ Add Receipt -> Navigate to /"]
    ACTIONS --> EXPORT_CSV["Export CSV -> GET /export/csv"]
    ACTIONS --> OPEN_CHAT["Chat Insights -> Open side panel"]

    EXPORT_CSV --> DOWNLOAD[Browser downloads expense_report.csv]
```

**CSV Export Format:**
```
ID, Merchant, Date, Amount, Currency, Category, Type
a1b2c3d4, Delta Air Lines, 2026-02-15, 487.50, USD, Travel, Business
```

---

### 5.4 Chat Insights Panel

**Location:** Right-side drawer on Report Screen

```mermaid
flowchart TD
    OPEN[User opens Chat Insights] --> RENDER[Render chat panel]

    RENDER --> SUGGESTED[Show suggested question chips]
    SUGGESTED --> Q1["Top spending category?"]
    SUGGESTED --> Q2["Total spend?"]
    SUGGESTED --> Q3["Largest expense?"]
    SUGGESTED --> Q4["Show travel expenses"]
    SUGGESTED --> Q5["Any unusual expenses?"]

    RENDER --> INPUT[Chat input field]

    Q1 --> SEND[Send query]
    Q2 --> SEND
    Q3 --> SEND
    Q4 --> SEND
    Q5 --> SEND
    INPUT --> TYPE[User types custom question] --> SEND

    SEND --> POST["POST /chat-insight {report_data, user_query}"]
    POST --> AGGREGATE[Server computes deterministic aggregates]
    AGGREGATE --> HAS_KEY{API Key Set?}

    HAS_KEY -->|Yes| CLAUDE["Claude phrases answer in natural language"]
    HAS_KEY -->|No| FALLBACK["Keyword-based fallback response"]

    CLAUDE --> RESPONSE["ChatResponse {answer, referenced_values, confidence}"]
    FALLBACK --> RESPONSE

    RESPONSE --> DISPLAY[Display message bubble with answer]
    DISPLAY --> REF_VALUES{Has referenced values?}
    REF_VALUES -->|Yes| SHOW_REF[Show referenced values section]
    REF_VALUES -->|No| DONE[Wait for next question]
    SHOW_REF --> DONE
```

**Chat Engine — Deterministic-First Design:**

```mermaid
flowchart LR
    QUERY[User Query] --> AGG["compute_aggregates()
    Pure Python — No LLM"]

    AGG --> DATA["Aggregated Data:
    - total_spend
    - count
    - top_category
    - largest_expense
    - average_expense
    - high_expenses (>2x avg)
    - by_category breakdown
    - travel_expenses"]

    DATA --> PROMPT["Prompt to Claude:
    aggregated data + user question"]

    PROMPT --> NL["Claude returns:
    natural language answer
    + referenced values
    + confidence level"]
```

> **Important:** Claude never computes numbers. All aggregates are deterministic Python. Claude only phrases the pre-computed data into natural language.

---

## 6. API Endpoint Reference

```mermaid
graph LR
    subgraph "Read Endpoints (GET)"
        A["GET /samples"] -->|"List sample receipt IDs"| A1["[{id, description}]"]
        B["GET /categories"] -->|"List all categories"| B1["[string]"]
        C["GET /report"] -->|"Get report data"| C1["ReportResponse"]
        D["GET /export/csv"] -->|"Download CSV"| D1["StreamingResponse"]
    end

    subgraph "Write Endpoints (POST)"
        E["POST /extract"] -->|"Extract from image/sample"| E1["ExtractResponse"]
        F["POST /confirm"] -->|"Confirm expense"| F1["{status, expense_id}"]
        G["POST /categories"] -->|"Add custom category"| G1["{status, category, categories}"]
        H["POST /chat-insight"] -->|"Answer NL question"| H1["ChatResponse"]
    end
```

| Method | Path              | Input                            | Output                       | Notes                                    |
|--------|-------------------|----------------------------------|------------------------------|------------------------------------------|
| GET    | `/samples`        | —                                | `[{id, description}]`       | Lists 5 pre-built sample receipts        |
| GET    | `/categories`     | —                                | `[string]`                   | Default + user/AI-added categories       |
| POST   | `/categories`     | `{name: string}`                 | `{status, category, categories}` | Idempotent; returns "exists" if duplicate |
| POST   | `/extract`        | `FormData: file OR receipt_id`   | `ExtractResponse`            | Claude Vision for images; sample lookup for IDs |
| POST   | `/confirm`        | `ConfirmRequest` (JSON)          | `{status, expense_id}`       | Validates + stores; auto-registers new categories |
| GET    | `/report`         | —                                | `ReportResponse`             | Computes totals_by_category from store   |
| GET    | `/export/csv`     | —                                | CSV file download            | Content-Disposition: attachment           |
| POST   | `/chat-insight`   | `{report_data, user_query}`      | `ChatResponse`               | Stateless; client sends full report data |

---

## 7. Data Models

```mermaid
classDiagram
    class ExtractResponse {
        +str merchant
        +str date
        +float amount
        +str currency = "USD"
        +str suggested_category
        +FieldConfidence field_confidence
        +str receipt_ref
    }

    class FieldConfidence {
        +Literal merchant : High|Medium|Low
        +Literal date : High|Medium|Low
        +Literal amount : High|Medium|Low
        +Literal category : High|Medium|Low
    }

    class ConfirmRequest {
        +str merchant (min_length=1)
        +str date
        +float amount (gt=0)
        +str category
        +Literal expense_type : Personal|Business
        +str receipt_ref
        +FieldConfidence? confidence_scores
    }

    class Expense {
        +str id (auto UUID[:8])
        +str merchant
        +str date
        +float amount
        +str currency = "USD"
        +str category
        +str expense_type
        +FieldConfidence confidence_scores
    }

    class ReportResponse {
        +CategoryTotal[] totals_by_category
        +Expense[] expenses
    }

    class CategoryTotal {
        +str category
        +float total
        +int count
    }

    class ChatRequest {
        +ReportResponse report_data
        +str user_query
    }

    class ChatResponse {
        +str answer
        +dict referenced_values
        +Literal confidence : High|Medium|Low
    }

    ExtractResponse --> FieldConfidence
    ConfirmRequest --> FieldConfidence
    Expense --> FieldConfidence
    ReportResponse --> CategoryTotal
    ReportResponse --> Expense
    ChatRequest --> ReportResponse
```

---

## 8. Extraction Pipeline

```mermaid
flowchart TD
    INPUT{Input Type?} -->|"receipt_id (sample)"| SAMPLE_PATH
    INPUT -->|"file (image)"| IMAGE_PATH

    subgraph SAMPLE_PATH ["Sample Extraction (Fallback JSON)"]
        S1[Lookup receipt_id in SAMPLE_RECEIPTS dict] --> S2[Return pre-built ExtractResponse]
    end

    subgraph IMAGE_PATH ["Image Extraction (Claude Vision)"]
        I0{ANTHROPIC_API_KEY set?}
        I0 -->|No| I_FALLBACK["Fallback: parse filename as merchant
        date = today, amount = 0.00
        confidence = all Low"]

        I0 -->|Yes| I1["Encode image to base64"]
        I1 --> I2["Determine media_type from extension
        .png -> image/png
        .jpg -> image/jpeg"]
        I2 --> I3["Send to Claude Vision API
        Model: claude-sonnet-4-20250514
        Max tokens: 500"]
        I3 --> I4["Claude returns JSON:
        {merchant, date, amount, currency, suggested_category}"]
        I4 --> I5["Strip markdown code fences if present"]
        I5 --> I6["Parse JSON response"]
        I6 --> I7{AI suggested new category?}
        I7 -->|Yes| I8["add_category() — register in CATEGORIES list"]
        I7 -->|No| I9["suggest_category() — rule-based from merchant name"]
        I8 --> I10["Build ExtractResponse with confidence scores"]
        I9 --> I10
    end

    I_FALLBACK --> DONE[Return ExtractResponse]
    S2 --> DONE
    I10 --> DONE
```

**Sample Receipts (5 pre-built):**

| ID          | Merchant            | Amount   | Category              |
|-------------|---------------------|----------|-----------------------|
| sample-001  | Delta Air Lines     | $487.50  | Travel                |
| sample-002  | The Capital Grille  | $156.32  | Meals & Entertainment |
| sample-003  | Staples             | $89.97   | Office Supplies       |
| sample-004  | Marriott Downtown   | $312.00  | Accommodation         |
| sample-005  | Uber                | $34.75   | Transportation        |

---

## 9. Category Engine

```mermaid
flowchart TD
    INPUT[Merchant Name] --> RULES["Rule-Based Engine
    (keyword matching)"]

    RULES --> MATCH{Keyword match found?}
    MATCH -->|Yes| HIGH["Return (category, 'High')"]
    MATCH -->|No| OTHER["Return ('Other', 'Low')"]

    OTHER --> CLAUDE_CHECK{API Key available?}
    CLAUDE_CHECK -->|No| RETURN_OTHER[Use rule-based result]
    CLAUDE_CHECK -->|Yes| CLAUDE_CAT["Claude categorizes:
    Model: claude-sonnet-4-20250514
    Prompt: merchant + amount + date
    Returns: {category, confidence}"]

    CLAUDE_CAT --> VALID{Category in CATEGORIES list?}
    VALID -->|Yes| RETURN_CLAUDE[Return Claude's suggestion]
    VALID -->|No| RETURN_OTHER
```

**Keyword Map (Rule-Based):**

| Category              | Keywords                                                     |
|-----------------------|--------------------------------------------------------------|
| Travel                | airline, flight, delta, united, southwest, jetblue, etc.     |
| Meals & Entertainment | restaurant, cafe, bar, starbucks, mcdonald, chipotle, etc.  |
| Office Supplies       | staples, office depot, paper, ink, toner, etc.               |
| Transportation        | uber, lyft, taxi, parking, gas, shell, chevron, etc.         |
| Accommodation         | marriott, hilton, hotel, airbnb, hyatt, holiday inn, etc.    |
| Equipment             | apple, dell, laptop, best buy, amazon, newegg, etc.          |

**Dynamic Category Management:**

```mermaid
flowchart LR
    DEFAULT["Default Categories (7)
    Travel, Meals & Entertainment,
    Office Supplies, Transportation,
    Accommodation, Equipment, Other"]

    AI_NEW["AI Suggests New Category
    (e.g., 'Medical', 'Healthcare')"]

    USER_NEW["User Creates Custom Category
    via + New button"]

    DEFAULT --> RUNTIME["Runtime CATEGORIES list
    (in-memory, mutable)"]
    AI_NEW -->|"add_category()"| RUNTIME
    USER_NEW -->|"POST /categories"| RUNTIME

    RUNTIME --> DROPDOWN["Category Dropdown
    (fetched via GET /categories)"]
```

---

## 10. Chat Insights Engine

```mermaid
flowchart TD
    QUERY["User Query + Report Data"] --> AGG["compute_aggregates()"]

    AGG --> METRICS["Computed Metrics (Pure Python):
    - total_spend: sum of all amounts
    - count: number of expenses
    - top_category: highest total
    - largest_expense: max single amount
    - average_expense: total / count
    - high_expenses: > 2x average
    - by_category: totals per category
    - travel_expenses: category == Travel"]

    METRICS --> KEY_CHECK{API Key available?}

    KEY_CHECK -->|Yes| CLAUDE_NL["Claude NL Phrasing
    System: 'Use ONLY the provided data'
    Input: aggregates JSON + user question
    Output: {answer, referenced_values, confidence}"]

    KEY_CHECK -->|No| FALLBACK["Keyword-Based Fallback"]

    FALLBACK --> KW_MATCH{Match query keywords}
    KW_MATCH -->|"'total' + 'spend'"| TOTAL["Total spend is $X across Y receipts"]
    KW_MATCH -->|"'top' + 'category'"| TOP["Top category is X at $Y"]
    KW_MATCH -->|"'largest' / 'biggest'"| LARGE["Largest expense is $X at Merchant"]
    KW_MATCH -->|"'travel'"| TRAVEL["Found N travel expenses totaling $X"]
    KW_MATCH -->|"'unusual' / 'high'"| HIGH["N expenses above 2x average"]
    KW_MATCH -->|No match| GENERIC["Generic summary response"]

    CLAUDE_NL --> RESPONSE[ChatResponse]
    TOTAL --> RESPONSE
    TOP --> RESPONSE
    LARGE --> RESPONSE
    TRAVEL --> RESPONSE
    HIGH --> RESPONSE
    GENERIC --> RESPONSE
```

---

## 11. Report Builder & Export

```mermaid
flowchart TD
    REQUEST["GET /report"] --> FETCH["store.get_all_expenses()"]
    FETCH --> GROUP["Group by category using defaultdict"]
    GROUP --> COMPUTE["For each category:
    - total = sum(amounts)
    - count = len(expenses)"]
    COMPUTE --> SORT["Sort categories by total (descending)"]
    SORT --> RESPONSE["ReportResponse {
    totals_by_category: CategoryTotal[],
    expenses: Expense[]
    }"]

    REQUEST_CSV["GET /export/csv"] --> BUILD_REPORT["build_report()"]
    BUILD_REPORT --> CSV_WRITE["csv.writer writes rows:
    Header: ID, Merchant, Date, Amount, Currency, Category, Type
    Body: one row per expense"]
    CSV_WRITE --> STREAM["StreamingResponse
    Content-Disposition: attachment
    filename=expense_report.csv"]
```

---

## 12. Frontend-Backend Communication

```mermaid
flowchart LR
    subgraph Browser ["Browser (localhost:5173)"]
        REACT[React App]
    end

    subgraph Vite ["Vite Dev Server"]
        PROXY["Proxy: /api/* -> localhost:8000/*
        Rewrites /api prefix"]
    end

    subgraph Backend ["FastAPI (localhost:8000)"]
        CORS["CORS Middleware
        allow_origins=['*']"]
        ROUTES[API Routes]
    end

    REACT -->|"fetch('/api/extract')"| PROXY
    PROXY -->|"rewrite to '/extract'"| CORS
    CORS --> ROUTES
    ROUTES -->|JSON response| PROXY
    PROXY -->|response| REACT
```

**Vite Proxy Configuration** (`vite.config.ts`):
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

All frontend API calls use the `/api` prefix, which Vite proxies to the FastAPI backend on port 8000 with the prefix stripped.

---

## 13. Error Handling Strategy

```mermaid
flowchart TD
    subgraph Client ["Frontend Error Handling"]
        C1["File validation (type, size)"] --> C2["Show inline error message"]
        C3["Form validation (required, format)"] --> C4["Show per-field error messages"]
        C5["API call failure"] --> C6["try/catch -> setError(message)"]
        C7["No extraction state"] --> C8["Show 'upload receipt first' message"]
    end

    subgraph Server ["Backend Error Handling"]
        S1["Invalid file type"] --> S2["400: Only JPG/PNG accepted"]
        S3["File too large"] --> S4["400: File exceeds 10MB"]
        S5["Missing input"] --> S6["400: Provide file or receipt_id"]
        S7["Sample not found"] --> S8["404: Sample receipt not found"]
        S9["Invalid date format"] --> S10["400: Invalid date format"]
        S11["Claude API unavailable"] --> S12["Fallback to rule-based / placeholder"]
    end

    subgraph Graceful ["Graceful Degradation"]
        G1["No ANTHROPIC_API_KEY"] --> G2["Image extraction: placeholder from filename"]
        G1 --> G3["Category suggestion: rule-based only"]
        G1 --> G4["Chat insights: keyword-based fallback"]
    end
```

---

## 14. Environment & Configuration

| Variable          | Required | Default | Description                                      |
|-------------------|----------|---------|--------------------------------------------------|
| `ANTHROPIC_API_KEY` | No*    | —       | Claude API key. *Required for AI features.       |
| `FALLBACK_MODE`   | No       | —       | Toggle fallback JSON extraction (for demo)       |
| `TESSERACT_PATH`  | No       | —       | Path to Tesseract binary (not used in MVP)       |

**Ports:**
- Frontend (Vite): `http://localhost:5173`
- Backend (Uvicorn): `http://localhost:8000`

**Startup Commands:**
```bash
# Backend
cd backend && source venv/Scripts/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

---

## 15. File Structure

```
receipt-slayer/
├── CLAUDE.md                          # AI assistant instructions
├── docs/
│   ├── problem-statement.txt          # BRD + FRD + TRD
│   ├── Receipt_Slayer_BRD.docx        # Business Requirements Document
│   └── technical-documentation.md     # This document
├── backend/
│   ├── .env                           # Environment variables (ANTHROPIC_API_KEY)
│   ├── requirements.txt               # Python dependencies
│   ├── venv/                          # Python virtual environment
│   ├── main.py                        # FastAPI app + route handlers
│   ├── models.py                      # Pydantic models + CATEGORIES list
│   ├── extraction.py                  # Receipt extraction (Claude Vision + fallback)
│   ├── category_engine.py             # Rule-based + Claude category suggestion
│   ├── chat_engine.py                 # Deterministic aggregates + Claude NL phrasing
│   ├── report_builder.py              # Report aggregation from in-memory store
│   ├── sample_data.py                 # 5 pre-built sample receipts
│   └── store.py                       # In-memory expense storage
└── frontend/
    ├── package.json                   # Node dependencies
    ├── vite.config.ts                 # Vite config + API proxy
    ├── tsconfig.json                  # TypeScript configuration
    └── src/
        ├── main.tsx                   # React entry point
        ├── App.tsx                    # Router + layout (header + nav)
        ├── index.css                  # Tailwind imports + custom theme
        ├── api.ts                     # API client functions
        ├── types.ts                   # TypeScript interfaces + CATEGORIES
        └── pages/
            ├── UploadPage.tsx         # Screen 1: Upload receipt
            ├── ReviewPage.tsx         # Screen 2: Review & categorize
            └── ReportPage.tsx         # Screen 3: Report + Chat panel
```

---

*End of Technical Documentation*
