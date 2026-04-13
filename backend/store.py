import json

from sqlalchemy import delete, func as sqlfunc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import CategoryRow, ExpenseRow, expense_row_to_pydantic, pydantic_to_expense_row
from models import DEFAULT_CATEGORIES, Expense


# ── Expense CRUD ────────────────────────────────────────────────────


async def add_expense(session: AsyncSession, expense: Expense) -> None:
    row = pydantic_to_expense_row(expense)
    session.add(row)
    await session.flush()


async def get_expense_by_id(session: AsyncSession, expense_id: str) -> Expense | None:
    result = await session.execute(
        select(ExpenseRow).where(ExpenseRow.id == expense_id)
    )
    row = result.scalar_one_or_none()
    return expense_row_to_pydantic(row) if row else None


async def update_expense(session: AsyncSession, expense_id: str, updated: Expense) -> Expense | None:
    result = await session.execute(
        select(ExpenseRow).where(ExpenseRow.id == expense_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    row.merchant = updated.merchant
    row.date = updated.date
    row.amount = updated.amount
    row.currency = updated.currency
    row.category = updated.category
    row.expense_type = updated.expense_type
    row.conf_merchant = updated.confidence_scores.merchant
    row.conf_date = updated.confidence_scores.date
    row.conf_amount = updated.confidence_scores.amount
    row.conf_category = updated.confidence_scores.category
    row.image_url = updated.image_url
    row.line_items_json = json.dumps([item.model_dump() for item in updated.line_items]) if updated.line_items else None
    row.subtotal = updated.subtotal
    row.tax_amount = updated.tax_amount
    await session.flush()
    return updated


async def get_all_expenses(session: AsyncSession) -> list[Expense]:
    result = await session.execute(select(ExpenseRow))
    rows = result.scalars().all()
    return [expense_row_to_pydantic(r) for r in rows]


async def clear(session: AsyncSession) -> None:
    await session.execute(delete(ExpenseRow))
    await session.flush()


# ── Category CRUD ───────────────────────────────────────────────────


async def get_all_categories(session: AsyncSession) -> list[str]:
    result = await session.execute(
        select(CategoryRow.name).order_by(CategoryRow.id)
    )
    return [row[0] for row in result.all()]


async def add_category(session: AsyncSession, name: str) -> bool:
    """Add a new category if it doesn't already exist (case-insensitive). Returns True if added."""
    normalized = name.strip()
    if not normalized:
        return False
    result = await session.execute(
        select(CategoryRow).where(sqlfunc.lower(CategoryRow.name) == normalized.lower())
    )
    if result.scalar_one_or_none():
        return False
    session.add(CategoryRow(name=normalized, is_default=False))
    await session.flush()
    return True


async def seed_default_categories(session: AsyncSession) -> None:
    """Insert the 7 default categories if they don't already exist."""
    for cat_name in DEFAULT_CATEGORIES:
        result = await session.execute(
            select(CategoryRow).where(sqlfunc.lower(CategoryRow.name) == cat_name.lower())
        )
        if not result.scalar_one_or_none():
            session.add(CategoryRow(name=cat_name, is_default=True))
    await session.commit()
