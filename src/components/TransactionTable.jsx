function typeStyle(type, cashDirection) {
  if (type === "credit") return { text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700", label: "Credit" };
  if (type === "debit")  return { text: "text-rose-600",    badge: "bg-rose-100 text-rose-700",       label: "Debit"  };
  // cash — direction aware
  if (cashDirection === "in") return { text: "text-teal-600",  badge: "bg-teal-100 text-teal-700",   label: "Cash In"  };
  return                             { text: "text-amber-600", badge: "bg-amber-100 text-amber-700", label: "Cash Out" };
}

function AmountSign({ type, cashDirection }) {
  if (type === "credit" || cashDirection === "in") return <span className="text-emerald-500 mr-0.5">+</span>;
  return <span className="text-rose-400 mr-0.5">−</span>;
}

export default function TransactionTable({ transactions, onEdit, onDelete }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
        <div className="text-3xl mb-2">💸</div>
        <p className="text-sm font-semibold text-slate-500">No transactions yet</p>
        <p className="text-xs text-slate-400 mt-1">Add your first transaction to get started</p>
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP TABLE ─────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-left">
              {["Date","Description","Category","Type","Amount",""].map((h) => (
                <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {transactions.map((t) => {
              const s = typeStyle(t.type, t.cashDirection);
              return (
                <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">{t.date}</td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold max-w-[200px]">
                    <span className="truncate block">
                      {t.highlighted && <span className="text-amber-400 mr-1">⭐</span>}
                      {t.description}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">{t.category || "Other"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.badge}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className={`py-3 px-4 font-bold whitespace-nowrap ${s.text}`}>
                    <AmountSign type={t.type} cashDirection={t.cashDirection} />
                    ₹ {Number(t.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(t)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-semibold text-xs transition-colors">
                        Edit
                      </button>
                      <button onClick={() => onDelete(t)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-semibold text-xs transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARDS ──────────────────────────────────────────── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {transactions.map((t) => {
          const s = typeStyle(t.type, t.cashDirection);
          return (
            <div key={t.id} className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.badge}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{t.category || "Other"}</span>
                    {t.highlighted && <span className="text-amber-400 text-xs">⭐</span>}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.date}</p>
                </div>
                <div className={`text-base font-black whitespace-nowrap flex-shrink-0 ${s.text}`}>
                  <AmountSign type={t.type} cashDirection={t.cashDirection} />
                  ₹ {Number(t.amount).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onEdit(t)}
                  className="flex-1 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors active:scale-95">
                  ✏️ Edit
                </button>
                <button onClick={() => onDelete(t)}
                  className="flex-1 py-1.5 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors active:scale-95">
                  🗑 Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}