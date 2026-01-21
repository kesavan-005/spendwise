import { useState } from "react";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const { toast, showToast, clearToast } = useToast();

  function handleLogin(e) {
    e.preventDefault();

    const name = username.trim();

    if (!name) {
      showToast("Enter username", "error");
      return;
    }

    // Save login locally
    localStorage.setItem("spendwise_username", name);
    showToast("Login success", "success");

    // small delay so toast shows before route changes
    setTimeout(() => {
      onLogin(name);
    }, 500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
        {/* Logo / Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            SpendWise
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Track daily expenses with clean reports and graphs
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Username
            </label>

            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className={
                "mt-2 w-full p-3 rounded-xl outline-none border " +
                "bg-white border-slate-200 text-slate-900 " +
                "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
              }
            />
          </div>

          <button
            type="submit"
            className="w-full p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold shadow-[0_0_25px_rgba(16,185,129,0.35)]"
          >
            Login
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Your data is stored securely in Firestore.
        </div>
      </div>

      {/* Toast */}
      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}
