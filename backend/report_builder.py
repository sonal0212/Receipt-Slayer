from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from models import CategoryTotal, ReportResponse
from store import get_all_expenses


async def build_report(session: AsyncSession) -> ReportResponse:
    expenses = await get_all_expenses(session)
    cat_totals: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0})

    for exp in expenses:
        cat_totals[exp.category]["total"] += exp.amount
        cat_totals[exp.category]["count"] += 1

    totals = [
        CategoryTotal(
            category=cat,
            total=round(d["total"], 2),
            count=d["count"],
        )
        for cat, d in sorted(cat_totals.items(), key=lambda x: -x[1]["total"])
    ]

    return ReportResponse(totals_by_category=totals, expenses=expenses)
