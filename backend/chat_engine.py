import json
import os

from models import ChatResponse, ReportResponse


def compute_aggregates(report: ReportResponse) -> dict:
    """Pure Python deterministic aggregates. No LLM."""
    expenses = report.expenses
    if not expenses:
        return {
            "total_spend": 0,
            "count": 0,
            "top_category": None,
            "largest_expense": None,
            "average_expense": 0,
            "high_expenses": [],
            "by_category": {},
            "travel_expenses": [],
        }

    total = sum(e.amount for e in expenses)
    top = max(report.totals_by_category, key=lambda t: t.total)
    largest = max(expenses, key=lambda e: e.amount)
    avg = total / len(expenses)
    high_expenses = [e for e in expenses if e.amount > avg * 2]

    return {
        "total_spend": round(total, 2),
        "count": len(expenses),
        "top_category": {
            "name": top.category,
            "total": round(top.total, 2),
            "count": top.count,
        },
        "largest_expense": {
            "merchant": largest.merchant,
            "amount": largest.amount,
            "date": largest.date,
            "category": largest.category,
        },
        "average_expense": round(avg, 2),
        "high_expenses": [
            {"merchant": e.merchant, "amount": e.amount, "category": e.category}
            for e in high_expenses
        ],
        "by_category": {
            t.category: {"total": round(t.total, 2), "count": t.count}
            for t in report.totals_by_category
        },
        "travel_expenses": [
            {"merchant": e.merchant, "amount": e.amount, "date": e.date}
            for e in expenses
            if e.category == "Travel"
        ],
    }


async def answer_query(report: ReportResponse, query: str) -> ChatResponse:
    """Compute aggregates deterministically, then use Claude for NL phrasing."""
    aggs = compute_aggregates(report)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback_response(aggs, query)

    try:
        from anthropic import Anthropic

        client = Anthropic()
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=(
                "You are an expense report assistant. Given pre-computed aggregate data "
                "and a user question, write a clear, concise natural-language answer. "
                "Use ONLY the provided data. Do not invent numbers. "
                "Return ONLY valid JSON, no markdown."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Aggregated expense data:\n{json.dumps(aggs, indent=2)}\n\n"
                        f"User question: {query}\n\n"
                        "Respond with ONLY valid JSON:\n"
                        '{"answer": "your natural language answer", '
                        '"referenced_values": {"key": "value"}, '
                        '"confidence": "High|Medium|Low"}'
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
        return ChatResponse(
            answer=parsed.get("answer", "I couldn't generate an answer."),
            referenced_values=parsed.get("referenced_values", {}),
            confidence=parsed.get("confidence", "Medium"),
        )
    except Exception:
        return _fallback_response(aggs, query)


def _fallback_response(aggs: dict, query: str) -> ChatResponse:
    """Return raw aggregates formatted as text when Claude is unavailable."""
    q = query.lower()
    if "total" in q and "spend" in q:
        return ChatResponse(
            answer=f"Total spend is ${aggs['total_spend']} across {aggs['count']} receipts.",
            referenced_values={"total_spend": aggs["total_spend"], "count": aggs["count"]},
            confidence="High",
        )
    if "top" in q and "category" in q:
        top = aggs.get("top_category")
        if top:
            return ChatResponse(
                answer=f"Top spending category is {top['name']} at ${top['total']} ({top['count']} receipts).",
                referenced_values=top,
                confidence="High",
            )
    if "largest" in q or "biggest" in q:
        lg = aggs.get("largest_expense")
        if lg:
            return ChatResponse(
                answer=f"Largest expense is ${lg['amount']} at {lg['merchant']} on {lg['date']}.",
                referenced_values=lg,
                confidence="High",
            )
    if "travel" in q:
        travel = aggs.get("travel_expenses", [])
        if travel:
            total = sum(t["amount"] for t in travel)
            return ChatResponse(
                answer=f"Found {len(travel)} travel expense(s) totaling ${round(total, 2)}.",
                referenced_values={"travel_expenses": travel, "travel_total": round(total, 2)},
                confidence="High",
            )
        return ChatResponse(
            answer="No travel expenses found in the report.",
            referenced_values={},
            confidence="High",
        )
    if "unusual" in q or "high" in q or "anomal" in q:
        high = aggs.get("high_expenses", [])
        if high:
            return ChatResponse(
                answer=f"Found {len(high)} expense(s) above 2x the average (${aggs['average_expense']}): "
                + ", ".join(f"{e['merchant']} (${e['amount']})" for e in high),
                referenced_values={"high_expenses": high, "average": aggs["average_expense"]},
                confidence="Medium",
            )
        return ChatResponse(
            answer=f"No unusually high expenses detected. Average is ${aggs['average_expense']}.",
            referenced_values={"average": aggs["average_expense"]},
            confidence="High",
        )
    return ChatResponse(
        answer=f"Report has {aggs['count']} expenses totaling ${aggs['total_spend']}. Top category: {aggs.get('top_category', {}).get('name', 'N/A')}.",
        referenced_values=aggs,
        confidence="Medium",
    )
