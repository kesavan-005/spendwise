import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const PIE_COLORS = ["#10b981","#3b82f6","#f59e0b","#f43f5e","#a855f7","#0ea5e9","#64748b"];

function fmtINR(v) {
  return `₹ ${Number(v || 0).toLocaleString("en-IN")}`;
}

// ── Pie outer label with leader line ─────────────────────────────────────
const RADIAN = Math.PI / 180;
function PieOuterLabel({ cx, cy, midAngle, outerRadius, name, percent, value }) {
  if (percent < 0.04) return null; // skip < 4% slices to avoid clutter

  const sin   = Math.sin(-midAngle * RADIAN);
  const cos   = Math.cos(-midAngle * RADIAN);
  const sx    = cx + (outerRadius + 6)  * cos;
  const sy    = cy + (outerRadius + 6)  * sin;
  const mx    = cx + (outerRadius + 20) * cos;
  const my    = cy + (outerRadius + 20) * sin;
  const ex    = mx + (cos >= 0 ? 1 : -1) * 14;
  const ey    = my;
  const anchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* Leader line */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="#94a3b8" fill="none" strokeWidth={1} />
      {/* Dot at pie edge */}
      <circle cx={ex} cy={ey} r={2} fill="#94a3b8" />
      {/* Category name */}
      <text x={ex + (cos >= 0 ? 4 : -4)} y={ey}
        textAnchor={anchor} dominantBaseline="central"
        style={{ fontSize: 10, fontWeight: 700, fill: "#475569" }}>
        {name.length > 10 ? name.slice(0, 9) + "…" : name}
      </text>
      {/* Amount below name */}
      <text x={ex + (cos >= 0 ? 4 : -4)} y={ey + 13}
        textAnchor={anchor} dominantBaseline="central"
        style={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }}>
        {fmtINR(value)}
      </text>
    </g>
  );
}

// ── Legend below pie ─────────────────────────────────────────────────────
function PieLegend({ data }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-2">
      {data.map((entry, i) => (
        <div key={entry.name} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {entry.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Empty placeholder ─────────────────────────────────────────────────────
function EmptyChart({ label }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
        stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
      <p className="text-xs font-medium text-slate-400">No {label} data yet</p>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function ChartCard({ title, children, isPDF }) {
  return (
    <div className={isPDF
      ? "bg-white border border-slate-200 rounded-xl p-3"
      : "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-visible"
    }>
      <p className={isPDF
        ? "text-xs font-bold text-slate-700 mb-2"
        : "text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3"
      }>
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Shared tooltip style ──────────────────────────────────────────────────
const ttStyle = {
  contentStyle: {
    borderRadius: 10,
    fontSize: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontFamily: "'DM Sans', sans-serif",
  },
};

// ─────────────────────────────────────────────────────────────────────────
export default function Charts({ dailyData = [], categoryData = [], balanceData = [], variant = "ui" }) {
  const isPDF = variant === "pdf";

  // ── PDF layout ─────────────────────────────────────────────────────────
  if (isPDF) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <ChartCard title="Daily Spend" isPDF>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top:2, right:2, left:-10, bottom:0 }}>
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => [fmtINR(v), "Spend"]} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="By Category" isPDF>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name"
                  outerRadius={50} paddingAngle={2} labelLine={false}
                  label={<PieOuterLabel />}>
                  {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [fmtINR(v), name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <PieLegend data={categoryData} />
        </ChartCard>

        <ChartCard title="Balance Trend" isPDF>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceData} margin={{ top:2, right:2, left:-10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => [fmtINR(v), "Balance"]} />
                <Line type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    );
  }

  // ── UI layout ──────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* Daily Spend */}
      <ChartCard title="Daily Spend">
        <div className="h-[200px] md:h-[220px] w-full">
          {dailyData.length === 0 ? <EmptyChart label="daily spend" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top:4, right:4, left:4, bottom:0 }}>
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                  width={70}
                />
                <Tooltip {...ttStyle} formatter={(v) => [fmtINR(v), "Spend"]} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[6,6,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Category Pie — outer labels with leader lines + legend */}
      <ChartCard title="By Category">
        {categoryData.length === 0 ? (
          <div className="h-[200px] md:h-[220px]"><EmptyChart label="category" /></div>
        ) : (
          <>
            {/* Extra height so outer labels don't clip */}
            <div className="h-[190px] md:h-[210px] w-full overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="55%"
                    paddingAngle={2}
                    labelLine={false}
                    label={<PieOuterLabel />}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...ttStyle} formatter={(v, name) => [fmtINR(v), name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend strips below */}
            <PieLegend data={categoryData} />
          </>
        )}
      </ChartCard>

      {/* Balance Trend */}
      <ChartCard title="Balance Trend">
        <div className="h-[200px] md:h-[220px] w-full">
          {balanceData.length === 0 ? <EmptyChart label="balance" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceData} margin={{ top:4, right:4, left:4, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                  width={70}
                />
                <Tooltip {...ttStyle} formatter={(v) => [fmtINR(v), "Balance"]} />
                <Line type="monotone" dataKey="balance" stroke="#10b981"
                  strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

    </div>
  );
}
