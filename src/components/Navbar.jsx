import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

export default function Navbar({ onLogout }) {
  const base =
    "px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap";
  const active = "bg-emerald-500 text-black";
  const idle =
    "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

  // ✅ Theme state
  const [dark, setDark] = useState(false);

  // ✅ Load theme (default light)
  useEffect(() => {
    const saved = localStorage.getItem("spendwise_theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  // ✅ Toggle theme
  function toggleTheme() {
    if (dark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("spendwise_theme", "light");
      setDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("spendwise_theme", "dark");
      setDark(true);
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-900">
      <div className="max-w-5xl mx-auto p-3 flex items-center justify-between gap-3">
        {/* ✅ Logo */}
        <div className="font-extrabold text-lg tracking-wide text-slate-900 dark:text-slate-100">
          SpendWise
        </div>

        {/* ✅ Menu */}
        <div className="flex gap-2 overflow-x-auto">
          <NavLink
            to="/"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/add"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Add
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Reports
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
          >
            Settings
          </NavLink>
        </div>

        {/* ✅ Actions */}
        <div className="flex gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 text-sm font-bold"
          >
            {dark ? "Light" : "Dark"}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-black text-sm font-extrabold"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
