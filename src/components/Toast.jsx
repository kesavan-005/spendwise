import { useEffect, useState } from "react";

export default function Toast({ message, type = "success", onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!message) return null;

  const config = {
    success: {
      bg: "bg-white",
      border: "border-emerald-200",
      icon: "✓",
      iconBg: "bg-emerald-500",
      text: "text-slate-800",
    },
    error: {
      bg: "bg-white",
      border: "border-rose-200",
      icon: "✕",
      iconBg: "bg-rose-500",
      text: "text-slate-800",
    },
    info: {
      bg: "bg-white",
      border: "border-blue-200",
      icon: "i",
      iconBg: "bg-blue-500",
      text: "text-slate-800",
    },
  };

  const c = config[type] || config.info;

  return (
    <div
      className={`fixed z-[9999] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }
      /* mobile: full width strip at top */
      top-4 left-3 right-3
      /* desktop: fixed width top-right */
      md:left-auto md:right-5 md:top-5 md:w-[340px]
      `}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg shadow-slate-200/60 ${c.bg} ${c.border}`}>
        {/* Icon */}
        <div className={`w-7 h-7 rounded-full ${c.iconBg} text-white flex items-center justify-center text-xs font-black flex-shrink-0`}>
          {c.icon}
        </div>

        {/* Message */}
        <span className={`flex-1 text-sm font-semibold ${c.text}`}>{message}</span>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-xs font-bold flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
