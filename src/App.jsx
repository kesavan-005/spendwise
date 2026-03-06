import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Login          from "./pages/Login";
import Dashboard      from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import Reports        from "./pages/Reports";
import Settings       from "./pages/Settings";
import Navbar         from "./components/Navbar";
import QuickAdd       from "./components/QuickAdd";

export default function App() {
  const [username, setUsername] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("spendwise_username");
    if (saved) setUsername(saved);
  }, []);

  function logout() {
    localStorage.removeItem("spendwise_username");
    setUsername(null);
  }

  // called by QuickAdd after a successful save — bumps key so Dashboard/Reports reload
  function handleQuickSaved() {
    setRefreshKey((k) => k + 1);
  }

  if (!username) return <Login onLogin={setUsername} />;

  return (
    <HashRouter>
      <Navbar onLogout={logout} />

      <Routes>
        <Route path="/"        element={<Dashboard      username={username} refreshKey={refreshKey} />} />
        <Route path="/add"     element={<AddTransaction username={username} />} />
        <Route path="/reports" element={<Reports        username={username} />} />
        <Route path="/settings"element={<Settings       username={username} />} />
        <Route path="*"        element={<Navigate to="/" />} />
      </Routes>

      {/* Floating quick-add button — visible on every page */}
      <QuickAdd username={username} onSaved={handleQuickSaved} />
    </HashRouter>
  );
}
