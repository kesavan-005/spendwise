export default function ConfirmModal({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {title}
        </h2>

        <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          {message}
        </p>

        <div className="mt-5 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={
              "px-4 py-2 rounded-xl font-extrabold " +
              (danger
                ? "bg-rose-500 hover:bg-rose-600 text-black shadow-[0_0_20px_rgba(244,63,94,0.45)]"
                : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.45)]")
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
