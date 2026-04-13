import json

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Float, Integer, String, Text, func

from database import Base
from models import Expense, FieldConfidence, LineItem


class ExpenseRow(Base):
    __tablename__ = "expenses"

    id = Column(String(8), primary_key=True)
    merchant = Column(String(255), nullable=False)
    date = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    category = Column(String(100), nullable=False)
    expense_type = Column(String(20), nullable=False)
    conf_merchant = Column(String(6), nullable=False)
    conf_date = Column(String(6), nullable=False)
    conf_amount = Column(String(6), nullable=False)
    conf_category = Column(String(6), nullable=False)
    image_url = Column(String(512), nullable=True)
    line_items_json = Column(Text, nullable=True)
    subtotal = Column(Float, nullable=True)
    tax_amount = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
    )


class CategoryRow(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())


# ── Conversion helpers ──────────────────────────────────────────────


def expense_row_to_pydantic(row: ExpenseRow) -> Expense:
    line_items = []
    if row.line_items_json:
        line_items = [LineItem(**item) for item in json.loads(row.line_items_json)]
    return Expense(
        id=row.id,
        merchant=row.merchant,
        date=row.date,
        amount=row.amount,
        currency=row.currency,
        category=row.category,
        expense_type=row.expense_type,
        confidence_scores=FieldConfidence(
            merchant=row.conf_merchant,
            date=row.conf_date,
            amount=row.conf_amount,
            category=row.conf_category,
        ),
        image_url=row.image_url,
        line_items=line_items,
        subtotal=row.subtotal,
        tax_amount=row.tax_amount,
    )


def pydantic_to_expense_row(expense: Expense) -> ExpenseRow:
    line_items_json = None
    if expense.line_items:
        line_items_json = json.dumps([item.model_dump() for item in expense.line_items])
    return ExpenseRow(
        id=expense.id,
        merchant=expense.merchant,
        date=expense.date,
        amount=expense.amount,
        currency=expense.currency,
        category=expense.category,
        expense_type=expense.expense_type,
        conf_merchant=expense.confidence_scores.merchant,
        conf_date=expense.confidence_scores.date,
        conf_amount=expense.confidence_scores.amount,
        conf_category=expense.confidence_scores.category,
        image_url=expense.image_url,
        line_items_json=line_items_json,
        subtotal=expense.subtotal,
        tax_amount=expense.tax_amount,
    )
