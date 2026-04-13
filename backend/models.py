from pydantic import BaseModel, Field
from typing import Literal
import uuid

DEFAULT_CATEGORIES = [
    "Travel",
    "Meals & Entertainment",
    "Office Supplies",
    "Transportation",
    "Accommodation",
    "Equipment",
    "Other",
]


class LineItem(BaseModel):
    name: str
    quantity: float = 1.0
    unit_price: float


class FieldConfidence(BaseModel):
    merchant: Literal["High", "Medium", "Low"]
    date: Literal["High", "Medium", "Low"]
    amount: Literal["High", "Medium", "Low"]
    category: Literal["High", "Medium", "Low"]


class ExtractResponse(BaseModel):
    merchant: str
    date: str
    amount: float
    currency: str = "USD"
    suggested_category: str
    field_confidence: FieldConfidence
    receipt_ref: str
    image_url: str | None = None
    line_items: list[LineItem] = []
    subtotal: float | None = None
    tax_amount: float | None = None


class ConfirmRequest(BaseModel):
    merchant: str = Field(min_length=1)
    date: str
    amount: float = Field(gt=0)
    category: str
    expense_type: Literal["Personal", "Business"] = "Personal"
    receipt_ref: str
    confidence_scores: FieldConfidence | None = None
    image_url: str | None = None
    line_items: list[LineItem] = []
    subtotal: float | None = None
    tax_amount: float | None = None


class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    merchant: str
    date: str
    amount: float
    currency: str = "USD"
    category: str
    expense_type: str
    confidence_scores: FieldConfidence
    image_url: str | None = None
    line_items: list[LineItem] = []
    subtotal: float | None = None
    tax_amount: float | None = None


class CategoryTotal(BaseModel):
    category: str
    total: float
    count: int


class ReportResponse(BaseModel):
    totals_by_category: list[CategoryTotal]
    expenses: list[Expense]


class ChatRequest(BaseModel):
    report_data: ReportResponse
    user_query: str


class ChatResponse(BaseModel):
    answer: str
    referenced_values: dict
    confidence: Literal["High", "Medium", "Low"]
