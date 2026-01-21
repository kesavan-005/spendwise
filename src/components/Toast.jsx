export default function Toast({ message, type = "success", onClose }) {
  if (!message) return null;

  const style =
    type === "success"
      ? "bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.55)]"
      : type === "error"
      ? "bg-rose-500 text-black shadow-[0_0_30px_rgba(244,63,94,0.55)]"
      : "bg-slate-900 text-white shadow-[0_0_30px_rgba(15,23,42,0.55)]";

  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div
        className={`min-w-[280px] max-w-[380px] px-5 py-3 rounded-2xl font-bold ${style}`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">{message}</span>

          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-black/20 hover:bg-black/30"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
