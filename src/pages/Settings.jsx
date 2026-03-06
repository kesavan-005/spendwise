import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDocs,
  orderBy, query, serverTimestamp,
  updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";
import { calcTotals } from "../utils/calculations";

const fieldClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700";

const DEFAULT_CATEGORIES = [
  "Income (Credited)", "Rental Home Expenses", "Family Home Expenses",
  "Subscriptions", "Breakfast", "Lunch", "Dinner", "Fruits",
  "Bike Service", "Petrol", "Laundry / Ironing",
  "Studies / Exam Prep", "Personal Care", "Other",
];

// ── Section card wrapper ──────────────────────────────────────────────────
function Section({ title, subtitle, icon, children, accent }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden ${
      accent === "danger"
        ? "border-rose-200 dark:border-rose-800"
        : "border-slate-200 dark:border-slate-700"
    }`}>
      <div className={`px-5 py-4 border-b flex items-center gap-3 ${
        accent === "danger"
          ? "border-rose-100 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/10"
          : "border-slate-100 dark:border-slate-800"
      }`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
          accent === "danger" ? "bg-rose-100 dark:bg-rose-900/30" : "bg-slate-100 dark:bg-slate-800"
        }`}>
          {icon}
        </div>
        <div>
          <h2 className={`text-sm font-bold ${accent === "danger" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}
            style={{ letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Settings({ username }) {
  const { toast, showToast, clearToast } = useToast();

  const [categories,         setCategories]         = useState([]);
  const [loadingCats,        setLoadingCats]        = useState(true);
  const [newCategory,        setNewCategory]        = useState("");
  const [addingCat,          setAddingCat]          = useState(false);
  const [loadingDefaults,    setLoadingDefaults]    = useState(false);

  // rename — inline in list
  const [renameId,           setRenameId]           = useState(null);
  const [renameValue,        setRenameValue]        = useState("");
  const [savingRename,       setSavingRename]       = useState(false);
  const renameInputRef = useRef(null);

  // delete category
  const [deleteCatTarget,    setDeleteCatTarget]    = useState(null);
  const [deletingCat,        setDeletingCat]        = useState(false);

  // delete all
  const [deleteAllOpen,      setDeleteAllOpen]      = useState(false);
  const [deleteAllConfirm,   setDeleteAllConfirm]   = useState("");
  const [deletingAll,        setDeletingAll]        = useState(false);

  // stats
  const [txnCount,           setTxnCount]           = useState(null);
  const [totals,             setTotals]             = useState(null);
  const [joinedDate,         setJoinedDate]         = useState(null);
  const [loadingStats,       setLoadingStats]       = useState(true);

  const categoriesRef = useMemo(() => collection(db, "users", username, "categories"), [username]);
  const txnsRef       = useMemo(() => collection(db, "users", username, "transactions"), [username]);

  // ── cat transaction counts ─────────────────────────────────────────────
  const [catCounts, setCatCounts] = useState({});

  async function loadCategories() {
    setLoadingCats(true);
    try {
      const snap = await getDocs(categoriesRef);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((x) => x?.name?.trim())
        .sort((a, b) => a.name.localeCompare(b.name));
      setCategories(data);
    } catch { showToast("Failed to load categories", "error"); }
    setLoadingCats(false);
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const q = query(txnsRef, orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const txns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTxnCount(txns.length);
      setTotals(calcTotals(txns));

      // earliest transaction date as proxy for join date
      if (txns.length > 0 && txns[0].date) {
        setJoinedDate(txns[0].date);
      }

      // count per category
      const counts = {};
      txns.forEach((t) => {
        const cat = t.category || "Other";
        counts[cat] = (counts[cat] || 0) + 1;
      });
      setCatCounts(counts);
    } catch { /* silent */ }
    setLoadingStats(false);
  }

  useEffect(() => { loadCategories(); loadStats(); }, []); // eslint-disable-line

  // focus rename input when it opens
  useEffect(() => {
    if (renameId && renameInputRef.current) renameInputRef.current.focus();
  }, [renameId]);

  // ── Add category ──────────────────────────────────────────────────────
  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return showToast("Enter category name", "error");
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return showToast("Category already exists", "error");
    setAddingCat(true);
    try {
      await addDoc(categoriesRef, { name, createdAt: serverTimestamp() });
      setNewCategory("");
      showToast("Category added", "success");
      loadCategories();
    } catch { showToast("Failed to add category", "error"); }
    setAddingCat(false);
  }

  // ── Load defaults ─────────────────────────────────────────────────────
  async function loadDefaultCategories() {
    setLoadingDefaults(true);
    try {
      const snap = await getDocs(categoriesRef);
      const existing = snap.docs.map((d) => (d.data()?.name || "").toLowerCase().trim());
      const batch = writeBatch(db);
      let added = 0;
      for (const cat of DEFAULT_CATEGORIES) {
        if (existing.includes(cat.toLowerCase().trim())) continue;
        batch.set(doc(categoriesRef), { name: cat, createdAt: serverTimestamp() });
        added++;
      }
      if (added === 0) { showToast("All defaults already loaded", "info"); }
      else { await batch.commit(); showToast(`Added ${added} default categories`, "success"); }
      loadCategories();
    } catch { showToast("Failed to load defaults", "error"); }
    setLoadingDefaults(false);
  }

  // ── Save rename ────────────────────────────────────────────────────────
  async function saveRename(cat) {
    const newName = renameValue.trim();
    if (!newName) return showToast("Name cannot be empty", "error");
    if (newName === cat.name) { setRenameId(null); return; }
    if (categories.some((c) => c.name.toLowerCase() === newName.toLowerCase() && c.id !== cat.id))
      return showToast("Name already exists", "error");
    setSavingRename(true);
    try {
      await updateDoc(doc(categoriesRef, cat.id), { name: newName });
      const q = query(txnsRef, where("category", "==", cat.name));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { category: newName }));
      await batch.commit();
      showToast(`Renamed to "${newName}"`, "success");
      setRenameId(null);
      loadCategories(); loadStats();
    } catch { showToast("Failed to rename", "error"); }
    setSavingRename(false);
  }

  // ── Delete category ───────────────────────────────────────────────────
  async function confirmDeleteCategory() {
    if (!deleteCatTarget) return;
    setDeletingCat(true);
    try {
      const q = query(txnsRef, where("category", "==", deleteCatTarget.name));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { category: "Other" }));
      batch.delete(doc(categoriesRef, deleteCatTarget.id));
      await batch.commit();
      showToast("Category deleted — transactions moved to Other", "success");
      setDeleteCatTarget(null);
      loadCategories(); loadStats();
    } catch { showToast("Failed to delete category", "error"); }
    setDeletingCat(false);
  }

  // ── Delete all transactions ───────────────────────────────────────────
  async function deleteAllTransactions() {
    setDeletingAll(true);
    try {
      const snap = await getDocs(txnsRef);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      showToast("All transactions deleted", "success");
      setDeleteAllOpen(false);
      setDeleteAllConfirm("");
      loadStats();
    } catch { showToast("Failed to delete transactions", "error"); }
    setDeletingAll(false);
  }

  // ── CSV Export ────────────────────────────────────────────────────────
  async function exportCSV() {
    try {
      const q = query(txnsRef, orderBy("date", "asc"), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const txns = snap.docs.map((d) => d.data());

      const header = ["Date", "Type", "Cash Direction", "Category", "Description", "Amount", "Highlighted"];
      const rows = txns.map((t) => [
        t.date || "",
        t.type || "",
        t.type === "cash" ? (t.cashDirection || "out") : "",
        t.category || "Other",
        `"${(t.description || "").replace(/"/g, '""')}"`,
        t.amount || 0,
        t.highlighted ? "Yes" : "No",
      ]);

      const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `spendwise_${username}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("CSV exported!", "success");
    } catch { showToast("Failed to export CSV", "error"); }
  }

  const deleteAllReady = deleteAllConfirm.trim().toLowerCase() === "delete";

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-slate-950 transition-colors">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>

      <div className="max-w-3xl mx-auto px-4 py-5 md:py-7" style={{ fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Preferences</p>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.03em" }}>
            Settings
          </h1>
        </div>

        <div className="space-y-4">

          {/* ── PROFILE CARD ──────────────────────────────────────────── */}
          <Section
            title="Account"
            subtitle="Your profile and usage overview"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            }>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900 flex-shrink-0">
                <span className="text-white font-black text-xl">{username.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.02em" }}>{username}</p>
                <p className="text-xs text-slate-400 font-medium">
                  {joinedDate ? `First transaction: ${joinedDate}` : "No transactions yet"}
                </p>
              </div>
            </div>

            {loadingStats ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Transactions", value: txnCount ?? 0, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
                  { label: "Net Balance",  value: totals ? `₹ ${Number(totals.balance).toLocaleString("en-IN")}` : "₹ 0",
                    color: totals?.balance >= 0 ? "#10b981" : "#f43f5e",
                    bg: totals?.balance >= 0 ? "#f0fdf4" : "#fff1f2",
                    border: totals?.balance >= 0 ? "#bbf7d0" : "#fecdd3" },
                  { label: "Categories",  value: categories.length, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className="rounded-xl p-3 border text-center" style={{ background: bg, borderColor: border }}>
                    <p className="text-lg md:text-xl font-black" style={{ color, letterSpacing: "-0.03em" }}>{value}</p>
                    <p className="text-[10px] md:text-xs font-semibold mt-0.5" style={{ color: `${color}99` }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── CATEGORIES ────────────────────────────────────────────── */}
          <Section
            title="Manage Categories"
            subtitle={`${categories.length} categories · used across all transactions`}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            }>

            {/* Add new + load defaults */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="flex gap-2 flex-1">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="New category name…"
                  className={fieldClass}
                />
                <button onClick={addCategory} disabled={addingCat}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50">
                  {addingCat ? "…" : "Add"}
                </button>
              </div>
              <button onClick={loadDefaultCategories} disabled={loadingDefaults}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {loadingDefaults ? "Loading…" : "Load Defaults"}
              </button>
            </div>

            {/* Category list */}
            {loadingCats ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl h-12" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm font-semibold text-slate-500">No categories yet</p>
                <p className="text-xs text-slate-400 mt-1">Add one above or load defaults</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map((cat) => {
                  const count = catCounts[cat.name] || 0;
                  const isRenaming = renameId === cat.id;

                  return (
                    <div key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Category name / rename input */}
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename(cat);
                              if (e.key === "Escape") setRenameId(null);
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border-2 border-emerald-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{cat.name}</p>
                            {count > 0 && (
                              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                {count} txn{count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        {isRenaming ? (
                          <>
                            <button onClick={() => saveRename(cat)} disabled={savingRename}
                              className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50">
                              {savingRename ? "…" : "Save"}
                            </button>
                            <button onClick={() => setRenameId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setRenameId(cat.id); setRenameValue(cat.name); }}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-all active:scale-95">
                              Rename
                            </button>
                            <button onClick={() => setDeleteCatTarget(cat)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-95">
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* ── DATA EXPORT ───────────────────────────────────────────── */}
          <Section
            title="Export Data"
            subtitle="Download your transactions as a CSV file"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            }>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Export as CSV</p>
                <p className="text-xs text-slate-400 mt-0.5">All transactions with date, type, cash direction, category, description and amount</p>
              </div>
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)", boxShadow: "0 4px 14px rgba(59,130,246,0.3)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download CSV
              </button>
            </div>
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-[11px] text-slate-400 font-medium">
                📊 Tip: Open in Excel or Google Sheets for further analysis. Columns: Date, Type, Cash Direction, Category, Description, Amount, Highlighted.
              </p>
            </div>
          </Section>

          {/* ── DANGER ZONE ───────────────────────────────────────────── */}
          <Section
            title="Danger Zone"
            subtitle="Irreversible actions — proceed with caution"
            accent="danger"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            }>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Delete ALL Transactions</p>
                <p className="text-xs text-slate-400 mb-3">
                  This permanently deletes every transaction. Categories are kept. This action <span className="font-bold text-rose-500">cannot be undone</span>.
                </p>

                {/* Type-to-confirm input */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                    Type <span className="font-bold text-rose-500 font-mono">delete</span> to enable the button
                  </p>
                  <input
                    value={deleteAllConfirm}
                    onChange={(e) => setDeleteAllConfirm(e.target.value)}
                    placeholder="Type delete to confirm…"
                    className={fieldClass}
                  />
                </div>

                <button
                  onClick={() => deleteAllReady && setDeleteAllOpen(true)}
                  disabled={!deleteAllReady || deletingAll}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: deleteAllReady ? "linear-gradient(135deg,#f43f5e,#e11d48)" : "#cbd5e1",
                    boxShadow:  deleteAllReady ? "0 4px 14px rgba(244,63,94,0.3)" : "none",
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                  Delete All Transactions
                </button>
              </div>
            </div>
          </Section>

          {/* ── APP INFO ──────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow shadow-emerald-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 11l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.02em" }}>SpendWise</p>
                  <p className="text-[10px] text-slate-400 font-medium">Personal Finance Tracker · Firebase + React</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Connected</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── DELETE CATEGORY MODAL ─────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteCatTarget}
        title="Delete Category"
        message={deleteCatTarget ? `Delete "${deleteCatTarget.name}"? ${catCounts[deleteCatTarget.name] || 0} transaction(s) will move to "Other".` : ""}
        confirmText={deletingCat ? "Deleting…" : "Delete"}
        cancelText="Cancel" danger
        onCancel={() => setDeleteCatTarget(null)}
        onConfirm={confirmDeleteCategory}
      />

      {/* ── DELETE ALL MODAL ──────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteAllOpen}
        title="Delete ALL Transactions"
        message={`This will permanently delete all ${txnCount ?? ""} transactions. This cannot be undone.`}
        confirmText={deletingAll ? "Deleting…" : "Delete All"}
        cancelText="Cancel" danger
        onCancel={() => setDeleteAllOpen(false)}
        onConfirm={deleteAllTransactions}
      />

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}