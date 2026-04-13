import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { CategoryTotal } from "../../types";

const CATEGORY_COLORS: Record<string, string> = {
  "Travel": "#3b82f6",
  "Meals & Entertainment": "#f97316",
  "Office Supplies": "#a855f7",
  "Transportation": "#0ea5e9",
  "Accommodation": "#14b8a6",
  "Equipment": "#8b5cf6",
  "Other": "#64748b",
};
const FALLBACK_COLORS = ["#1152d4", "#0ea5e9", "#f97316", "#a855f7", "#14b8a6", "#f43f5e", "#64748b"];

interface Props {
  data: CategoryTotal[];
}

export default function SpendingByCategoryChart({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.category, value: d.total, count: d.count }));

  const getColor = (category: string, index: number) =>
    CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Spending by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={getColor(entry.name, index)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown) => [`$${Number(value ?? 0).toFixed(2)}`, "Amount"]}
            contentStyle={{
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value: string) => <span className="text-sm text-slate-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
