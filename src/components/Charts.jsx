import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export default function Charts({ dailyData, categoryData, balanceData, variant = "ui" }) {
  // variant = "ui" or "pdf"

  const isPDF = variant === "pdf";

  const cardClass = isPDF
    ? "bg-white rounded-none shadow-none border border-slate-300 p-3"
    : "bg-white dark:bg-slate-900 rounded-2xl shadow p-4";

  const titleClass = isPDF
    ? "font-bold mb-2 text-slate-900"
    : "font-bold mb-3 text-slate-800 dark:text-slate-100";

  // Chart styling
  const axisColor = isPDF ? "#111827" : "#334155";
  const gridColor = isPDF ? "#e5e7eb" : "#cbd5e1";

  const pieColors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#06b6d4"];

  return (
    <div className={isPDF ? "grid grid-cols-3 gap-3" : "grid md:grid-cols-3 gap-3"}>
      {/* DAILY SPEND */}
      <div className={cardClass}>
        <h3 className={titleClass}>Daily Spend</h3>
        <div className={isPDF ? "h-40" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <XAxis dataKey="date" hide tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip />
              <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CATEGORY PIE */}
      <div className={cardClass}>
        <h3 className={titleClass}>Category</h3>
        <div className={isPDF ? "h-40" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={isPDF ? 55 : 80}>
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BALANCE TREND */}
      <div className={cardClass}>
        <h3 className={titleClass}>Balance Trend</h3>
        <div className={isPDF ? "h-40" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" hide tick={{ fill: axisColor }} />
              <YAxis tick={{ fill: axisColor }} />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
