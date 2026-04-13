import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { confirmExpense, updateExpense, fetchCategories, addCategory } from "../api";
import type { ExtractResponse, Expense, LineItem } from "../types";

function ConfidenceBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-amber-100 text-amber-700 border-amber-200",
  };
  const icons = { High: "check_circle", Medium: "info", Low: "warning" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${styles[level]}`}>
      <span className="material-symbols-outlined text-[12px]">{icons[level]}</span>
      {level === "Low" ? "Needs review" : level}
    </span>
  );
}

export default function ReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    extraction?: ExtractResponse;
    imageUrl?: string;
    expense?: Expense;
  } | null;

  const extraction = state?.extraction;
  const existingExpense = state?.expense;
  const isEditing = !!existingExpense;

  // Resolve image URL:
  // - For fresh uploads: use the blob URL passed via router state
  // - For existing expenses: proxy through backend to avoid S3 CORS issues
  const imageUrl = state?.imageUrl
    || (existingExpense?.image_url ? `/api/image/${existingExpense.id}` : null);

  const initialMerchant = extraction?.merchant ?? existingExpense?.merchant ?? "";
  const initialDate = extraction?.date ?? existingExpense?.date ?? "";
  const initialAmount = extraction?.amount?.toString() ?? existingExpense?.amount?.toString() ?? "";
  const initialCategory = extraction?.suggested_category ?? existingExpense?.category ?? "Other";
  const initialExpenseType = existingExpense?.expense_type as "Personal" | "Business" ?? "Personal";
  const initialConfidence = extraction?.field_confidence ?? existingExpense?.confidence_scores ?? {
    merchant: "High" as const, date: "High" as const, amount: "High" as const, category: "High" as const,
  };

  const initialLineItems: LineItem[] = extraction?.line_items ?? existingExpense?.line_items ?? [];
  const initialTaxAmount = extraction?.tax_amount ?? existingExpense?.tax_amount ?? 0;

  const [merchant, setMerchant] = useState(initialMerchant);
  const [date, setDate] = useState(initialDate);
  const [amount, setAmount] = useState(initialAmount);
  const [category, setCategory] = useState(initialCategory);
  const [expenseType, setExpenseType] = useState<"Personal" | "Business">(initialExpenseType);
  const [showCategoryPopup, setShowCategoryPopup] = useState(!!extraction && !isEditing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);
  const [taxAmount, setTaxAmount] = useState(initialTaxAmount.toString());

  const hasLineItems = lineItems.length > 0;
  const computedSubtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const parsedTax = parseFloat(taxAmount) || 0;
  const computedTotal = computedSubtotal + parsedTax;

  // Auto-sync amount when line items change
  useEffect(() => {
    if (lineItems.length > 0) {
      const sub = lineItems.reduce((s, item) => s + item.quantity * item.unit_price, 0);
      const tax = parseFloat(taxAmount) || 0;
      setAmount((sub + tax).toFixed(2));
    }
  }, [lineItems, taxAmount]);

  const hasData = !!extraction || !!existingExpense;

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        const suggestedCategory = extraction?.suggested_category ?? existingExpense?.category;
        if (suggestedCategory && !cats.some((c) => c.toLowerCase() === suggestedCategory.toLowerCase())) {
          setCategories((prev) => [...prev, suggestedCategory]);
        }
      })
      .catch(() => {
        setCategories(["Travel", "Meals & Entertainment", "Office Supplies", "Transportation", "Accommodation", "Equipment", "Other"]);
      });
  }, [extraction?.suggested_category, existingExpense?.category]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center pt-24 text-slate-500">
        <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">warning</span>
        <p className="text-lg font-medium">No extraction data</p>
        <p className="text-sm mt-1">
          Please{" "}
          <button onClick={() => navigate("/")} className="text-primary underline font-medium">
            upload a receipt
          </button>{" "}
          first.
        </p>
      </div>
    );
  }

  const confidence = initialConfidence;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!merchant.trim()) e.merchant = "Merchant is required";
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) e.date = "Date must be YYYY-MM-DD";
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = "Amount must be greater than 0";
    if (!category) e.category = "Category is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      // Use the S3 URL (not the blob URL) for persistence
      const persistentImageUrl = extraction?.image_url || existingExpense?.image_url || null;

      const lineItemsPayload = hasLineItems ? lineItems : [];
      const subtotalPayload = hasLineItems ? computedSubtotal : null;
      const taxPayload = hasLineItems ? parsedTax : null;

      if (isEditing && existingExpense) {
        await updateExpense(existingExpense.id, {
          merchant, date, amount: parseFloat(amount), category, expense_type: expenseType,
          receipt_ref: existingExpense.id, confidence_scores: confidence,
          image_url: persistentImageUrl,
          line_items: lineItemsPayload,
          subtotal: subtotalPayload,
          tax_amount: taxPayload,
        });
      } else {
        await confirmExpense({
          merchant, date, amount: parseFloat(amount), category, expense_type: expenseType,
          receipt_ref: extraction!.receipt_ref, confidence_scores: extraction!.field_confidence,
          image_url: persistentImageUrl,
          line_items: lineItemsPayload,
          subtotal: subtotalPayload,
          tax_amount: taxPayload,
        });
      }
      navigate("/report");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const fieldBorder = (field: keyof typeof confidence) =>
    confidence[field] === "Low"
      ? "border-2 border-amber-300 bg-amber-50/30 focus:ring-amber-500 focus:border-amber-500"
      : "border border-slate-300 bg-white focus:ring-primary focus:border-primary";

  return (
    <div className="max-w-7xl mx-auto w-full px-6 lg:px-10 py-8">
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">receipt_long</span>
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900">
              {isEditing ? "Edit Expense" : "Review Expense"}
            </h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Expenses</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="font-medium text-primary">Review & Categorize</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(isEditing ? "/report" : "/")}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600">close</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Receipt Preview */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Receipt Preview</span>
              {imageUrl && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const res = await fetch(imageUrl);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `receipt-${merchant || "image"}.${blob.type.includes("png") ? "png" : "jpg"}`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(imageUrl, "_blank");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download
                </button>
              )}
            </div>
            <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center relative">
              {imageUrl ? (
                <img src={imageUrl} alt="Receipt" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400 p-8">
                  <span className="material-symbols-outlined text-6xl text-slate-300 mb-3 block">receipt</span>
                  <p className="text-sm font-medium">
                    {isEditing ? existingExpense?.merchant : "Sample receipt"}
                  </p>
                  <p className="text-xs mt-1">
                    {isEditing
                      ? `$${existingExpense?.amount.toFixed(2)} — ${existingExpense?.date}`
                      : extraction?.receipt_ref}
                  </p>
                </div>
              )}
              {/* Scanning overlay border */}
              <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none"></div>
            </div>
          </div>
        </div>

        {/* Right Panel: Editable Fields */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* AI Category Suggestion Card */}
          {showCategoryPopup && extraction && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">AI Suggestion</p>
                    <h4 className="text-lg font-bold text-slate-900">{extraction.suggested_category}</h4>
                    <p className="text-sm text-slate-500">
                      <ConfidenceBadge level={confidence.category} />
                      {!["Travel", "Meals & Entertainment", "Office Supplies", "Transportation", "Accommodation", "Equipment", "Other"].includes(extraction.suggested_category) && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                          <span className="material-symbols-outlined text-[12px]">new_releases</span>
                          AI New
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCategory(extraction.suggested_category); setShowCategoryPopup(false); }}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setShowCategoryPopup(false)}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white rounded-xl p-6 lg:p-8 border border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Expense Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Merchant */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700">Merchant</label>
                  <ConfidenceBadge level={confidence.merchant} />
                </div>
                <div className="relative">
                  <input
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className={`w-full h-12 px-4 rounded-lg transition-all font-medium ${fieldBorder("merchant")}`}
                  />
                  {confidence.merchant === "Low" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-amber-500">edit</span>
                  )}
                </div>
                {errors.merchant && <p className="text-xs text-red-600">{errors.merchant}</p>}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Transaction Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full h-12 px-4 rounded-lg ${fieldBorder("date")}`}
                />
                {errors.date && <p className="text-xs text-red-600">{errors.date}</p>}
              </div>

              {/* Amount (read-only when line items exist) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Total Amount (USD){hasLineItems && <span className="text-xs text-slate-400 ml-1">(auto-calculated)</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    readOnly={hasLineItems}
                    className={`w-full h-12 pl-8 pr-4 rounded-lg font-bold text-lg ${hasLineItems ? "border border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed" : fieldBorder("amount")}`}
                  />
                </div>
                {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
              </div>

              {/* Line Items Table */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={() => setLineItems([...lineItems, { name: "", quantity: 1, unit_price: 0 }])}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Add Item
                  </button>
                </div>

                {lineItems.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="text-left py-2.5 px-3 font-semibold">Item Name</th>
                          <th className="text-right py-2.5 px-3 font-semibold w-20">Qty</th>
                          <th className="text-right py-2.5 px-3 font-semibold w-28">Unit Price</th>
                          <th className="text-right py-2.5 px-3 font-semibold w-24">Total</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2">
                              <input
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...lineItems];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setLineItems(updated);
                                }}
                                placeholder="Item name"
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm focus:ring-primary focus:border-primary"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => {
                                  const updated = [...lineItems];
                                  updated[idx] = { ...updated[idx], quantity: parseFloat(e.target.value) || 0 };
                                  setLineItems(updated);
                                }}
                                className="w-full h-9 px-2 rounded border border-slate-200 text-sm text-right focus:ring-primary focus:border-primary"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) => {
                                    const updated = [...lineItems];
                                    updated[idx] = { ...updated[idx], unit_price: parseFloat(e.target.value) || 0 };
                                    setLineItems(updated);
                                  }}
                                  className="w-full h-9 pl-5 pr-2 rounded border border-slate-200 text-sm text-right focus:ring-primary focus:border-primary"
                                />
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-slate-700">
                              ${(item.quantity * item.unit_price).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-1">
                              <button
                                type="button"
                                onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                                className="flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">close</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Subtotal / Tax / Total summary */}
                    <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium text-slate-700">${computedSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Tax</span>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={taxAmount}
                            onChange={(e) => setTaxAmount(e.target.value)}
                            className="w-full h-8 pl-5 pr-2 rounded border border-slate-200 text-sm text-right focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="font-bold text-lg text-slate-900">${computedTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
                    No line items. Click "Add Item" to itemize this receipt.
                  </div>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Category</label>
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-lg border border-slate-300 bg-white focus:ring-primary focus:border-primary"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="h-12 px-3 flex items-center gap-1 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    New
                  </button>
                </div>
                {showAddCategory && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Medical, Insurance..."
                      className="flex-1 h-10 px-3 border border-slate-300 rounded-lg text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newCategoryName.trim()) {
                            addCategory(newCategoryName.trim()).then((res) => {
                              setCategories(res.categories); setCategory(res.category);
                              setNewCategoryName(""); setShowAddCategory(false);
                            }).catch(() => {});
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCategoryName.trim()) {
                          addCategory(newCategoryName.trim()).then((res) => {
                            setCategories(res.categories); setCategory(res.category);
                            setNewCategoryName(""); setShowAddCategory(false);
                          }).catch(() => {});
                        }
                      }}
                      className="px-3 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}
                      className="px-3 py-2 text-slate-500 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
              </div>

              {/* Expense Type — Toggle Buttons */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Expense Type</label>
                <div className="flex p-1 bg-slate-100 rounded-lg h-12">
                  <button
                    type="button"
                    onClick={() => setExpenseType("Business")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-all ${
                      expenseType === "Business"
                        ? "bg-white shadow-sm text-primary"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">business_center</span>
                    Business
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType("Personal")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-all ${
                      expenseType === "Personal"
                        ? "bg-white shadow-sm text-primary"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">person</span>
                    Personal
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4">
              <span className="material-symbols-outlined text-red-500">error</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pb-12">
            {isEditing && (
              <button
                onClick={() => navigate("/report")}
                className="w-full sm:w-auto px-8 h-12 rounded-lg text-slate-600 font-bold hover:bg-slate-200/50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full sm:w-auto px-10 h-12 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isEditing ? "Saving..." : "Confirming..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  {isEditing ? "Save Changes" : "Confirm Expense"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
