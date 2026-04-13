import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReport } from "../api";
import type { ReportData } from "../types";
import KpiCard from "../components/dashboard/KpiCard";
import SpendingByCategoryChart from "../components/dashboard/SpendingByCategoryChart";
import BusinessPersonalChart from "../components/dashboard/BusinessPersonalChart";
import SpendingOverTimeChart from "../components/dashboard/SpendingOverTimeChart";
import TopMerchantsChart from "../components/dashboard/TopMerchantsChart";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const expenses = report?.expenses ?? [];
  const totals = report?.totals_by_category ?? [];

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-24 text-slate-500">
        <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">insert_chart</span>
        <p className="text-lg font-medium">No data to visualize</p>
        <p className="text-sm mt-1">
          <button onClick={() => navigate("/")} className="text-primary underline font-medium">
            Upload receipts
          </button>{" "}
          and confirm them to see your dashboard.
        </p>
      </div>
    );
  }

  const totalSpend = totals.reduce((s, t) => s + t.total, 0);
  const receiptCount = expenses.length;
  const avgExpense = receiptCount > 0 ? totalSpend / receiptCount : 0;
  const topCategory = totals.length > 0 ? totals[0] : null;

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-slate-900 text-3xl font-black leading-tight tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-base">
            Visual analytics for {receiptCount} expense{receiptCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/report")}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">table_view</span>
          View Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Total Spend" value={`$${totalSpend.toFixed(2)}`} icon="payments" />
        <KpiCard label="Receipts" value={String(receiptCount)} icon="receipt_long" />
        <KpiCard label="Avg. Expense" value={`$${avgExpense.toFixed(2)}`} icon="calculate" />
        <KpiCard
          label="Top Category"
          value={topCategory?.category ?? "---"}
          subtitle={topCategory ? `$${topCategory.total.toFixed(2)} (${topCategory.count} receipt${topCategory.count !== 1 ? "s" : ""})` : undefined}
          icon="category"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingByCategoryChart data={totals} />
        <BusinessPersonalChart expenses={expenses} />
        <SpendingOverTimeChart expenses={expenses} />
        <TopMerchantsChart expenses={expenses} />
      </div>
    </div>
  );
}
