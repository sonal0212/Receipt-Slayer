import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { Expense } from "../../types";

const TYPE_COLORS: Record<string, string> = {
  Business: "#1152d4",
  Personal: "#7ba3e8",
};

interface Props {
  expenses: Expense[];
}

export default function BusinessPersonalChart({ expenses }: Props) {
  const grouped = expenses.reduce<Record<string, number>>((acc, exp) => {
    const type = exp.expense_type || "Personal";
    acc[type] = (acc[type] || 0) + exp.amount;
    return acc;
  }, {});

  const chartData = Object.entries(grouped).map(([name, value]) => ({ name, value }));
  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Business vs Personal</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            nameKey="name"
            label={(props: PieLabelRenderProps) => `${props.name ?? ""} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || "#64748b"} />
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
          <Legend verticalAlign="bottom" iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
