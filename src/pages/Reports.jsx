import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { exportSpendWisePDF } from "../utils/exportPDF";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { calcTotals, groupByCategory, groupByDate } from "../utils/calculations";

function formatINR(n) { return `₹ ${Number(n || 0).toFixed(0)}`; }
function cleanDateLabel(dateStr) {
  try { const [, m, d] = dateStr.split("-"); return `${d}/${m}`; }
  catch { return dateStr; }
}
function sortTxns(list, sortBy) {
  const arr = [...list];
  if (sortBy === "date_desc") return arr.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (sortBy === "az") return arr.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  if (sortBy === "za") return arr.sort((a, b) => (b.description || "").localeCompare(a.description || ""));
  return arr;
}

const PIE_COLORS = ["#10b981","#3b82f6","#f59e0b","#f43f5e","#a855f7","#0ea5e9","#64748b"];

const fieldClass =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium outline-none transition-all duration-150 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:bg-white";

const editFieldClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-medium outline-none transition-all duration-150 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:bg-white";

export default function Reports({ username }) {
  const [txns, setTxns] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteTxn, setDeleteTxn] = useState(null);
  const { toast, showToast, clearToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [openExportOptions, setOpenExportOptions] = useState(false);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [includeGraphValues, setIncludeGraphValues] = useState(true);
  const [selectedTxns, setSelectedTxns] = useState(new Set());

  const dailyRef = useRef(null);
  const categoryRef = useRef(null);
  const balanceRef = useRef(null);

  async function load() {
    setLoading(true);
    const q = query(
      collection(db, "users", username, "transactions"),
      orderBy("date", "asc"),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const categoryList = useMemo(() => {
    const set = new Set(txns.map((t) => t.category || "Other"));
    return ["all", ...Array.from(set).sort()];
  }, [txns]);

  const filtered = useMemo(() => {
    let list = [...txns];
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    if (categoryFilter !== "all") list = list.filter((t) => (t.category || "Other") === categoryFilter);
    if (fromDate) list = list.filter((t) => t.date >= fromDate);
    if (toDate) list = list.filter((t) => t.date <= toDate);
    return sortTxns(list, sortBy);
  }, [txns, typeFilter, categoryFilter, fromDate, toDate, sortBy]);

  const totals = useMemo(() => calcTotals(filtered), [filtered]);

  useEffect(() => {
    const auto = new Set();
    filtered.forEach((t) => { if (t.highlighted) auto.add(t.id); });
    setSelectedTxns(auto);
  }, [filtered]);

  const dailyData = useMemo(() => {
    const m = groupByDate(filtered.filter((t) => t.type === "debit"));
    return Object.keys(m).sort().map((date) => ({ date, label: cleanDateLabel(date), amount: m[date] })).slice(-15);
  }, [filtered]);

  const categoryData = useMemo(() => {
    const m = groupByCategory(filtered.filter((t) => t.type === "debit"));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })).slice(0, 10);
  }, [filtered]);

  const balanceTrend = useMemo(() => {
    let bal = 0;
    return filtered.map((t) => {
      if (t.type === "credit") bal += Number(t.amount || 0);
      if (t.type === "debit") bal -= Number(t.amount || 0);
      return { date: t.date, label: cleanDateLabel(t.date), balance: bal };
    }).slice(-20);
  }, [filtered]);

  function typeColor(type) {
    if (type === "credit") return "#10b981";
    if (type === "debit") return "#f43f5e";
    return "#f59e0b";
  }

  function typeBadge(type) {
    const colors = {
      credit: "bg-emerald-100 text-emerald-700",
      debit:  "bg-rose-100 text-rose-700",
      cash:   "bg-amber-100 text-amber-700",
    };
    return colors[type] || "bg-slate-100 text-slate-600";
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>

      <div className="max-w-6xl mx-auto px-4 py-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Analytics</p>
            <h1 className="text-2xl font-black text-slate-900" style={{ letterSpacing: "-0.03em" }}>Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">Filter, analyse and export your transactions</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setOpenExportOptions((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm active:scale-95">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Options
            </button>

            <button
              onClick={() => exportSpendWisePDF({
                username, totals, transactions: filtered,
                highlighted: Array.from(selectedTxns),
                dailyRef, categoryRef, balanceRef, includeGraphs,
              })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* ── Export Options ─────────────────────────────────────────── */}
        {openExportOptions && (
          <div className="mb-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-[fadeIn_0.15s_ease]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Export Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: "Include Graphs in PDF", desc: "Charts are embedded as images", checked: includeGraphs, onChange: setIncludeGraphs, disabled: false },
                { label: "Show Graph Value Tables", desc: "Append raw data tables", checked: includeGraphValues, onChange: setIncludeGraphValues, disabled: !includeGraphs },
              ].map(({ label, desc, checked, onChange, disabled }) => (
                <label key={label} className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"} ${checked && !disabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked && !disabled ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300"}`}>
                    {checked && !disabled && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter Bar ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Filters</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={fieldClass}>
                <option value="all">All Types</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={fieldClass}>
                {categoryList.map((c) => (
                  <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1.5">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={fieldClass}>
                <option value="entry">Entry Order</option>
                <option value="date_desc">Newest First</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>
            </div>
          </div>

          {/* Reset filters */}
          {(typeFilter !== "all" || categoryFilter !== "all" || fromDate || toDate) && (
            <button onClick={() => { setTypeFilter("all"); setCategoryFilter("all"); setFromDate(""); setToDate(""); }}
              className="mt-3 text-xs text-rose-500 font-semibold hover:underline">
              × Clear all filters
            </button>
          )}
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {[
            { label: "Total Credit", value: totals.credit, accent: "#10b981", bg: "#f0fdf4", border: "#bbf7d0" },
            { label: "Total Debit",  value: totals.debit,  accent: "#f43f5e", bg: "#fff1f2", border: "#fecdd3" },
            { label: "Net Balance",  value: totals.balance, accent: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          ].map(({ label, value, accent, bg, border }) => (
            <div key={label} className="rounded-2xl p-5 border shadow-sm" style={{ background: bg, borderColor: border }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>{label}</p>
              <p className="text-2xl font-black" style={{ color: accent, letterSpacing: "-0.04em" }}>
                {formatINR(value)}
              </p>
              <p className="text-xs mt-1" style={{ color: `${accent}99` }}>
                {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>

        {/* ── Charts ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {[
            {
              title: "Daily Spend", ref: dailyRef,
              chart: (
                <BarChart data={dailyData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[6,6,0,0]} />
                </BarChart>
              ),
            },
            {
              title: "By Category", ref: categoryRef,
              chart: (
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={85}
                    labelLine label={({ name, value }) => `${name} (${value})`} style={{ fontSize: 9 }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              ),
            },
            {
              title: "Balance Trend", ref: balanceRef,
              chart: (
                <LineChart data={balanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} dot={false} />
                </LineChart>
              ),
            },
          ].map(({ title, ref, chart }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{title}</p>
              <div ref={ref} className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* ── Transactions Table ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Transactions</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{filtered.length} records</p>
            </div>
            <button onClick={load}
              className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold hover:text-emerald-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 px-5 py-10 text-slate-400">
              <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <span className="text-sm">Loading transactions…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm font-semibold text-slate-500">No transactions match your filters</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting or clearing the filters above</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    {["Type","Category","Description","Amount","Actions","★"].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((t, i) => {
                    const prev = filtered[i - 1];
                    const newDay = !prev || prev.date !== t.date;
                    const isHighlighted = selectedTxns.has(t.id);

                    return (
                      <>
                        {newDay && (
                          <tr key={`date-${t.date}`} className="bg-slate-100 border-t-2 border-slate-200">
                            <td colSpan="6" className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                <span className="text-sm font-bold text-slate-700">{t.date}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr key={t.id}
                          className={`hover:bg-slate-50/80 transition-colors ${isHighlighted ? "bg-amber-50/60" : ""}`}>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">{/* Date shown in header */}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase ${typeBadge(t.type)}`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">{t.category || "Other"}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium max-w-[200px] truncate">
                            {isHighlighted && <span className="text-amber-500 mr-1">⭐</span>}
                            {t.description}
                          </td>
                          <td className="py-3 px-4 font-bold whitespace-nowrap" style={{ color: typeColor(t.type) }}>
                            {formatINR(t.amount)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1.5">
                              <button onClick={() => setEditing({ ...t })}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold text-xs transition-colors">
                                Edit
                              </button>
                              <button onClick={() => setDeleteTxn(t)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-semibold text-xs transition-colors">
                                Del
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                const copy = new Set(selectedTxns);
                                copy.has(t.id) ? copy.delete(t.id) : copy.add(t.id);
                                setSelectedTxns(copy);
                              }}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${isHighlighted ? "bg-amber-400 border-amber-400" : "bg-white border-slate-300 hover:border-amber-400"}`}>
                              {isHighlighted && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Modal ──────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTxn}
        title="Delete Transaction"
        message={`Delete "${deleteTxn?.description}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onCancel={() => setDeleteTxn(null)}
        onConfirm={async () => {
          if (!deleteTxn) return;
          try {
            await deleteDoc(doc(db, "users", username, "transactions", deleteTxn.id));
            showToast("Transaction deleted", "success");
            setDeleteTxn(null);
            load();
          } catch (err) {
            console.error(err);
            showToast("Failed to delete", "error");
          }
        }}
      />

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-[slideUp_0.2s_ease]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900" style={{ letterSpacing: "-0.02em" }}>Edit Transaction</h2>
              <p className="text-xs text-slate-400 mt-0.5">Update the transaction details below</p>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                  <input type="date" value={editing.date}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                    className={editFieldClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                  <select value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    className={editFieldClass}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                <input type="number" value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                  className={editFieldClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                <input value={editing.category || ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className={editFieldClass} placeholder="Category" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                <input value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className={editFieldClass} placeholder="Description" />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 cursor-pointer">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${editing.highlighted ? "bg-amber-400 border-amber-400" : "bg-white border-amber-300"}`}>
                  {editing.highlighted && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <input type="checkbox" checked={editing.highlighted || false}
                  onChange={(e) => setEditing({ ...editing, highlighted: e.target.checked })}
                  className="sr-only" />
                <span className="text-sm font-semibold text-amber-800">⭐ Mark as important</span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "users", username, "transactions", editing.id), {
                      date: editing.date,
                      description: editing.description.toUpperCase(),
                      amount: Number(editing.amount),
                      type: editing.type,
                      category: editing.category,
                      highlighted: editing.highlighted || false,
                    });
                    showToast("Transaction updated", "success");
                    setEditing(null);
                    load();
                  } catch (err) {
                    console.error(err);
                    showToast("Failed to update", "error");
                  }
                }}
                className="px-5 py-2 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  );
}
