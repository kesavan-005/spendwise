import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection, deleteDoc, doc, getDocs,
  orderBy, query, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

import TransactionTable from "../components/TransactionTable";
import Charts from "../components/Charts";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";
import { calcTotals, groupByCategory, groupByDate } from "../utils/calculations";

const fieldClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none transition-all duration-150 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700";

// ── Full rupee format — no K/L shorthand ─────────────────────────────────
function fmtFull(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN")}`;
}

// ── Animated counter ─────────────────────────────────────────────────────
function useAnimatedValue(target, duration = 800) {
  const [display, setDisplay] = useState(0);
  const raf  = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    const t0    = performance.now();
    if (raf.current) cancelAnimationFrame(raf.current);
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = target;
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return display;
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, border, darkBg, darkBorder, icon }) {
  const animated = useAnimatedValue(Math.round(value));
  return (
    <div className={`rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${darkBg} ${darkBorder}`}
      style={{ background: bg, borderColor: border }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          {icon}
        </div>
      </div>
      <p className="text-lg md:text-xl font-black leading-tight" style={{ color, letterSpacing: "-0.03em" }}>
        {fmtFull(animated)}
      </p>
    </div>
  );
}

// ── Activity dots ────────────────────────────────────────────────────────
function ActivityDots({ txns }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const dayTxns = txns.filter((t) => t.date === dateStr);
    return {
      dateStr,
      label:     d.toLocaleDateString("en-IN", { weekday: "short" }),
      hasDebit:  dayTxns.some((t) => t.type === "debit"),
      hasCredit: dayTxns.some((t) => t.type === "credit"),
      count:     dayTxns.length,
    };
  }), [txns]);

  return (
    <div className="flex items-end gap-1.5 md:gap-2">
      {days.map(({ dateStr, label, hasDebit, hasCredit, count }) => (
        <div key={dateStr} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[9px] font-semibold text-slate-400">{count > 0 ? count : ""}</span>
          <div className="w-full rounded-md" style={{
            height: 28,
            background: hasDebit && hasCredit
              ? "linear-gradient(135deg,#bbf7d0 50%,#fecdd3 50%)"
              : hasDebit   ? "#fecdd3"
              : hasCredit  ? "#bbf7d0"
              : "#f1f5f9",
            border: (hasDebit || hasCredit) ? "none" : "1.5px dashed #e2e8f0",
          }} />
          <span className="text-[9px] font-semibold text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

// ── Icons ─────────────────────────────────────────────────────────────────
const IcoUp      = (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const IcoDown    = (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
const IcoCash    = (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>;
const IcoBal     = (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcoRefresh = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>;
const IcoArrow   = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

// ─────────────────────────────────────────────────────────────────────────
export default function Dashboard({ username }) {
  const [txns,       setTxns]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState("month");
  const [editing,    setEditing]    = useState(null);
  const [deleteTxn,  setDeleteTxn]  = useState(null);
  const [categories, setCategories] = useState([]);
  const { toast, showToast, clearToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const q = query(collection(db, "users", username, "transactions"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch { showToast("Failed to load", "error"); }
    setLoading(false);
  }

  async function loadCategories() {
    try {
      const snap = await getDocs(collection(db, "users", username, "categories"));
      const list = snap.docs.map((d) => d.data()?.name || "").filter(Boolean).sort();
      setCategories(list.length ? list : ["Food","Petrol","Shopping","Other"]);
    } catch {
      setCategories(["Food","Petrol","Shopping","Other"]);
    }
  }

  useEffect(() => { load(); loadCategories(); }, []); // eslint-disable-line

  const filteredTxns = useMemo(() => {
    if (period === "all") return txns;
    const now    = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return txns.filter((t) => t.date?.startsWith(prefix));
  }, [txns, period]);

  const totals      = useMemo(() => calcTotals(filteredTxns), [filteredTxns]);
  const topCategory = useMemo(() => {
    const m = groupByCategory(filteredTxns.filter((t) => t.type === "debit"));
    const e = Object.entries(m).sort((a, b) => b[1] - a[1]);
    return e[0] ? { name: e[0][0], amount: e[0][1] } : null;
  }, [filteredTxns]);

  const todaySpend = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredTxns.filter((t) => t.date === today && t.type === "debit")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
  }, [filteredTxns]);

  const dailyData    = useMemo(() => { const m = groupByDate(filteredTxns.filter((t) => t.type === "debit")); return Object.keys(m).sort().slice(-10).map((date) => ({ date, amount: m[date] })); }, [filteredTxns]);
  const categoryData = useMemo(() => { const m = groupByCategory(filteredTxns.filter((t) => t.type === "debit")); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value})); }, [filteredTxns]);
  const balanceData  = useMemo(() => { const sorted=[...filteredTxns].sort((a,b)=>(a.date>b.date?1:-1)); let bal=0; return sorted.map((t)=>{ if(t.type==="credit")bal+=t.amount; if(t.type==="debit")bal-=t.amount; return{date:t.date,balance:bal}; }).slice(-20); }, [filteredTxns]);

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const isEmpty   = !loading && txns.length === 0;
  const balPos    = totals.balance >= 0;

  async function confirmDeleteTxn() {
    if (!deleteTxn) return;
    try { await deleteDoc(doc(db,"users",username,"transactions",deleteTxn.id)); showToast("Deleted","success"); setDeleteTxn(null); load(); }
    catch { showToast("Failed to delete","error"); }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.description?.trim()) return showToast("Description required","error");
    if (!editing.amount || Number(editing.amount) <= 0) return showToast("Amount invalid","error");
    try {
      await updateDoc(doc(db,"users",username,"transactions",editing.id), {
        date: editing.date, description: editing.description.trim().toUpperCase(),
        amount: Number(editing.amount), type: editing.type, category: editing.category,
      });
      showToast("Updated","success"); setEditing(null); load();
    } catch { showToast("Failed to update","error"); }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-slate-950">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-5 md:py-7" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
              {greeting} · {dateLabel}
            </p>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.03em" }}>
              {username}'s Dashboard
            </h1>
          </div>
          <button onClick={load}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all">
            {IcoRefresh}<span className="hidden sm:inline ml-1">Refresh</span>
          </button>
        </div>

        {/* EMPTY STATE */}
        {isEmpty && (
          <div className="animate-[fadeUp_0.4s_ease] bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-10 md:p-16 text-center">
            <div className="text-5xl mb-4">💸</div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1" style={{ letterSpacing: "-0.02em" }}>No transactions yet</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">Start tracking your expenses to see insights, charts and reports here</p>
            <Link to="/add"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold active:scale-95"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Add your first transaction
            </Link>
          </div>
        )}

        {!isEmpty && (<>

          {/* QUICK STATS STRIP */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5">
            {[
              { label: "Today's Spend", value: `₹ ${todaySpend.toLocaleString("en-IN")}`, color: "#f43f5e", bg: "#fff1f2", border: "#fecdd3", dk: "dark:bg-rose-950/40 dark:border-rose-900" },
              { label: "Transactions",  value: filteredTxns.length,                        color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", dk: "dark:bg-blue-950/40 dark:border-blue-900" },
              { label: "Top Category",  value: topCategory?.name || "—",                   color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", dk: "dark:bg-amber-950/40 dark:border-amber-900" },
            ].map(({ label, value, color, bg, border, dk }) => (
              <div key={label} className={`rounded-2xl px-3 py-3 border shadow-sm text-center ${dk}`} style={{ background: bg, borderColor: border }}>
                <p className="text-[9px] md:text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: `${color}99` }}>{label}</p>
                <p className="text-sm md:text-base font-black truncate" style={{ color, letterSpacing: "-0.02em" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* PERIOD TOGGLE */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Overview</p>
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm gap-1">
              {[{ id:"month", label:"This Month" },{ id:"all", label:"All Time" }].map(({ id, label }) => (
                <button key={id} onClick={() => setPeriod(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{ background: period===id ? "#0f172a" : "transparent", color: period===id ? "white" : "#64748b" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* SUMMARY CARDS */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <StatCard label="Total Credit" value={totals.credit}  color="#10b981" bg="#f0fdf4" border="#bbf7d0" darkBg="dark:bg-emerald-950/40" darkBorder="dark:border-emerald-900" icon={IcoUp("#10b981")} />
              <StatCard label="Total Debit"  value={totals.debit}   color="#f43f5e" bg="#fff1f2" border="#fecdd3" darkBg="dark:bg-rose-950/40"    darkBorder="dark:border-rose-900"    icon={IcoDown("#f43f5e")} />
              <StatCard label="Cash"         value={totals.cash}    color="#f59e0b" bg="#fffbeb" border="#fde68a" darkBg="dark:bg-amber-950/40"   darkBorder="dark:border-amber-900"   icon={IcoCash("#f59e0b")} />
              <StatCard label="Net Balance"  value={totals.balance}
                color={balPos?"#3b82f6":"#f43f5e"} bg={balPos?"#eff6ff":"#fff1f2"} border={balPos?"#bfdbfe":"#fecdd3"}
                darkBg={balPos?"dark:bg-blue-950/40":"dark:bg-rose-950/40"} darkBorder={balPos?"dark:border-blue-900":"dark:border-rose-900"}
                icon={IcoBal(balPos?"#3b82f6":"#f43f5e")} />
            </div>
          )}

          {/* TOP CATEGORY INSIGHT */}
          {topCategory && !loading && (
            <div className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-base">🔥</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Most spent on <span className="font-bold text-slate-800 dark:text-slate-200">{topCategory.name}</span>
                {" — "}<span className="text-rose-500 font-bold">₹ {topCategory.amount.toLocaleString("en-IN")}</span>
                {" this "}{period === "month" ? "month" : "time"}
              </p>
            </div>
          )}

          {/* ACTIVITY DOTS */}
          <div className="mb-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last 7 Days</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Credit</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-200 inline-block" />Debit</span>
              </div>
            </div>
            <ActivityDots txns={txns} />
          </div>

          {/* CHARTS */}
          <div className="mb-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-5">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Analytics</p>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-52" />)}</div>
            ) : (
              <Charts dailyData={dailyData} categoryData={categoryData} balanceData={balanceData} variant="ui" />
            )}
          </div>

          {/* RECENT TRANSACTIONS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recent Transactions</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">Last {Math.min(filteredTxns.length,12)} entries</p>
              </div>
              <Link to="/reports"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95">
                View all {IcoArrow}
              </Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-16" />)}</div>
            ) : (
              <TransactionTable transactions={filteredTxns.slice(0,12)} onEdit={(t)=>setEditing({...t})} onDelete={(t)=>setDeleteTxn(t)} />
            )}
          </div>

        </>)}
      </div>

      {/* DELETE MODAL */}
      <ConfirmModal open={!!deleteTxn} title="Delete Transaction" message={`Delete "${deleteTxn?.description}"?`}
        confirmText="Delete" cancelText="Cancel" danger onCancel={()=>setDeleteTxn(null)} onConfirm={confirmDeleteTxn} />

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-[fadeIn_0.15s_ease]">
          <div className="w-full md:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl border-t md:border border-slate-200 dark:border-slate-700 shadow-2xl animate-[slideUp_0.22s_ease] max-h-[92vh] overflow-y-auto"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="md:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" /></div>
            <div className="px-5 md:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100" style={{ letterSpacing:"-0.02em" }}>Edit Transaction</h2>
              <p className="text-xs text-slate-400 mt-0.5">Update the details below</p>
            </div>
            <div className="px-5 md:px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                  <input type="date" value={editing.date} onChange={(e)=>setEditing({...editing,date:e.target.value})} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Type</label>
                  <select value={editing.type} onChange={(e)=>setEditing({...editing,type:e.target.value})} className={fieldClass}>
                    <option value="debit">Debit</option><option value="credit">Credit</option><option value="cash">Cash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                <input type="number" value={editing.amount} onChange={(e)=>setEditing({...editing,amount:e.target.value})} className={fieldClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Category</label>
                <select value={editing.category||"Other"} onChange={(e)=>setEditing({...editing,category:e.target.value})} className={fieldClass}>
                  {categories.map((c)=><option key={c}>{c}</option>)}
                  {!categories.includes("Other") && <option>Other</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <input value={editing.description} onChange={(e)=>setEditing({...editing,description:e.target.value})} className={fieldClass} placeholder="Description" />
              </div>
            </div>
            <div className="px-5 md:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button onClick={()=>setEditing(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95">
                Cancel
              </button>
              <button onClick={handleSaveEdit}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold active:scale-95"
                style={{ background:"linear-gradient(135deg,#10b981,#059669)", boxShadow:"0 4px 14px rgba(16,185,129,0.3)" }}>
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
