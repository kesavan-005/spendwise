export default function TransactionTable({ transactions, onEdit, onDelete }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow border border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">
          Recent Transactions
        </h3>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {transactions.length === 0 && (
          <div className="p-4 text-slate-500 dark:text-slate-400">
            No transactions yet.
          </div>
        )}

        {transactions.map((t) => (
          <div
            key={t.id}
            className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
          >
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {t.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.date} • {t.category} • {t.type}
              </p>
            </div>

            <div className="flex items-center gap-3">
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

              <button
                onClick={() => onEdit(t)}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold"
              >
                Edit
              </button>

              <button
                onClick={() => onDelete(t)}
                className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-black font-extrabold text-sm"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
