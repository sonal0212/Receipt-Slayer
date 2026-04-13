import type { Expense, ExtractResponse, LineItem, ReportData, SampleReceipt } from "./types";

const BASE = "/api";

export async function fetchSamples(): Promise<SampleReceipt[]> {
  const res = await fetch(`${BASE}/samples`);
  if (!res.ok) throw new Error("Failed to fetch samples");
  return res.json();
}

export async function extractFromSample(
  receiptId: string
): Promise<ExtractResponse> {
  const form = new FormData();
  form.append("receipt_id", receiptId);
  const res = await fetch(`${BASE}/extract`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Extraction failed" }));
    throw new Error(err.detail || "Extraction failed");
  }
  return res.json();
}

export async function extractFromImage(
  file: File
): Promise<ExtractResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/extract`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Extraction failed" }));
    throw new Error(err.detail || "Extraction failed");
  }
  return res.json();
}

export async function confirmExpense(data: {
  merchant: string;
  date: string;
  amount: number;
  category: string;
  expense_type: string;
  receipt_ref: string;
  confidence_scores?: {
    merchant: string;
    date: string;
    amount: string;
    category: string;
  };
  image_url?: string | null;
  line_items?: LineItem[];
  subtotal?: number | null;
  tax_amount?: number | null;
}): Promise<{ status: string; expense_id: string }> {
  const res = await fetch(`${BASE}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Confirm failed" }));
    throw new Error(err.detail || "Confirm failed");
  }
  return res.json();
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${BASE}/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function addCategory(
  name: string
): Promise<{ status: string; category: string; categories: string[] }> {
  const res = await fetch(`${BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to add category" }));
    throw new Error(err.detail || "Failed to add category");
  }
  return res.json();
}

export async function fetchExpense(expenseId: string): Promise<Expense> {
  const res = await fetch(`${BASE}/expense/${expenseId}`);
  if (!res.ok) throw new Error("Failed to fetch expense");
  return res.json();
}

export async function updateExpense(
  expenseId: string,
  data: {
    merchant: string;
    date: string;
    amount: number;
    category: string;
    expense_type: string;
    receipt_ref: string;
    confidence_scores?: {
      merchant: string;
      date: string;
      amount: string;
      category: string;
    };
    image_url?: string | null;
    line_items?: LineItem[];
    subtotal?: number | null;
    tax_amount?: number | null;
  }
): Promise<{ status: string; expense_id: string }> {
  const res = await fetch(`${BASE}/expense/${expenseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Update failed" }));
    throw new Error(err.detail || "Update failed");
  }
  return res.json();
}

export async function fetchReport(): Promise<ReportData> {
  const res = await fetch(`${BASE}/report`);
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

export async function exportCsv(): Promise<void> {
  const res = await fetch(`${BASE}/export/csv`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expense_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function chatInsight(
  reportData: ReportData,
  query: string
): Promise<{
  answer: string;
  referenced_values: Record<string, unknown>;
  confidence: "High" | "Medium" | "Low";
}> {
  const res = await fetch(`${BASE}/chat-insight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_data: reportData, user_query: query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Chat failed" }));
    throw new Error(err.detail || "Chat failed");
  }
  return res.json();
}
