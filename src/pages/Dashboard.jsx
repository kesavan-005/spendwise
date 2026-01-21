import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

import SummaryCards from "../components/SummaryCards";
import TransactionTable from "../components/TransactionTable";
import Charts from "../components/Charts";

import ConfirmModal from "../components/ConfirmModal";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

import { calcTotals, groupByCategory, groupByDate } from "../utils/calculations";

export default function Dashboard({ username }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  const { toast, showToast, clearToast } = useToast();

  // edit modal state
  const [editing, setEditing] = useState(null);

  // delete modal state
  const [deleteTxn, setDeleteTxn] = useState(null);

  async function load() {
    setLoading(true);
    const q = query(
      collection(db, "users", username, "transactions"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTxns(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const totals = useMemo(() => calcTotals(txns), [txns]);

  const dailyData = useMemo(() => {
    const m = groupByDate(txns.filter((t) => t.type === "debit"));
    return Object.keys(m)
      .sort()
      .slice(-10)
      .map((date) => ({ date, amount: m[date] }));
  }, [txns]);

  const categoryData = useMemo(() => {
    const m = groupByCategory(txns.filter((t) => t.type === "debit"));
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [txns]);

  const balanceData = useMemo(() => {
    const sorted = [...txns].sort((a, b) => (a.date > b.date ? 1 : -1));
    let bal = 0;
    const arr = [];
    for (const t of sorted) {
      if (t.type === "credit") bal += t.amount;
      if (t.type === "debit") bal -= t.amount;
      arr.push({ date: t.date, balance: bal });
    }
    return arr.slice(-20);
  }, [txns]);

  async function confirmDeleteTxn() {
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
  }

  async function handleSaveEdit() {
    if (!editing) return;

    if (!editing.description.trim()) {
      showToast("Description required", "error");
      return;
    }

    if (!editing.amount || Number(editing.amount) <= 0) {
      showToast("Amount invalid", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "users", username, "transactions", editing.id), {
        date: editing.date,
        description: editing.description.trim().toUpperCase(),
        amount: Number(editing.amount),
        type: editing.type,
        category: editing.category,
      });

      showToast("Transaction updated", "success");
      setEditing(null);
      load();
    } catch (err) {
      console.error(err);
      showToast("Failed to update", "error");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Hi {username}
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:opacity-90 text-sm font-bold"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4">
        <SummaryCards totals={totals} />
      </div>

      <div className="mt-4">
        <Charts
          dailyData={dailyData}
          categoryData={categoryData}
          balanceData={balanceData}
          variant="ui"
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-slate-500 dark:text-slate-400">
            Loading transactions...
          </div>
        ) : (
          <TransactionTable
            transactions={txns.slice(0, 12)}
            onEdit={(t) => setEditing({ ...t })}
            onDelete={(t) => setDeleteTxn(t)}
          />
        )}
      </div>

      {/* ✅ Delete Confirm Modal */}
      <ConfirmModal
        open={!!deleteTxn}
        title="Delete Transaction"
        message={`Delete "${deleteTxn?.description}" ?`}
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        onCancel={() => setDeleteTxn(null)}
        onConfirm={confirmDeleteTxn}
      />

      {/* ✅ Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Edit Transaction
            </h2>

            <div className="mt-4 space-y-3">
              <input
                type="date"
                value={editing.date}
                onChange={(e) =>
                  setEditing({ ...editing, date: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
              />

              <select
                value={editing.type}
                onChange={(e) =>
                  setEditing({ ...editing, type: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="cash">Cash</option>
              </select>

              <input
                type="number"
                value={editing.amount}
                onChange={(e) =>
                  setEditing({ ...editing, amount: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
                placeholder="Amount"
              />

              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
              >
                <option>Food</option>
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snacks</option>
                <option>Petrol</option>
                <option>Shopping</option>
                <option>College</option>
                <option>Other</option>
              </select>

              <input
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none"
                placeholder="Description"
              />
            </div>

            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.45)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}
