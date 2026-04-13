import csv
import io
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    ChatRequest,
    ChatResponse,
    ConfirmRequest,
    Expense,
    ExtractResponse,
    FieldConfidence,
    ReportResponse,
)
from database import AsyncSessionLocal, get_db, init_db
from extraction import extract_from_image, extract_from_sample
from category_engine import suggest_category_with_claude
from report_builder import build_report
from chat_engine import answer_query
from sample_data import SAMPLE_RECEIPTS
from store import add_expense, get_expense_by_id, update_expense, add_category, get_all_categories, seed_default_categories
from s3_upload import upload_receipt_to_s3, fetch_receipt_from_s3

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed default categories."""
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_default_categories(session)
    yield


app = FastAPI(title="Receipt Slayer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/samples")
async def list_samples():
    """List available sample receipt IDs for the frontend."""
    return [
        {"id": k, "description": v["description"]}
        for k, v in SAMPLE_RECEIPTS.items()
    ]


@app.get("/categories")
async def list_categories(session: AsyncSession = Depends(get_db)):
    """Return the current list of categories (default + user-added)."""
    return await get_all_categories(session)


@app.post("/categories")
async def create_category(payload: dict, session: AsyncSession = Depends(get_db)):
    """Add a new custom category."""
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")
    await add_category(session, name)
    categories = await get_all_categories(session)
    return {"status": "created", "category": name, "categories": categories}


@app.post("/extract", response_model=ExtractResponse)
async def extract(
    file: UploadFile | None = File(None),
    receipt_id: str | None = Form(None),
    session: AsyncSession = Depends(get_db),
):
    """Extract fields from a receipt image or return sample data."""
    if receipt_id:
        if receipt_id not in SAMPLE_RECEIPTS:
            raise HTTPException(status_code=404, detail="Sample receipt not found")
        return extract_from_sample(receipt_id)

    if file:
        if file.content_type not in ("image/jpeg", "image/png"):
            raise HTTPException(status_code=400, detail="Only JPG/PNG files accepted")
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

        # Upload receipt to S3
        s3_url = upload_receipt_to_s3(
            contents,
            file.filename or "receipt.jpg",
            file.content_type or "image/jpeg",
        )
        if s3_url:
            import logging
            logging.getLogger(__name__).info("Receipt stored at: %s", s3_url)

        result = await extract_from_image(session, contents, file.filename or "receipt.jpg")
        result.image_url = s3_url
        return result

    raise HTTPException(status_code=400, detail="Provide either a file or receipt_id")


@app.post("/confirm")
async def confirm(req: ConfirmRequest, session: AsyncSession = Depends(get_db)):
    """Confirm an expense and add it to the report."""
    # Validate date format
    try:
        datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Auto-register new categories on confirm
    await add_category(session, req.category)

    # Use provided confidence scores or default
    confidence = req.confidence_scores or FieldConfidence(
        merchant="High", date="High", amount="High", category="High"
    )

    expense = Expense(
        merchant=req.merchant,
        date=req.date,
        amount=req.amount,
        currency="USD",
        category=req.category,
        expense_type=req.expense_type,
        confidence_scores=confidence,
        image_url=req.image_url,
        line_items=req.line_items,
        subtotal=req.subtotal,
        tax_amount=req.tax_amount,
    )
    await add_expense(session, expense)
    return {"status": "confirmed", "expense_id": expense.id}


@app.get("/expense/{expense_id}")
async def get_expense(expense_id: str, session: AsyncSession = Depends(get_db)):
    """Get a single expense by ID."""
    expense = await get_expense_by_id(session, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@app.put("/expense/{expense_id}")
async def update_expense_endpoint(expense_id: str, req: ConfirmRequest, session: AsyncSession = Depends(get_db)):
    """Update an existing expense."""
    existing = await get_expense_by_id(session, expense_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")

    try:
        datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    await add_category(session, req.category)

    confidence = req.confidence_scores or existing.confidence_scores

    updated = Expense(
        id=expense_id,
        merchant=req.merchant,
        date=req.date,
        amount=req.amount,
        currency="USD",
        category=req.category,
        expense_type=req.expense_type,
        confidence_scores=confidence,
        image_url=req.image_url or existing.image_url,
        line_items=req.line_items,
        subtotal=req.subtotal,
        tax_amount=req.tax_amount,
    )
    result = await update_expense(session, expense_id, updated)
    return {"status": "updated", "expense_id": result.id}


@app.get("/report", response_model=ReportResponse)
async def report(session: AsyncSession = Depends(get_db)):
    """Get the current expense report."""
    return await build_report(session)


@app.get("/export/csv")
async def export_csv(session: AsyncSession = Depends(get_db)):
    """Export the report as a CSV file."""
    report_data = await build_report(session)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Merchant", "Date", "Subtotal", "Tax", "Amount", "Currency", "Category", "Type"])
    for exp in report_data.expenses:
        writer.writerow([
            exp.id,
            exp.merchant,
            exp.date,
            exp.subtotal if exp.subtotal is not None else "",
            exp.tax_amount if exp.tax_amount is not None else "",
            exp.amount,
            exp.currency,
            exp.category,
            exp.expense_type,
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expense_report.csv"},
    )


@app.post("/chat-insight", response_model=ChatResponse)
async def chat_insight(req: ChatRequest):
    """Answer questions about the expense report using deterministic aggregates + Claude."""
    return await answer_query(req.report_data, req.user_query)


@app.get("/image/{expense_id}")
async def get_expense_image(expense_id: str, session: AsyncSession = Depends(get_db)):
    """Proxy endpoint to serve receipt images from S3, avoiding CORS issues."""
    expense = await get_expense_by_id(session, expense_id)
    if not expense or not expense.image_url:
        raise HTTPException(status_code=404, detail="Image not found")

    result = fetch_receipt_from_s3(expense.image_url)
    if not result:
        raise HTTPException(status_code=502, detail="Failed to fetch image from storage")

    file_bytes, content_type = result
    return StreamingResponse(
        iter([file_bytes]),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
