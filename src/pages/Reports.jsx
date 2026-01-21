import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "../firebase/firebase";
import Charts from "../components/Charts";
import { exportSpendWisePDF } from "../utils/exportPDF";
import { calcTotals, groupByCategory, groupByDate } from "../utils/calculations";

export default function Reports({ username }) {
  const [txns, setTxns] = useState([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");

  async function load() {
    const q = query(
      collection(db, "users", username, "transactions"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(txns.map((t) => t.category))).filter(Boolean);
  }, [txns]);

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (type !== "all" && t.type !== type) return false;
      if (category !== "all" && t.category !== category) return false;
      return true;
    });
  }, [txns, from, to, type, category]);

  const totals = useMemo(() => calcTotals(filtered), [filtered]);

  // Charts data
  const dailyData = useMemo(() => {
    const m = groupByDate(filtered.filter((t) => t.type === "debit"));
    return Object.keys(m)
      .sort()
      .slice(-10)
      .map((date) => ({ date, amount: m[date] }));
  }, [filtered]);

  const categoryData = useMemo(() => {
    const m = groupByCategory(filtered.filter((t) => t.type === "debit"));
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const balanceData = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => (a.date > b.date ? 1 : -1));
    let bal = 0;
    const arr = [];
    for (const t of sorted) {
      if (t.type === "credit") bal += t.amount;
      if (t.type === "debit") bal -= t.amount;
      arr.push({ date: t.date, balance: bal });
    }
    return arr.slice(-20);
  }, [filtered]);

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Export PDF with totals + graphs + transactions
          </p>
        </div>

        <button
          onClick={() =>
            exportSpendWisePDF({
              username,
              totals,
              transactions: filtered,
              chartElementId: "report-pdf-charts",
            })
          }
          className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-extrabold text-sm"
        >
          Export PDF
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 grid md:grid-cols-4 gap-3">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
        />

        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
        >
          <option value="all">All Types</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
          <option value="cash">Cash</option>
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Totals */}
      <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow p-5">
        <p className="font-extrabold text-lg">Totals</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-slate-500">Total Credit</p>
            <p className="text-lg font-extrabold text-emerald-500">
              ₹ {totals.credit.toFixed(0)}
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-slate-500">Total Debit</p>
            <p className="text-lg font-extrabold text-rose-500">
              ₹ {totals.debit.toFixed(0)}
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-slate-500">Total Cash</p>
            <p className="text-lg font-extrabold text-yellow-500">
              ₹ {totals.cash.toFixed(0)}
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-slate-500">Balance</p>
            <p className="text-lg font-extrabold">
              ₹ {totals.balance.toFixed(0)}
            </p>
          </div>
        </div>

        <p className="text-slate-500 text-sm mt-4">
          Rows: <span className="font-bold">{filtered.length}</span>
        </p>
      </div>

      {/* ✅ UI Charts */}
      <div className="mt-4">
        <Charts dailyData={dailyData} categoryData={categoryData} balanceData={balanceData} variant="ui" />
      </div>

      {/* ✅ PDF ONLY charts (hidden, clean) */}
      <div className="absolute left-[-99999px] top-0">
        <div id="report-pdf-charts" className="bg-white p-4 w-[900px]">
          <Charts dailyData={dailyData} categoryData={categoryData} balanceData={balanceData} variant="pdf" />
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-extrabold text-lg">
          Transactions
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.length === 0 && (
            <div className="p-4 text-slate-500">No transactions found.</div>
          )}

          {filtered.map((t) => (
            <div key={t.id} className="p-4 flex justify-between gap-3">
              <div>
                <p className="font-bold">{t.description}</p>
                <p className="text-xs text-slate-500">
                  {t.date} • {t.category} • {t.type.toUpperCase()}
                </p>
              </div>

              <div
                className={
                  "font-extrabold " +
                  (t.type === "credit"
                    ? "text-emerald-500"
                    : t.type === "debit"
                    ? "text-rose-500"
                    : "text-yellow-500")
                }
              >
                ₹ {t.amount}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-500 mt-4">
        Tip: Apply filters and then export PDF for clean report ✅
      </div>
    </div>
  );
}
