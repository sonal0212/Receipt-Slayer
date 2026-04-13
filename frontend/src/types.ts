export interface FieldConfidence {
  merchant: "High" | "Medium" | "Low";
  date: "High" | "Medium" | "Low";
  amount: "High" | "Medium" | "Low";
  category: "High" | "Medium" | "Low";
}

export interface LineItem {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface ExtractResponse {
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  suggested_category: string;
  field_confidence: FieldConfidence;
  receipt_ref: string;
  image_url?: string | null;
  line_items?: LineItem[];
  subtotal?: number | null;
  tax_amount?: number | null;
}

export interface Expense {
  id: string;
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  expense_type: string;
  confidence_scores: FieldConfidence;
  image_url?: string | null;
  line_items?: LineItem[];
  subtotal?: number | null;
  tax_amount?: number | null;
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface ReportData {
  totals_by_category: CategoryTotal[];
  expenses: Expense[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  referenced_values?: Record<string, unknown>;
  confidence?: "High" | "Medium" | "Low";
}

export interface SampleReceipt {
  id: string;
  description: string;
}

export const CATEGORIES = [
  "Travel",
  "Meals & Entertainment",
  "Office Supplies",
  "Transportation",
  "Accommodation",
  "Equipment",
  "Other",
] as const;
