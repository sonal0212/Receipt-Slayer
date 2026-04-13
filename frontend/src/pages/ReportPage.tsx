import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReport, exportCsv, chatInsight } from "../api";
import type { ReportData, ChatMessage } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  "Travel": "bg-blue-100 text-blue-800",
  "Meals & Entertainment": "bg-orange-100 text-orange-800",
  "Office Supplies": "bg-purple-100 text-purple-800",
  "Transportation": "bg-blue-100 text-blue-800",
  "Accommodation": "bg-teal-100 text-teal-800",
  "Equipment": "bg-purple-100 text-purple-800",
  "Other": "bg-slate-100 text-slate-800",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Travel": "flight_takeoff",
  "Meals & Entertainment": "restaurant",
  "Office Supplies": "edit_note",
  "Transportation": "directions_car",
  "Accommodation": "hotel",
  "Equipment": "computer",
  "Other": "receipt_long",
};

const SUGGESTED_QUESTIONS = [
  { label: "Top category", icon: "category", query: "Top spending category?" },
  { label: "Total spend", icon: "payments", query: "Total spend?" },
  { label: "Largest expense", icon: "trending_up", query: "Largest expense?" },
  { label: "Show travel", icon: "flight", query: "Show travel expenses" },
  { label: "Unusual expenses", icon: "warning", query: "Any unusual expenses?" },
];

export default function ReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [columns, setColumns] = useState({
    merchant: true,
    date: true,
    amount: true,
    category: true,
    type: true,
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleExport = async () => {
    setExporting(true);
    try { await exportCsv(); } catch { /* ignore */ } finally { setExporting(false); }
  };

  const sendChat = async (query: string) => {
    if (!query.trim() || !report) return;
    const userMsg: ChatMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await chatInsight(report, query);
      const assistantMsg: ChatMessage = {
        role: "assistant", content: res.answer,
        referenced_values: res.referenced_values, confidence: res.confidence,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that question." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const expenses = report?.expenses ?? [];
  const totals = report?.totals_by_category ?? [];
  const totalSpend = totals.reduce((s, t) => s + t.total, 0);
  const topCategory = totals.length > 0 ? totals[0] : null;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main report area */}
      <div className={`flex-1 overflow-auto transition-opacity ${chatOpen ? "" : ""}`}>
        <div className="max-w-7xl mx-auto p-4 lg:p-10 flex flex-col gap-8">
          {/* Title + Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-slate-900 text-3xl font-black leading-tight tracking-tight">Expense Report</h1>
              <p className="text-slate-500 text-base">
                {expenses.length} receipt{expenses.length !== 1 ? "s" : ""} confirmed
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/")}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Receipt
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || expenses.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-hover transition-colors shadow-md disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">description</span>
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
              {!chatOpen && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">analytics</span>
                  Chat Insights
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Spend</p>
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">payments</span>
              </div>
              <p className="text-slate-900 text-3xl font-bold leading-tight">${totalSpend.toFixed(2)}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Receipts</p>
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">receipt_long</span>
              </div>
              <p className="text-slate-900 text-3xl font-bold leading-tight">{expenses.length}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Top Category</p>
                <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">category</span>
              </div>
              <p className="text-slate-900 text-3xl font-bold leading-tight">{topCategory?.category ?? "—"}</p>
              {topCategory && (
                <p className="text-sm text-slate-500">${topCategory.total.toFixed(2)} ({topCategory.count} receipt{topCategory.count !== 1 ? "s" : ""})</p>
              )}
            </div>
          </div>

          {/* Expense Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Table header with column toggles */}
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-slate-900 text-xl font-bold">Expense Details</h2>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mr-2">
                  <span className="material-symbols-outlined text-lg">view_column</span>
                  Columns:
                </div>
                {Object.entries(columns).map(([col, visible]) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => setColumns((c) => ({ ...c, [col]: !c[col as keyof typeof c] }))}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-sm text-slate-600">{col.charAt(0).toUpperCase() + col.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3 block">receipt_long</span>
                <p className="font-medium">No expenses yet</p>
                <p className="text-sm mt-1">Upload and confirm receipts to see them here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {columns.merchant && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">Merchant</th>
                      )}
                      {columns.date && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">Date</th>
                      )}
                      {columns.category && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">Category</th>
                      )}
                      {columns.type && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">Type</th>
                      )}
                      {columns.amount && (
                        <th className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200 text-right">Amount</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        onClick={() => navigate("/review", { state: { expense: exp } })}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Click to review & edit"
                      >
                        {columns.merchant && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-600 text-lg">
                                  {CATEGORY_ICONS[exp.category] ?? "receipt_long"}
                                </span>
                              </div>
                              <span className="font-medium text-slate-900">{exp.merchant}</span>
                            </div>
                          </td>
                        )}
                        {columns.date && (
                          <td className="px-6 py-4 text-sm text-slate-600">{exp.date}</td>
                        )}
                        {columns.category && (
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[exp.category] ?? "bg-slate-100 text-slate-800"}`}>
                              {exp.category}
                            </span>
                          </td>
                        )}
                        {columns.type && (
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              {exp.expense_type}
                            </span>
                          </td>
                        )}
                        {columns.amount && (
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                            ${exp.amount.toFixed(2)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expenses.length > 0 && (
              <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/50">
                <p className="text-sm text-slate-500">Showing {expenses.length} expense{expenses.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          {totals.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Totals by Category</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {totals.map((t) => (
                  <div key={t.category} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-slate-500 text-lg">
                        {CATEGORY_ICONS[t.category] ?? "receipt_long"}
                      </span>
                      <p className="text-sm font-medium text-slate-700">{t.category}</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">${t.total.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">{t.count} receipt{t.count !== 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Insights Drawer */}
      {chatOpen && (
        <aside className="w-[420px] h-full bg-white border-l border-slate-200 flex flex-col shadow-2xl relative z-10">
          {/* Chat Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">analytics</span>
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">Chat Insights</h2>
                <p className="text-xs text-slate-500">AI Assistant powered by Claude</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setMessages([])}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title="Clear chat"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </header>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            {messages.length === 0 && (
              <>
                {/* Welcome message */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                  </div>
                  <div className="bg-slate-100 px-4 py-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm leading-relaxed max-w-[320px]">
                    Hello! I've analyzed your expense report with {expenses.length} receipt{expenses.length !== 1 ? "s" : ""}
                    {totalSpend > 0 ? ` totaling $${totalSpend.toFixed(2)}` : ""}. What would you like to explore?
                  </div>
                </div>
                {/* Suggested question chips */}
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q.query}
                      onClick={() => sendChat(q.query)}
                      disabled={chatLoading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all text-xs font-medium text-slate-600 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px] text-primary">{q.icon}</span>
                      {q.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <div
                    className={`px-4 py-3 text-sm leading-relaxed max-w-[320px] ${
                      msg.role === "user"
                        ? "bg-primary text-white rounded-tl-xl rounded-bl-xl rounded-br-xl shadow-md shadow-primary/20"
                        : "bg-slate-100 rounded-tr-xl rounded-br-xl rounded-bl-xl"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {/* Referenced Values Card */}
                  {msg.referenced_values && Object.keys(msg.referenced_values).length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-[320px]">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Referenced Values</span>
                        <span className="material-symbols-outlined text-[14px] text-slate-400">info</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {Object.entries(msg.referenced_values).map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">{k}</span>
                            <span className="text-xs font-bold text-primary">
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300">
                    <span className="material-symbols-outlined text-slate-600 text-[18px]">person</span>
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
                </div>
                <div className="flex gap-1.5 px-4 py-3 bg-slate-100 rounded-full">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <footer className="p-4 border-t border-slate-100 bg-white">
            <form
              onSubmit={(e) => { e.preventDefault(); sendChat(chatInput); }}
              className="relative flex items-center gap-2"
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your reports..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all disabled:opacity-50 shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </form>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              AI can make mistakes. Check important info.
            </p>
          </footer>
        </aside>
      )}
    </div>
  );
}
