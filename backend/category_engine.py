import json
import os

KEYWORD_MAP = {
    "Travel": [
        "airline", "flight", "air", "delta", "united", "american airlines",
        "southwest", "jetblue", "spirit", "frontier",
    ],
    "Meals & Entertainment": [
        "restaurant", "cafe", "grille", "bar", "dining", "food", "pizza",
        "starbucks", "mcdonald", "subway", "chipotle", "diner", "bistro",
    ],
    "Office Supplies": [
        "staples", "office depot", "paper", "ink", "toner", "supplies",
        "officeworks",
    ],
    "Transportation": [
        "uber", "lyft", "taxi", "cab", "parking", "transit", "gas",
        "fuel", "shell", "chevron", "bp",
    ],
    "Accommodation": [
        "marriott", "hilton", "hotel", "inn", "airbnb", "motel", "hyatt",
        "sheraton", "westin", "holiday inn",
    ],
    "Equipment": [
        "apple", "dell", "laptop", "monitor", "keyboard", "best buy",
        "amazon", "newegg",
    ],
}


def suggest_category(merchant: str, description: str = "") -> tuple[str, str]:
    """Suggest category using keyword rules. Returns (category, confidence)."""
    text = f"{merchant} {description}".lower()
    for category, keywords in KEYWORD_MAP.items():
        if any(kw in text for kw in keywords):
            return category, "High"
    return "Other", "Low"


async def suggest_category_with_claude(
    merchant: str, amount: float, date: str, categories: list[str] | None = None
) -> tuple[str, str]:
    """Use Claude when rule-based gives Low confidence. Returns (category, confidence)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return suggest_category(merchant)

    if categories is None:
        from models import DEFAULT_CATEGORIES
        categories = list(DEFAULT_CATEGORIES)

    try:
        from anthropic import Anthropic

        client = Anthropic()
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Categorize this expense into exactly one of: {', '.join(categories)}.\n\n"
                        f"Merchant: {merchant}\nAmount: ${amount}\nDate: {date}\n\n"
                        'Reply with ONLY valid JSON: {"category": "...", "confidence": "High|Medium|Low"}'
                    ),
                }
            ],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        parsed = json.loads(raw)
        cat = parsed.get("category", "Other")
        conf = parsed.get("confidence", "Medium")
        if cat in categories:
            return cat, conf
        return "Other", "Low"
    except Exception:
        return suggest_category(merchant)
