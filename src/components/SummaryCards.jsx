export default function SummaryCards({ totals }) {
  const Card = ({ label, value, valueClass = "" }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-800">
      <p className="text-slate-500 dark:text-slate-400 text-sm">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${valueClass}`}>
        ₹ {value.toFixed(0)}
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="Total Credit" value={totals.credit} valueClass="text-emerald-500" />
      <Card label="Total Debit" value={totals.debit} valueClass="text-rose-500" />
      <Card label="Total Cash" value={totals.cash} valueClass="text-yellow-500" />
      <Card label="Balance" value={totals.balance} valueClass="text-slate-900 dark:text-slate-100" />
    </div>
  );
}
