import base64
import json
import os

from sqlalchemy.ext.asyncio import AsyncSession

from models import ExtractResponse, FieldConfidence, LineItem
from sample_data import SAMPLE_RECEIPTS
from category_engine import suggest_category
from store import add_category


def extract_from_sample(receipt_id: str) -> ExtractResponse:
    """Fallback mode: return pre-extracted data for a sample receipt."""
    data = SAMPLE_RECEIPTS[receipt_id]
    line_items = [LineItem(**item) for item in data.get("line_items", [])]
    return ExtractResponse(
        merchant=data["merchant"],
        date=data["date"],
        amount=data["amount"],
        currency=data["currency"],
        suggested_category=data["suggested_category"],
        field_confidence=FieldConfidence(**data["field_confidence"]),
        receipt_ref=receipt_id,
        line_items=line_items,
        subtotal=data.get("subtotal"),
        tax_amount=data.get("tax_amount"),
    )


async def extract_from_image(session: AsyncSession, image_bytes: bytes, filename: str) -> ExtractResponse:
    """OCR mode: use Claude vision to extract fields from receipt image.
    Falls back to placeholder extraction when ANTHROPIC_API_KEY is not set."""
    import uuid

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Fallback: return placeholder data so the demo works without an API key
        merchant = filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
        cat, cat_conf = suggest_category(merchant)
        return ExtractResponse(
            merchant=merchant,
            date="2026-02-28",
            amount=0.00,
            currency="USD",
            suggested_category=cat,
            field_confidence=FieldConfidence(
                merchant="Low", date="Low", amount="Low", category=cat_conf,
            ),
            receipt_ref=str(uuid.uuid4())[:8],
        )

    from anthropic import Anthropic

    client = Anthropic()
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "jpeg"
    media_type = "image/png" if ext == "png" else "image/jpeg"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64_image,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract these fields from the receipt image. "
                            "Return ONLY valid JSON, no markdown:\n"
                            '{"merchant": "store name", "date": "YYYY-MM-DD", '
                            '"amount": 0.00, "currency": "USD", '
                            '"suggested_category": "category name", '
                            '"line_items": [{"name": "item", "quantity": 1, "unit_price": 0.00}], '
                            '"subtotal": 0.00, "tax_amount": 0.00}\n'
                            "For suggested_category, pick the best fit from: "
                            "Travel, Meals & Entertainment, Office Supplies, "
                            "Transportation, Accommodation, Equipment, Other. "
                            "If none fit well, suggest a NEW descriptive category name. "
                            "Extract all individual line items with name, quantity, and unit_price. "
                            "subtotal is the pre-tax total. tax_amount is the tax charged. "
                            "amount is the final total (subtotal + tax). "
                            "If a field is unclear, make your best guess."
                        ),
                    },
                ],
            }
        ],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    parsed = json.loads(raw)

    merchant = parsed.get("merchant", "Unknown")
    date = parsed.get("date", "2026-01-01")
    amount = float(parsed.get("amount", 0))
    currency = parsed.get("currency", "USD")
    ai_category = parsed.get("suggested_category", "").strip()

    # Parse line items, subtotal, tax
    raw_items = parsed.get("line_items", [])
    line_items = []
    for item in raw_items:
        if isinstance(item, dict) and "name" in item:
            line_items.append(LineItem(
                name=item["name"],
                quantity=float(item.get("quantity", 1)),
                unit_price=float(item.get("unit_price", 0)),
            ))
    subtotal = parsed.get("subtotal")
    if subtotal is not None:
        subtotal = float(subtotal)
    tax_amount = parsed.get("tax_amount")
    if tax_amount is not None:
        tax_amount = float(tax_amount)

    # Use AI-suggested category if provided; auto-register if it's new
    if ai_category:
        await add_category(session, ai_category)  # no-op if already exists
        cat = ai_category
        cat_conf = "High"
    else:
        cat, cat_conf = suggest_category(merchant)

    # Assign confidence based on whether fields were extracted
    field_confidence = FieldConfidence(
        merchant="High" if merchant != "Unknown" else "Low",
        date="High" if date != "2026-01-01" else "Low",
        amount="High" if amount > 0 else "Low",
        category=cat_conf,
    )

    return ExtractResponse(
        merchant=merchant,
        date=date,
        amount=amount,
        currency=currency,
        suggested_category=cat,
        field_confidence=field_confidence,
        receipt_ref=str(uuid.uuid4())[:8],
        line_items=line_items,
        subtotal=subtotal,
        tax_amount=tax_amount,
    )
