import { useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { parseTransaction } from "../utils/parseTransaction";

const EXAMPLES = [
  "petrol 150",
  "lunch 80",
  "salary 25000",
  "cash in 500",
  "rent 8000",
  "netflix 199",
  "breakfast 60 yesterday",
  "fruits 120",
];

function typeStyle(type, dir) {
  if (type === "credit")            return { color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0", badge: "bg-emerald-100 text-emerald-700", label: "Credit"   };
  if (type === "debit")             return { color: "#f43f5e", bg: "#fff1f2", border: "#fecdd3", badge: "bg-rose-100 text-rose-700",     label: "Debit"    };
  if (type === "cash" && dir === "in")  return { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", badge: "bg-teal-100 text-teal-700",   label: "Cash In"  };
  return                                       { color: "#d97706", bg: "#fffbeb", border: "#fde68a", badge: "bg-amber-100 text-amber-700", label: "Cash Out" };
}

export default function QuickAdd({ username, onSaved }) {
  const [open,       setOpen]       = useState(false);
  const [input,      setInput]      = useState("");
  const [parsed,     setParsed]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [savedMsg,   setSavedMsg]   = useState(false);
  const [undoData,   setUndoData]   = useState(null);   // { id, description, amount }
  const undoTimerRef = useRef(null);
  const inputRef     = useRef(null);

  // ── open sheet ────────────────────────────────────────────────────────
  function openSheet() {
    setOpen(true);
    setSavedMsg(false);
    setTimeout(() => inputRef.current?.focus(), 150);
  }

  function closeSheet() {
    setOpen(false);
    setInput("");
    setParsed(null);
    setSavedMsg(false);
  }

  // ── parse on every keystroke ──────────────────────────────────────────
  function handleInput(val) {
    setInput(val);
    setParsed(val.trim().length > 2 ? parseTransaction(val) : null);
  }

  function fillExample(ex) {
    handleInput(ex);
    inputRef.current?.focus();
  }

  // ── save ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!parsed || saving) return;
    setSaving(true);
    try {
      const payload = {
        date:        parsed.date,
        type:        parsed.type,
        amount:      parsed.amount,
        category:    parsed.category,
        description: parsed.description,
        highlighted: false,
        createdAt:   serverTimestamp(),
      };
      if (parsed.type === "cash") payload.cashDirection = parsed.cashDirection || "out";

      const ref = await addDoc(
        collection(db, "users", username, "transactions"),
        payload
      );

      // undo state — 6 second window
      const undoId = ref.id;
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoData({ id: undoId, description: parsed.description, amount: parsed.amount });
      undoTimerRef.current = setTimeout(() => setUndoData(null), 6000);

      setSavedMsg(true);
      setInput("");
      setParsed(null);
      onSaved?.();

      // auto-close after 1.2s
      setTimeout(() => closeSheet(), 1200);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  // ── undo ──────────────────────────────────────────────────────────────
  async function handleUndo() {
    if (!undoData) return;
    try {
      await deleteDoc(doc(db, "users", username, "transactions", undoData.id));
      clearTimeout(undoTimerRef.current);
      setUndoData(null);
      onSaved?.();
    } catch (err) {
      console.error(err);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter"  && parsed && !saving) handleSave();
    if (e.key === "Escape") closeSheet();
  }

  const ts = parsed ? typeStyle(parsed.type, parsed.cashDirection) : null;

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn   { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* ── FLOATING BUTTON ──────────────────────────────────────────── */}
      <button
        onClick={openSheet}
        aria-label="Quick add transaction"
        className="fixed z-40 bottom-24 right-4 md:bottom-8 md:right-6 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          background:  "linear-gradient(135deg,#10b981,#059669)",
          boxShadow:   "0 8px 32px rgba(16,185,129,0.45)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* ── UNDO TOAST (shows after save, outside sheet) ──────────────── */}
      {undoData && !open && (
        <div
          className="fixed z-50 bottom-44 md:bottom-28 left-3 right-3 md:left-auto md:right-6 md:w-80"
          style={{ animation: "slideUp 0.25s ease" }}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-xs font-black">✓</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{undoData.description}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                ₹ {Number(undoData.amount).toLocaleString("en-IN")} saved
              </p>
            </div>
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex-shrink-0"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ fontFamily: "'DM Sans', sans-serif" }}>

          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            style={{ animation: "fadeIn 0.2s ease" }}
            onClick={closeSheet}
          />

          {/* sheet */}
          <div
            className="relative w-full md:max-w-md mx-0 md:mx-4"
            style={{ animation: "slideUp 0.25s ease" }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl border-t md:border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">

              {/* drag handle */}
              <div className="md:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>

              <div className="px-5 pt-4 pb-6 space-y-4">

                {/* header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.02em" }}>
                      Quick Add
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Type naturally — e.g. "petrol 150"</p>
                  </div>
                  <button
                    onClick={closeSheet}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* input */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="petrol 150 · lunch 80 · salary 25000…"
                    autoComplete="off"
                    style={{ fontSize: 16 }}  /* prevent iOS zoom */
                    className="w-full px-4 py-3.5 pr-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700"
                  />
                  {input && (
                    <button
                      onClick={() => { setInput(""); setParsed(null); inputRef.current?.focus(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-300 transition-all"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* parsed preview card */}
                {parsed && (
                  <div
                    className="p-4 rounded-xl border-2 space-y-2"
                    style={{ borderColor: ts.color, background: ts.bg, animation: "fadeIn 0.15s ease" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ts.badge}`}>
                          {ts.label}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{parsed.category}</span>
                      </div>
                      {parsed.confidence === "low" && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          guessed · check category
                        </span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{parsed.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{parsed.date}</p>
                      </div>
                      <p className="text-2xl font-black" style={{ color: ts.color, letterSpacing: "-0.04em" }}>
                        ₹ {Number(parsed.amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                )}

                {/* example chips — shown only when nothing parsed yet */}
                {!parsed && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Try these</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => fillExample(ex)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-all active:scale-95"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* save button */}
                <button
                  onClick={handleSave}
                  disabled={!parsed || saving || savedMsg}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: savedMsg
                      ? "linear-gradient(135deg,#10b981,#059669)"
                      : parsed
                        ? `linear-gradient(135deg,${ts.color},${ts.color}cc)`
                        : "#94a3b8",
                    boxShadow: parsed && !savedMsg ? `0 4px 20px ${ts.color}55` : "none",
                  }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Saving…
                    </span>
                  ) : savedMsg ? (
                    <span className="flex items-center justify-center gap-2" style={{ animation: "popIn 0.3s ease" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Saved!
                    </span>
                  ) : parsed ? (
                    `Save ${ts.label} · ₹ ${Number(parsed.amount).toLocaleString("en-IN")}`
                  ) : (
                    "Type something above"
                  )}
                </button>

                <p className="text-center text-[10px] text-slate-400">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[10px]">Enter</kbd> to save quickly
                </p>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
