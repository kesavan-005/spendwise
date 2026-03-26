import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { calcTotals, groupByCategory, groupByDate } from "../utils/calculations";
import { exportSpendWisePDF } from "../utils/exportPDF";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

// ── helpers ───────────────────────────────────────────────────────────────
const fmtINR   = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
const fmtShort = (n) => {
  const v = Math.abs(Number(n || 0));
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};
const cleanLabel   = (d) => { try { const [,m,day] = d.split("-"); return `${day}/${m}`; } catch { return d; } };
const friendlyDate = (d) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); }
  catch { return d; }
};

const PIE_COLORS = ["#f43f5e","#3b82f6","#f59e0b","#a855f7","#0ea5e9","#10b981","#64748b","#ec4899","#14b8a6","#f97316"];

const fieldCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const editCls  = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:bg-white";

function txnTypeLabel(t) {
  if (t.type === "credit") return "Credit";
  if (t.type === "debit")  return "Debit";
  return t.cashDirection === "in" ? "Cash In" : "Cash Out";
}
function txnBadgeCls(t) {
  if (t.type === "credit")              return "bg-emerald-100 text-emerald-700";
  if (t.type === "debit")               return "bg-rose-100 text-rose-700";
  return t.cashDirection === "in" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700";
}
function txnAmtColor(t) {
  return (t.type === "credit" || t.cashDirection === "in") ? "#10b981" : "#f43f5e";
}
function txnSign(t) {
  return (t.type === "credit" || t.cashDirection === "in") ? "+" : "−";
}

// monthly quick-select
function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    opts.push({ label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), from: `${y}-${m}-01`, to: `${y}-${m}-${last}` });
  }
  return opts;
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, bg, border, icon }) {
  return (
    <div className="rounded-2xl p-4 border shadow-sm" style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</p>
        <span className="text-base leading-none">{icon}</span>
      </div>
      <p className="text-lg font-black leading-none" style={{ color, letterSpacing: "-0.03em" }}>{fmtINR(value)}</p>
      {sub && <p className="text-[10px] mt-1.5 font-medium leading-relaxed" style={{ color: `${color}99` }}>{sub}</p>}
    </div>
  );
}

// ── Cash Flow bar ─────────────────────────────────────────────────────────
function FlowBar({ credit, debit, cashIn, cashOut }) {
  const totalIn  = credit + cashIn;
  const totalOut = debit  + cashOut;
  const total    = totalIn + totalOut || 1;
  const inPct    = (totalIn  / total) * 100;
  const outPct   = (totalOut / total) * 100;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Cash Flow Overview</p>
      <div className="flex rounded-xl overflow-hidden h-4 mb-4 gap-0.5">
        <div style={{ width: `${inPct}%`,  background: "linear-gradient(90deg,#10b981,#059669)" }} className="transition-all duration-700 min-w-0" />
        <div style={{ width: `${outPct}%`, background: "linear-gradient(90deg,#f43f5e,#e11d48)" }} className="transition-all duration-700 min-w-0" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Money In ({inPct.toFixed(0)}%)</span>
          </div>
          <p className="text-base font-black text-emerald-600" style={{ letterSpacing: "-0.02em" }}>{fmtINR(totalIn)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Credit {fmtShort(credit)} + Cash In {fmtShort(cashIn)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Money Out ({outPct.toFixed(0)}%)</span>
          </div>
          <p className="text-base font-black text-rose-600" style={{ letterSpacing: "-0.02em" }}>{fmtINR(totalOut)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Debit {fmtShort(debit)} + Cash Out {fmtShort(cashOut)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Category breakdown with bars ──────────────────────────────────────────
function CategoryBreakdown({ txns }) {
  const data = useMemo(() => {
    const map = {};
    for (const t of txns) {
      if (t.type !== "debit" && !(t.type === "cash" && t.cashDirection !== "in")) continue;
      const cat = t.category || "Other";
      map[cat] = (map[cat] || 0) + Number(t.amount || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [txns]);

  const total = data.reduce((s, [, v]) => s + v, 0) || 1;

  if (!data.length) return (
    <div className="text-center py-6 text-slate-300 text-sm">No expense data</div>
  );

  return (
    <div className="space-y-3">
      {data.map(([cat, amt], i) => {
        const pct = Math.round((amt / total) * 100);
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cat}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{pct}%</span>
                <span className="text-xs font-bold text-rose-600">{fmtINR(amt)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Reports({ username }) {
  const [txns,      setTxns]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null);
  const [deleteTxn, setDeleteTxn] = useState(null);
  const [editCats,  setEditCats]  = useState([]);
  const { toast, showToast, clearToast } = useToast();

  // filters
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [catFilter,    setCatFilter]    = useState("all");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState("date_desc");
  const [activeMonth,  setActiveMonth]  = useState(null);

  // ui
  const [showExport,   setShowExport]   = useState(false);
  const [includeGraphs,setIncludeGraphs]= useState(true);
  const [selectedTxns, setSelectedTxns] = useState(new Set());
  const [activeTab,    setActiveTab]    = useState("overview");

  const dailyRef    = useRef(null);
  const categoryRef = useRef(null);
  const balanceRef  = useRef(null);

  const txnsRef  = useMemo(() => collection(db, "users", username, "transactions"), [username]);
  const catsRef  = useMemo(() => collection(db, "users", username, "categories"),   [username]);
  const monthOpts = useMemo(() => getMonthOptions(), []);

  async function load() {
    setLoading(true);
    try {
      const q = query(txnsRef, orderBy("date", "asc"), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch { showToast("Failed to load", "error"); }
    setLoading(false);
  }

  async function loadCats() {
    try {
      const snap = await getDocs(catsRef);
      const list = snap.docs.map((d) => d.data()?.name || "").filter(Boolean).sort();
      setEditCats(list.length ? list : ["Other"]);
    } catch { setEditCats(["Other"]); }
  }

  useEffect(() => { load(); loadCats(); }, []); // eslint-disable-line

  // ── derived data ──────────────────────────────────────────────────────
  const categoryList = useMemo(() => {
    const s = new Set(txns.map((t) => t.category || "Other"));
    return ["all", ...Array.from(s).sort()];
  }, [txns]);

  const filtered = useMemo(() => {
    let list = [...txns];
    if (typeFilter === "cash_in")       list = list.filter((t) => t.type === "cash" && t.cashDirection === "in");
    else if (typeFilter === "cash_out") list = list.filter((t) => t.type === "cash" && t.cashDirection !== "in");
    else if (typeFilter !== "all")      list = list.filter((t) => t.type === typeFilter);
    if (catFilter !== "all")            list = list.filter((t) => (t.category || "Other") === catFilter);
    if (fromDate)                       list = list.filter((t) => t.date >= fromDate);
    if (toDate)                         list = list.filter((t) => t.date <= toDate);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        (t.description || "").toLowerCase().includes(q) ||
        (t.category    || "").toLowerCase().includes(q) ||
        String(t.amount).includes(q)
      );
    }
    if (sortBy === "date_desc") list.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (sortBy === "date_asc")  list.sort((a, b) => (a.date > b.date ? 1 : -1));
    if (sortBy === "amt_desc")  list.sort((a, b) => b.amount - a.amount);
    if (sortBy === "amt_asc")   list.sort((a, b) => a.amount - b.amount);
    if (sortBy === "az")        list.sort((a, b) => (a.description||"").localeCompare(b.description||""));
    return list;
  }, [txns, typeFilter, catFilter, fromDate, toDate, search, sortBy]);

  const totals = useMemo(() => calcTotals(filtered), [filtered]);

  useEffect(() => {
    const s = new Set(); filtered.forEach((t) => { if (t.highlighted) s.add(t.id); }); setSelectedTxns(s);
  }, [filtered]);

  // chart data
  const dailyCombined = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const lbl = cleanLabel(t.date);
      if (!map[lbl]) map[lbl] = { label: lbl, income: 0, expense: 0 };
      if (t.type === "credit" || (t.type === "cash" && t.cashDirection === "in")) map[lbl].income  += Number(t.amount || 0);
      else map[lbl].expense += Number(t.amount || 0);
    });
    return Object.values(map).slice(-14);
  }, [filtered]);

  const balanceTrend = useMemo(() => {
    let bal = 0;
    return filtered.map((t) => {
      const a = Number(t.amount || 0);
      if (t.type === "credit" || (t.type === "cash" && t.cashDirection === "in")) bal += a; else bal -= a;
      return { label: cleanLabel(t.date), balance: bal };
    }).slice(-30);
  }, [filtered]);

  const catSpend = useMemo(() => {
    const m = groupByCategory(filtered.filter((t) => t.type === "debit" || (t.type === "cash" && t.cashDirection !== "in")));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })).slice(0, 8);
  }, [filtered]);

  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const t of filtered) { if (!map.has(t.date)) map.set(t.date, []); map.get(t.date).push(t); }
    return map;
  }, [filtered]);

  function applyMonth(opt) {
    if (activeMonth === opt.label) { setFromDate(""); setToDate(""); setActiveMonth(null); }
    else { setFromDate(opt.from); setToDate(opt.to); setActiveMonth(opt.label); }
  }
  useEffect(() => {
    const m = monthOpts.find((o) => o.from === fromDate && o.to === toDate);
    if (!m) setActiveMonth(null);
  }, [fromDate, toDate, monthOpts]);

  const hasFilters = typeFilter !== "all" || catFilter !== "all" || fromDate || toDate || search.trim();

  const totalIn    = totals.credit + totals.cashIn;
  const totalOut   = totals.debit  + totals.cashOut;
  const savings    = totalIn - totalOut;
  const savingsPct = totalIn > 0 ? Math.round((savings / totalIn) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-slate-950 transition-colors">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-5 md:py-7" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Analytics</p>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.03em" }}>Reports</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowExport(v => !v)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 shadow-sm active:scale-95 transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export PDF
            </button>
            <button onClick={load}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 shadow-sm active:scale-95 transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── EXPORT PANEL ────────────────────────────────────────────── */}
        {showExport && (
          <div className="mb-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-[fadeIn_0.15s_ease]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Export Settings</p>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${includeGraphs ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                {includeGraphs && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <input type="checkbox" checked={includeGraphs} onChange={(e) => setIncludeGraphs(e.target.checked)} className="sr-only" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Include charts in PDF</span>
            </label>
            <button
              onClick={() => { exportSpendWisePDF({ username, totals, transactions: filtered, highlighted: Array.from(selectedTxns), dailyRef, categoryRef, balanceRef, includeGraphs }); setShowExport(false); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
              Download PDF
            </button>
          </div>
        )}

        {/* ── FILTER BAR ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-5">
          <div className="relative mb-3">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, category or amount…"
              className={`${fieldCls} pl-9`} />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={fieldCls}>
                <option value="all">All Types</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="cash_in">Cash In</option>
                <option value="cash_out">Cash Out</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category</label>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={fieldCls}>
                {categoryList.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sort</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={fieldCls}>
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="amt_desc">Amount ↓</option>
                <option value="amt_asc">Amount ↑</option>
                <option value="az">A → Z</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Quick:</span>
            {monthOpts.slice(0, 7).map((opt) => (
              <button key={opt.label} onClick={() => applyMonth(opt)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
                style={{ background: activeMonth === opt.label ? "#0f172a" : "#f1f5f9", color: activeMonth === opt.label ? "white" : "#64748b" }}>
                {opt.label}
              </button>
            ))}
            {hasFilters && (
              <button onClick={() => { setTypeFilter("all"); setCatFilter("all"); setFromDate(""); setToDate(""); setSearch(""); setActiveMonth(null); }}
                className="ml-auto text-xs text-rose-500 font-semibold hover:underline">× Clear</button>
            )}
          </div>
        </div>

        {/* ── HERO BALANCE CARD + STAT GRID ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Net Balance hero */}
          <div className="md:col-span-1 rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: totals.balance >= 0 ? "linear-gradient(135deg,#0f172a,#1e293b)" : "linear-gradient(135deg,#7f1d1d,#991b1b)" }}>
            <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-10 bg-white" style={{ transform: "translate(35%,-35%)" }} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Net Balance</p>
            <p className="text-3xl font-black mb-1" style={{ letterSpacing: "-0.04em" }}>{fmtINR(totals.balance)}</p>
            <p className="text-[11px] text-white/50 mb-4">
              {filtered.length} txns · {fromDate ? `${fromDate} → ${toDate || "now"}` : "All time"}
            </p>
            {/* savings progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, savingsPct))}%` }} />
              </div>
              <span className="text-[11px] font-bold text-white/70 whitespace-nowrap">
                {savingsPct >= 0 ? `${savingsPct}% saved` : "overspent"}
              </span>
            </div>
          </div>

          {/* 2×2 mini stat grid */}
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <StatCard label="Total Money In"   value={totalIn}        icon="📥" color="#10b981" bg="#f0fdf4" border="#bbf7d0"
              sub={`Credit ${fmtShort(totals.credit)} + Cash In ${fmtShort(totals.cashIn)}`} />
            <StatCard label="Total Money Out"  value={totalOut}       icon="📤" color="#f43f5e" bg="#fff1f2" border="#fecdd3"
              sub={`Debit ${fmtShort(totals.debit)} + Cash Out ${fmtShort(totals.cashOut)}`} />
            <StatCard label="Net Cash in Hand" value={totals.netCash} icon="💵"
              color={totals.netCash >= 0 ? "#d97706" : "#f43f5e"}
              bg={totals.netCash >= 0 ? "#fffbeb" : "#fff1f2"}
              border={totals.netCash >= 0 ? "#fde68a" : "#fecdd3"}
              sub={`Cash In ${fmtShort(totals.cashIn)} − Cash Out ${fmtShort(totals.cashOut)}`} />
            <StatCard label="Savings"          value={savings}        icon="🏦"
              color={savings >= 0 ? "#3b82f6" : "#f43f5e"}
              bg={savings >= 0 ? "#eff6ff" : "#fff1f2"}
              border={savings >= 0 ? "#bfdbfe" : "#fecdd3"}
              sub={savings >= 0 ? `${savingsPct}% of income saved` : "Spending exceeds income"} />
          </div>
        </div>

        {/* 4-card breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Bank Credit"    value={totals.credit}  icon="💳" color="#10b981" bg="#f0fdf4" border="#bbf7d0" sub="Credited to bank account" />
          <StatCard label="Bank Debit"     value={totals.debit}   icon="🏧" color="#f43f5e" bg="#fff1f2" border="#fecdd3" sub="Debited from bank account" />
          <StatCard label="Cash Received"  value={totals.cashIn}  icon="💰" color="#059669" bg="#ecfdf5" border="#a7f3d0" sub="Physical cash received" />
          <StatCard label="Cash Spent"     value={totals.cashOut} icon="💸" color="#d97706" bg="#fffbeb" border="#fde68a" sub="Physical cash spent" />
        </div>

        {/* Flow bar */}
        <div className="mb-5">
          <FlowBar credit={totals.credit} debit={totals.debit} cashIn={totals.cashIn} cashOut={totals.cashOut} />
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-1 mb-5 shadow-sm w-fit">
          {[["overview","Overview"],["transactions","Transactions"]].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: activeTab === id ? "#0f172a" : "transparent", color: activeTab === id ? "white" : "#64748b" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-[fadeIn_0.2s_ease]">

            {/* Daily income vs expense */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Daily Income vs Expense</p>
              <div ref={dailyRef} className="h-52">
                {dailyCombined.length === 0
                  ? <div className="h-full flex items-center justify-center text-slate-300 text-sm">No data for this period</div>
                  : <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyCombined} barGap={2}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                        <Tooltip formatter={(v, name) => [fmtINR(v), name === "income" ? "Income" : "Expense"]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                        <Legend formatter={(v) => v === "income" ? "Income" : "Expense"} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="income"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={28} />
                        <Bar dataKey="expense" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Where money went */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Where Money Went</p>
                  <p className="text-xs text-slate-400 font-semibold">{fmtINR(totalOut)} total</p>
                </div>
                <div ref={categoryRef}><CategoryBreakdown txns={filtered} /></div>
              </div>

              {/* Balance trend */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Balance Trend</p>
                <div ref={balanceRef} className="h-52">
                  {balanceTrend.length === 0
                    ? <div className="h-full flex items-center justify-center text-slate-300 text-sm">No data</div>
                    : <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={balanceTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={fmtShort} />
                          <Tooltip formatter={(v) => [fmtINR(v), "Balance"]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                          <Line type="monotone" dataKey="balance" stroke={totals.balance >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                  }
                </div>
              </div>
            </div>

            {/* Category pie */}
            {catSpend.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Expense Split</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={catSpend} dataKey="value" nameKey="name" outerRadius={90} innerRadius={40}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ""}
                        labelLine={false} style={{ fontSize: 10 }}>
                        {catSpend.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSACTIONS TAB ─────────────────────────────────────────── */}
        {activeTab === "transactions" && (
          <div className="animate-[fadeIn_0.2s_ease]">

            {/* summary strip */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4 flex-wrap text-xs font-semibold">
              <span className="text-slate-500">{filtered.length} records</span>
              <span className="text-slate-200 dark:text-slate-600">|</span>
              <span className="text-emerald-600">In: {fmtINR(totalIn)}</span>
              <span className="text-rose-500">Out: {fmtINR(totalOut)}</span>
              <span className="text-amber-600">Net Cash: {fmtINR(totals.netCash)}</span>
              <span style={{ color: totals.balance >= 0 ? "#3b82f6" : "#f43f5e" }}>Balance: {fmtINR(totals.balance)}</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-3 p-10 text-slate-400">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-sm font-semibold text-slate-500">No transactions found</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing the filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(groupedByDate.entries()).map(([date, dayTxns]) => {
                  const dayIn  = dayTxns.filter((t) => t.type === "credit" || (t.type === "cash" && t.cashDirection === "in")).reduce((s, t) => s + Number(t.amount||0), 0);
                  const dayOut = dayTxns.filter((t) => t.type === "debit"  || (t.type === "cash" && t.cashDirection !== "in")).reduce((s, t) => s + Number(t.amount||0), 0);
                  const dayNet = dayIn - dayOut;

                  return (
                    <div key={date} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

                      {/* date header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-200" style={{ letterSpacing: "-0.02em" }}>
                            {friendlyDate(date)}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                            {dayTxns.length} txn{dayTxns.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold">
                          {dayIn  > 0 && <span className="text-emerald-600">+{fmtINR(dayIn)}</span>}
                          {dayOut > 0 && <span className="text-rose-500">−{fmtINR(dayOut)}</span>}
                          <span className="font-black" style={{ color: dayNet >= 0 ? "#3b82f6" : "#f43f5e" }}>
                            {dayNet >= 0 ? "+" : "−"}{fmtINR(Math.abs(dayNet))}
                          </span>
                        </div>
                      </div>

                      {/* transactions */}
                      <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {dayTxns.map((t) => {
                          const isHL = selectedTxns.has(t.id);
                          return (
                            <div key={t.id}
                              className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${isHL ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>

                              {/* type badge */}
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                                style={{ background: t.type === "credit" ? "#f0fdf4" : t.type === "debit" ? "#fff1f2" : t.cashDirection === "in" ? "#ecfdf5" : "#fffbeb", color: txnAmtColor(t) }}>
                                {t.type === "credit" ? "CR" : t.type === "debit" ? "DR" : t.cashDirection === "in" ? "CI" : "CO"}
                              </div>

                              {/* text */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${txnBadgeCls(t)}`}>
                                    {txnTypeLabel(t)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{t.category || "Other"}</span>
                                  {isHL && <span className="text-amber-400 text-[10px]">⭐</span>}
                                </div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.description}</p>
                              </div>

                              {/* amount */}
                              <p className="text-sm font-black flex-shrink-0" style={{ color: txnAmtColor(t) }}>
                                {txnSign(t)}&thinsp;{fmtINR(t.amount)}
                              </p>

                              {/* actions */}
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => setEditing({ ...t })}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button onClick={() => setDeleteTxn(t)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-500 transition-all active:scale-95">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => { const c = new Set(selectedTxns); c.has(t.id) ? c.delete(t.id) : c.add(t.id); setSelectedTxns(c); }}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isHL ? "bg-amber-400 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-amber-100 hover:text-amber-500"}`}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* day subtotal */}
                      {dayTxns.length > 1 && (
                        <div className="flex items-center justify-end gap-4 px-4 py-2 bg-slate-50/60 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700">
                          <span className="text-[10px] font-semibold text-slate-400">Day total:</span>
                          {dayIn  > 0 && <span className="text-[10px] font-bold text-emerald-600">In {fmtINR(dayIn)}</span>}
                          {dayOut > 0 && <span className="text-[10px] font-bold text-rose-500">Out {fmtINR(dayOut)}</span>}
                          <span className="text-[10px] font-black" style={{ color: dayNet >= 0 ? "#3b82f6" : "#f43f5e" }}>
                            Net {dayNet >= 0 ? "+" : "−"}{fmtINR(Math.abs(dayNet))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DELETE MODAL ──────────────────────────────────────────────── */}
      <ConfirmModal open={!!deleteTxn} title="Delete Transaction"
        message={`Delete "${deleteTxn?.description}"?`} confirmText="Delete" cancelText="Cancel" danger
        onCancel={() => setDeleteTxn(null)}
        onConfirm={async () => {
          if (!deleteTxn) return;
          try { await deleteDoc(doc(db, "users", username, "transactions", deleteTxn.id)); showToast("Deleted", "success"); setDeleteTxn(null); load(); }
          catch { showToast("Failed", "error"); }
        }} />

      {/* ── EDIT MODAL ────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
          style={{ animation: "fadeIn 0.15s ease", fontFamily: "'DM Sans', sans-serif" }}>
          <div className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl border-t md:border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            style={{ animation: "slideUp 0.2s ease" }}>
            <div className="md:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-300" /></div>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.02em" }}>Edit Transaction</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                  <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={editCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Type</label>
                  <select value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value, cashDirection: e.target.value !== "cash" ? undefined : (editing.cashDirection || "out") })}
                    className={editCls}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>
              {editing.type === "cash" && (
                <div className="grid grid-cols-2 gap-2">
                  {[{ dir:"out", label:"Cash Out", color:"#d97706", bg:"#fffbeb" },{ dir:"in", label:"Cash In", color:"#059669", bg:"#ecfdf5" }].map(({ dir, label, color, bg }) => (
                    <button key={dir} type="button" onClick={() => setEditing({ ...editing, cashDirection: dir })}
                      className="py-2.5 rounded-xl border-2 text-sm font-bold transition-all"
                      style={{ borderColor: (editing.cashDirection||"out") === dir ? color : "#e2e8f0", background: (editing.cashDirection||"out") === dir ? bg : "transparent", color: (editing.cashDirection||"out") === dir ? color : "#64748b" }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Amount (₹)</label>
                <input type="number" min="0" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className={editCls} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                <select value={editing.category || "Other"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={editCls}>
                  <option value="Other">Other</option>
                  {editCats.filter((c) => c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={editCls} />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 cursor-pointer">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${editing.highlighted ? "bg-amber-400 border-amber-400" : "bg-white border-amber-300"}`}>
                  {editing.highlighted && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <input type="checkbox" checked={editing.highlighted||false} onChange={(e) => setEditing({ ...editing, highlighted: e.target.checked })} className="sr-only" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">⭐ Mark as important</span>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const p = { date: editing.date, description: (editing.description||"").toUpperCase(), amount: Number(editing.amount), type: editing.type, category: editing.category || "Other", highlighted: editing.highlighted || false };
                    if (editing.type === "cash") p.cashDirection = editing.cashDirection || "out";
                    await updateDoc(doc(db, "users", username, "transactions", editing.id), p);
                    showToast("Updated", "success"); setEditing(null); load();
                  } catch { showToast("Failed", "error"); }
                }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}