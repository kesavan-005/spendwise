import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, getDocs,
  limit, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { calcTotals } from "../utils/calculations";
import { parseTransaction } from "../utils/parseTransaction";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

const fieldClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700";

const CATEGORY_SUGGESTIONS = {
  "Income (Credited)":    "AMOUNT CREDITED TO ACCOUNT",
  "Rental Home Expenses": "RENTAL HOME NEEDS",
  "Family Home Expenses": "FAMILY EXPENSES",
  Subscriptions:          "SUBSCRIPTION PAYMENT",
  Breakfast:              "BREAKFAST",
  Lunch:                  "LUNCH",
  Dinner:                 "DINNER",
  Fruits:                 "FRUITS",
  "Bike Service":         "BIKE SERVICE",
  Petrol:                 "PETROL",
  "Laundry / Ironing":    "LAUNDRY / IRONING",
  "Studies / Exam Prep":  "STUDY MATERIAL / COURSE",
  "Personal Care":        "PERSONAL CARE",
  Other:                  "",
};

const TYPE_CONFIG = {
  debit:  { label: "Debit",  sub: "Expense", color: "#f43f5e", bg: "#fff1f2", ring: "rgba(244,63,94,0.2)"  },
  credit: { label: "Credit", sub: "Income",  color: "#10b981", bg: "#f0fdf4", ring: "rgba(16,185,129,0.2)" },
  cash:   { label: "Cash",   sub: "In/Out",  color: "#f59e0b", bg: "#fffbeb", ring: "rgba(245,158,11,0.2)" },
};

function txnBadge(type, dir) {
  if (type === "credit")            return "bg-emerald-100 text-emerald-700";
  if (type === "debit")             return "bg-rose-100 text-rose-700";
  return dir === "in" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700";
}
function txnLabel(type, dir) {
  if (type === "credit") return "Credit";
  if (type === "debit")  return "Debit";
  return dir === "in" ? "Cash In" : "Cash Out";
}
function txnAmtColor(type, dir) {
  return (type === "credit" || dir === "in") ? "#10b981" : "#f43f5e";
}

export default function AddTransaction({ username }) {
  const today = new Date().toISOString().slice(0, 10);
  const { toast, showToast, clearToast } = useToast();

  // smart input
  const [smartInput,  setSmartInput]  = useState("");
  const [smartParsed, setSmartParsed] = useState(null);
  const smartRef = useRef(null);

  // form
  const [date,          setDate]          = useState(today);
  const [type,          setType]          = useState("debit");
  const [cashDirection, setCashDirection] = useState("out");
  const [amount,        setAmount]        = useState("");
  const [description,   setDescription]  = useState("");
  const [isAutoDesc,    setIsAutoDesc]    = useState(false);
  const [highlighted,   setHighlighted]  = useState(false);
  const [category,      setCategory]     = useState("Other");

  // data
  const [categories,    setCategories]   = useState([]);
  const [loadingCats,   setLoadingCats]  = useState(true);
  const [allTxns,       setAllTxns]      = useState([]);
  const [loadingTotals, setLoadingTotals]= useState(true);
  const [saving,        setSaving]       = useState(false);
  const [saveSuccess,   setSaveSuccess]  = useState(false);

  // rapid-submit duplicate guard
  const lastSaveRef  = useRef(null);
  const [dupWarn,    setDupWarn]    = useState(false);

  const txnsRef       = useMemo(() => collection(db, "users", username, "transactions"), [username]);
  const categoriesRef = useMemo(() => collection(db, "users", username, "categories"),  [username]);

  // ── auto description on type change ──────────────────────────────────
  useEffect(() => {
    if (type === "credit" && (!description.trim() || isAutoDesc)) {
      setDescription("AMOUNT CREDITED TO ACCOUNT");
      setIsAutoDesc(true);
    } else if (type !== "credit" && isAutoDesc) {
      setDescription("");
      setIsAutoDesc(false);
    }
  }, [type]); // eslint-disable-line

  async function loadCategories() {
    setLoadingCats(true);
    try {
      const snap = await getDocs(categoriesRef);
      const list = snap.docs
        .map((d) => ({ id: d.id, name: d.data()?.name || "" }))
        .filter((c) => c.name?.trim())
        .sort((a, b) => a.name.localeCompare(b.name));
      setCategories(list);
      if (!list.map((x) => x.name).includes(category)) setCategory("Other");
    } catch {
      showToast("Failed to load categories", "error");
    }
    setLoadingCats(false);
  }

  async function loadTotals() {
    setLoadingTotals(true);
    try {
      const q = query(txnsRef, orderBy("createdAt", "desc"), limit(500));
      const snap = await getDocs(q);
      setAllTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      showToast("Failed to load totals", "error");
    }
    setLoadingTotals(false);
  }

  useEffect(() => { loadCategories(); loadTotals(); }, []); // eslint-disable-line

  const totals = useMemo(() => calcTotals(allTxns), [allTxns]);

  const balanceAfter = useMemo(() => {
    const a = Number(amount || 0);
    let bal = totals.balance;
    if (type === "credit")           bal += a;
    else if (type === "debit")       bal -= a;
    else if (cashDirection === "in") bal += a;
    else                             bal -= a;
    return bal;
  }, [amount, type, cashDirection, totals.balance]);

  const tc = type === "cash"
    ? cashDirection === "in"
      ? { label: "Cash In",  color: "#059669", ring: "rgba(5,150,105,0.2)"  }
      : { label: "Cash Out", color: "#d97706", ring: "rgba(217,119,6,0.2)"  }
    : TYPE_CONFIG[type];

  // ── smart input ───────────────────────────────────────────────────────
  function handleSmartInput(val) {
    setSmartInput(val);
    setSmartParsed(val.trim().length > 2 ? parseTransaction(val) : null);
  }

  function applyParsed(p) {
    if (!p) return;
    setType(p.type);
    if (p.type === "cash") setCashDirection(p.cashDirection || "out");
    setAmount(String(p.amount));
    setDescription(p.description);
    setIsAutoDesc(false);
    setDate(p.date);
    if (p.category && p.category !== "Other") setCategory(p.category);
    setSmartInput("");
    setSmartParsed(null);
  }

  // ── save ──────────────────────────────────────────────────────────────
  async function save(e) {
    e?.preventDefault();
    if (!amount || Number(amount) <= 0) return showToast("Enter a valid amount", "error");
    if (!description.trim())            return showToast("Enter a description",   "error");

    // rapid-submit guard — warn if same form submitted within 4 seconds
    const now = Date.now();
    if (lastSaveRef.current && now - lastSaveRef.current < 4000) {
      if (!dupWarn) { setDupWarn(true); showToast("Tap Save again to confirm duplicate", "info"); return; }
      setDupWarn(false);
    } else {
      setDupWarn(false);
    }

    setSaving(true);
    try {
      const payload = {
        date, type,
        amount:      Number(amount),
        category:    category || "Other",
        description: description.trim().toUpperCase(),
        highlighted,
        createdAt:   serverTimestamp(),
      };
      if (type === "cash") payload.cashDirection = cashDirection;
      await addDoc(txnsRef, payload);

      lastSaveRef.current = Date.now();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      showToast("Transaction saved!", "success");

      // reset
      setDate(today); setType("debit"); setCashDirection("out");
      setAmount(""); setCategory("Other"); setDescription("");
      setIsAutoDesc(false); setHighlighted(false);
      loadTotals();
    } catch {
      showToast("Failed to save — check connection", "error");
    }
    setSaving(false);
  }

  const recentTxns = allTxns.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-slate-950 transition-colors">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn  { 0%{transform:scale(0.85);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-5 md:py-7" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Finance</p>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.03em" }}>
              Add Transaction
            </h2>
          </div>
          <button type="button" onClick={() => { loadCategories(); loadTotals(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm active:scale-95 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* ── SMART INPUT BAR ───────────────────────────────────────── */}
        <div className="mb-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Smart Input — type naturally
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div className="relative">
              {/* search icon */}
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <input
                ref={smartRef}
                value={smartInput}
                onChange={(e) => handleSmartInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && smartParsed && applyParsed(smartParsed)}
                placeholder='e.g.  "petrol 150"  ·  "lunch 80 yesterday"  ·  "salary 25000"'
                style={{ fontSize: 15 }}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700"
              />
              {smartInput && (
                <button onClick={() => { setSmartInput(""); setSmartParsed(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-300 transition-all">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            {/* parsed preview + fill button */}
            {smartParsed && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border animate-[fadeIn_0.15s_ease]"
                style={{
                  borderColor: smartParsed.type === "credit" ? "#bbf7d0" : smartParsed.type === "debit" ? "#fecdd3" : "#fde68a",
                  background:  smartParsed.type === "credit" ? "#f0fdf4" : smartParsed.type === "debit" ? "#fff1f2" : "#fffbeb",
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${txnBadge(smartParsed.type, smartParsed.cashDirection)}`}>
                      {txnLabel(smartParsed.type, smartParsed.cashDirection)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{smartParsed.category}</span>
                    <span className="text-[10px] text-slate-400">{smartParsed.date}</span>
                    {smartParsed.confidence === "low" && (
                      <span className="text-[10px] text-amber-600 font-semibold">· guessed</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{smartParsed.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className="text-base font-black" style={{ color: txnAmtColor(smartParsed.type, smartParsed.cashDirection) }}>
                    ₹ {Number(smartParsed.amount).toLocaleString("en-IN")}
                  </p>
                  <button
                    onClick={() => applyParsed(smartParsed)}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95"
                    style={{ background: "#10b981" }}>
                    Fill Form →
                  </button>
                </div>
              </div>
            )}

            {/* example chips */}
            {!smartInput && (
              <div className="flex flex-wrap gap-1.5">
                {["petrol 150","lunch 80","salary 25000","cash in 500","rent 8000","netflix 199"].map((ex) => (
                  <button key={ex} onClick={() => handleSmartInput(ex)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── FORM ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <form onSubmit={save} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

              {/* type selector */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const active = type === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => { setType(key); if (key !== "cash") setCashDirection("out"); }}
                        className="flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all active:scale-95"
                        style={{
                          borderColor: active ? cfg.color : "#e2e8f0",
                          background:  active ? cfg.bg    : "transparent",
                          color:       active ? cfg.color : "#64748b",
                          boxShadow:   active ? `0 0 0 3px ${cfg.ring}` : "none",
                        }}>
                        <span className="font-bold text-sm">{cfg.label}</span>
                        <span className="text-[10px] mt-0.5 opacity-70">{cfg.sub}</span>
                      </button>
                    );
                  })}
                </div>

                {/* cash direction */}
                {type === "cash" && (
                  <div className="mt-3 animate-[fadeIn_0.2s_ease]">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Direction</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { dir: "out", label: "Cash Out", sub: "Money spent",    color: "#d97706", bg: "#fffbeb" },
                        { dir: "in",  label: "Cash In",  sub: "Money received", color: "#059669", bg: "#ecfdf5" },
                      ].map(({ dir, label, sub, color, bg }) => {
                        const active = cashDirection === dir;
                        return (
                          <button key={dir} type="button" onClick={() => setCashDirection(dir)}
                            className="flex flex-col items-center py-2.5 px-3 rounded-xl border-2 transition-all active:scale-95"
                            style={{
                              borderColor: active ? color : "#e2e8f0",
                              background:  active ? bg    : "transparent",
                              color:       active ? color : "#64748b",
                            }}>
                            <span className="font-bold text-sm">{label}</span>
                            <span className="text-[10px] mt-0.5 opacity-70">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* fields */}
              <div className="p-5 space-y-4">

                {/* date + amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Amount (₹)</label>
                    <input
                      type="number" inputMode="decimal" min="0"
                      value={amount}
                      onChange={(e) => { if (Number(e.target.value) >= 0) setAmount(e.target.value); }}
                      placeholder="0"
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                  {loadingCats ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                      <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <select value={category}
                      onChange={(e) => {
                        const sel = e.target.value;
                        setCategory(sel);
                        const sug = CATEGORY_SUGGESTIONS[sel] || "";
                        if (type !== "credit" && (!description.trim() || isAutoDesc) && sug) {
                          setDescription(sug); setIsAutoDesc(true);
                        }
                      }}
                      className={fieldClass}>
                      <option value="Other">Other</option>
                      {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                </div>

                {/* description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Description</label>
                    <span className="text-[10px] text-slate-400">{description.length}/80</span>
                  </div>
                  <input
                    value={description}
                    onChange={(e) => { setDescription(e.target.value.slice(0, 80)); setIsAutoDesc(false); }}
                    placeholder="Enter description…"
                    className={fieldClass}
                  />
                  {description.trim() && description !== description.toUpperCase() && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Saved as: <span className="font-bold text-slate-600 dark:text-slate-300">{description.trim().toUpperCase()}</span>
                    </p>
                  )}
                </div>

                {/* highlight */}
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${highlighted ? "bg-amber-400 border-amber-400" : "bg-white dark:bg-slate-800 border-amber-300"}`}>
                    {highlighted && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} className="sr-only" />
                  <div>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">⭐ Mark as important</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">Highlighted in Reports and PDF</p>
                  </div>
                </label>

                {/* save button */}
                <button type="submit" disabled={saving || saveSuccess}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-70"
                  style={{
                    background: saveSuccess
                      ? "linear-gradient(135deg,#10b981,#059669)"
                      : `linear-gradient(135deg,${tc.color},${tc.color}cc)`,
                    boxShadow: `0 4px 20px ${tc.ring}`,
                  }}>
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Saving…
                    </span>
                  ) : saveSuccess ? (
                    <span className="flex items-center justify-center gap-2 animate-[popIn_0.3s_ease]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Saved!
                    </span>
                  ) : (
                    `Save ${tc.label} Transaction`
                  )}
                </button>

                <div style={{ height: "env(safe-area-inset-bottom)" }} />
              </div>
            </form>
          </div>

          {/* ── SIDEBAR ──────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-3">

            {/* balance preview */}
            {amount && Number(amount) > 0 && (
              <div className="rounded-2xl p-4 text-center border animate-[fadeIn_0.2s_ease]"
                style={{
                  background:  balanceAfter >= 0 ? "#f0fdf4" : "#fff1f2",
                  borderColor: balanceAfter >= 0 ? "#bbf7d0" : "#fecdd3",
                }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: balanceAfter >= 0 ? "#16a34a" : "#e11d48" }}>
                  Balance After
                </p>
                <p className="text-2xl font-black" style={{ color: balanceAfter >= 0 ? "#16a34a" : "#e11d48", letterSpacing: "-0.04em" }}>
                  ₹ {balanceAfter.toLocaleString("en-IN")}
                </p>
              </div>
            )}

            {/* live summary */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Live Summary</p>
                <button type="button" onClick={loadTotals} className="text-xs text-emerald-600 font-semibold hover:underline">Refresh</button>
              </div>
              {loadingTotals ? (
                <div className="flex items-center gap-2 text-slate-400 py-2">
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[
                    { label: "Credit",   value: totals.credit,  color: "#10b981" },
                    { label: "Debit",    value: totals.debit,   color: "#f43f5e" },
                    { label: "Cash In",  value: totals.cashIn,  color: "#059669" },
                    { label: "Cash Out", value: totals.cashOut, color: "#d97706" },
                    { label: "Net Cash", value: totals.netCash, color: totals.netCash >= 0 ? "#f59e0b" : "#f43f5e" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>
                      <span className="text-xs font-bold" style={{ color }}>₹ {Number(value || 0).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-slate-100 dark:border-slate-700">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-bold">Balance</span>
                    <span className="text-sm font-black" style={{ color: totals.balance >= 0 ? "#3b82f6" : "#f43f5e", letterSpacing: "-0.02em" }}>
                      ₹ {Number(totals.balance || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-right">{allTxns.length} transactions total</p>
                </div>
              )}
            </div>

            {/* recently added */}
            {recentTxns.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recently Added</p>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {recentTxns.map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${txnBadge(t.type, t.cashDirection)}`}>
                            {txnLabel(t.type, t.cashDirection)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{t.description}</p>
                        <p className="text-[10px] text-slate-400">{t.date}</p>
                      </div>
                      <p className="text-xs font-black flex-shrink-0" style={{ color: txnAmtColor(t.type, t.cashDirection) }}>
                        ₹ {Number(t.amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}
