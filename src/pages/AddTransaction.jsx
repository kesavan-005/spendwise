import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { calcTotals } from "../utils/calculations";

import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

export default function AddTransaction({ username }) {
  const today = new Date().toISOString().slice(0, 10);
  const { toast, showToast, clearToast } = useToast();

  // ----------------------
  // Form state
  // ----------------------
  const [date, setDate] = useState(today);
  const [type, setType] = useState("debit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isAutoDesc, setIsAutoDesc] = useState(false);

  // ----------------------
  // Categories
  // ----------------------
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("Other");
  const [loadingCategories, setLoadingCategories] = useState(true);

  // ----------------------
  // Live totals
  // ----------------------
  const [allTxns, setAllTxns] = useState([]);
  const [loadingTotals, setLoadingTotals] = useState(true);

  const txnsRef = useMemo(
    () => collection(db, "users", username, "transactions"),
    [username]
  );
  const categoriesRef = useMemo(
    () => collection(db, "users", username, "categories"),
    [username]
  );

  const categorySuggestions = useMemo(
    () => ({
      "Income (Credited)": "AMOUNT CREDITED TO ACCOUNT",
      "Rental Home Expenses": "RENT / HOME NEEDS",
      "Family Home Expenses": "FAMILY EXPENSES",
      Subscriptions: "SUBSCRIPTION PAYMENT",
      Breakfast: "BREAKFAST",
      Lunch: "LUNCH",
      Dinner: "DINNER",
      Fruits: "FRUITS",
      "Bike Service": "BIKE SERVICE",
      Petrol: "PETROL",
      "Laundry / Ironing": "LAUNDRY / IRONING",
      "Studies / Exam Prep": "STUDY MATERIAL / COURSE",
      "Personal Care": "PERSONAL CARE",
      Other: "",
    }),
    []
  );

  // auto desc for credit
  useEffect(() => {
    if (type === "credit") {
      if (!description.trim() || isAutoDesc) {
        setDescription("AMOUNT CREDITED TO ACCOUNT");
        setIsAutoDesc(true);
      }
    }
    // eslint-disable-next-line
  }, [type]);

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const snap = await getDocs(categoriesRef);
      const list = snap.docs
        .map((d) => ({ id: d.id, name: d.data()?.name || "" }))
        .filter((c) => c.name && c.name.trim())
        .sort((a, b) => a.name.localeCompare(b.name));

      setCategories(list);

      const names = list.map((x) => x.name);
      if (!names.includes(category)) setCategory("Other");
      if (list.length === 0) setCategory("Other");
    } catch (err) {
      console.error(err);
      showToast("Failed to load categories", "error");
      setCategories([]);
      setCategory("Other");
    }
    setLoadingCategories(false);
  }

  async function loadTotals() {
    setLoadingTotals(true);
    try {
      const q = query(txnsRef, orderBy("createdAt", "desc"), limit(500));
      const snap = await getDocs(q);
      setAllTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      showToast("Failed to load totals", "error");
      setAllTxns([]);
    }
    setLoadingTotals(false);
  }

  useEffect(() => {
    loadCategories();
    loadTotals();
    // eslint-disable-next-line
  }, []);

  const totals = useMemo(() => calcTotals(allTxns), [allTxns]);

  const preview = useMemo(() => {
    const a = Number(amount || 0);
    let balance = totals.balance;
    if (type === "credit") balance += a;
    if (type === "debit") balance -= a;
    return { balanceAfter: balance };
  }, [amount, type, totals.balance]);

  async function save(e) {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) return showToast("Enter valid amount", "error");
    if (!description.trim()) return showToast("Enter description", "error");

    try {
      await addDoc(txnsRef, {
        date,
        type,
        amount: Number(amount),
        category: category || "Other",
        description: description.trim().toUpperCase(),
        createdAt: serverTimestamp(),
      });

      showToast("Transaction saved", "success");

      setDate(today);
      setType("debit");
      setAmount("");
      setCategory("Other");
      setDescription("");
      setIsAutoDesc(false);

      loadTotals();
    } catch (err) {
      console.error(err);
      showToast("Failed to save transaction", "error");
    }
  }

  const inputClass =
    "mt-2 w-full p-3 rounded-xl outline-none border " +
    "bg-white border-slate-200 text-slate-900 " +
    "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100";

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Add Transaction
        </h2>

        <button
          type="button"
          onClick={loadCategories}
          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:opacity-90 text-sm font-bold"
        >
          Refresh Categories
        </button>
      </div>

      {/* ✅ Responsive Layout */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ✅ LEFT: Add Form */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <form
            onSubmit={save}
            className="space-y-4 bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-800 p-5"
          >
            {/* Type */}
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                <option value="debit">Debit (Expense)</option>
                <option value="credit">Credit (Income)</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Amount (₹)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Category
              </label>

              {loadingCategories ? (
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Loading categories...
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCategory(selected);

                    const suggestion = categorySuggestions[selected] || "";

                    if (type !== "credit") {
                      if (!description.trim() || isAutoDesc) {
                        if (suggestion) {
                          setDescription(suggestion);
                          setIsAutoDesc(true);
                        }
                      }
                    }
                  }}
                  className={inputClass}
                >
                  <option value="Other">Other</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsAutoDesc(false);
                }}
                placeholder="Enter description"
                className={inputClass}
              />
            </div>

            <button className="w-full p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-extrabold text-black shadow-[0_0_25px_rgba(16,185,129,0.35)]">
              Save Transaction
            </button>
          </form>
        </div>

        {/* ✅ RIGHT: Live Summary */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <div className="sticky top-20 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-800 p-4">
              <p className="font-bold text-slate-900 dark:text-slate-100">
                Live Summary
              </p>

              {loadingTotals ? (
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                  Loading...
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 dark:text-slate-400">Credit</p>
                    <p className="text-lg font-extrabold text-emerald-500">
                      ₹ {totals.credit.toFixed(0)}
                    </p>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 dark:text-slate-400">Debit</p>
                    <p className="text-lg font-extrabold text-rose-500">
                      ₹ {totals.debit.toFixed(0)}
                    </p>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 dark:text-slate-400">Cash</p>
                    <p className="text-lg font-extrabold text-yellow-500">
                      ₹ {totals.cash.toFixed(0)}
                    </p>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 dark:text-slate-400">Balance</p>
                    <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                      ₹ {totals.balance.toFixed(0)}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-slate-500 dark:text-slate-400 text-xs mt-3">
                Balance after this transaction:{" "}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ₹ {preview.balanceAfter.toFixed(0)}
                </span>
              </p>

              <button
                type="button"
                onClick={loadTotals}
                className="mt-4 w-full px-4 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold hover:opacity-90 text-sm"
              >
                Refresh Summary
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}
