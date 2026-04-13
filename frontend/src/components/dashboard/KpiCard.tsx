interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
}

export default function KpiCard({ label, value, subtitle, icon }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start">
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{label}</p>
        <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">
          {icon}
        </span>
      </div>
      <p className="text-slate-900 text-3xl font-bold leading-tight">{value}</p>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
