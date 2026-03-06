function fmtINR(value) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
}

const BASE_CARDS = [
  {
    key: "credit",
    label: "Total Credit",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
    color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0", iconBg: "#dcfce7",
  },
  {
    key: "debit",
    label: "Total Debit",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
      </svg>
    ),
    color: "#f43f5e", bg: "#fff1f2", border: "#fecdd3", iconBg: "#ffe4e6",
  },
  {
    key: "cashIn",
    label: "Cash In",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M12 10v4M10 12h4"/>
      </svg>
    ),
    color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", iconBg: "#d1fae5",
  },
  {
    key: "cashOut",
    label: "Cash Out",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M10 12h4"/>
      </svg>
    ),
    color: "#d97706", bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7",
  },
  {
    key: "netCash",
    label: "Net Cash",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", iconBg: "#fef3c7",
    dynamic: true,
  },
  {
    key: "balance",
    label: "Net Balance",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", iconBg: "#dbeafe",
    dynamic: true,
  },
];

export default function SummaryCards({ totals }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {BASE_CARDS.map(({ key, label, icon, color, bg, border, iconBg, dynamic }) => {
        const value = totals[key] ?? 0;

        // dynamic cards flip to red/grey based on sign
        let ac = color, ab = bg, abr = border, aib = iconBg;
        if (dynamic && value < 0) {
          ac = "#f43f5e"; ab = "#fff1f2"; abr = "#fecdd3"; aib = "#ffe4e6";
        } else if (dynamic && value === 0) {
          ac = "#64748b"; ab = "#f8fafc"; abr = "#e2e8f0"; aib = "#f1f5f9";
        }

        return (
          <div key={key}
            className="rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md dark:border-slate-700"
            style={{ background: ab, borderColor: abr }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide leading-tight" style={{ color: ac }}>
                {label}
              </p>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: aib, color: ac }}>
                {icon}
              </div>
            </div>
            <p className="font-black text-base md:text-lg leading-none" style={{ color: ac, letterSpacing: "-0.03em" }}>
              {fmtINR(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}