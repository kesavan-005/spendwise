import { useEffect, useState } from "react";
import { HashRouter , Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import Navbar from "./components/Navbar";

export default function App() {
  const [username, setUsername] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("spendwise_username");
    if (saved) setUsername(saved);
  }, []);

  function logout() {
    localStorage.removeItem("spendwise_username");
    setUsername(null);
  }

  // If no username -> Login page only
  if (!username) return <Login onLogin={setUsername} />;

  return (
    <HashRouter>
      <Navbar onLogout={logout} />

      <Routes>
        <Route path="/" element={<Dashboard username={username} />} />
        <Route path="/add" element={<AddTransaction username={username} />} />
        <Route path="/reports" element={<Reports username={username} />} />
        <Route path="/settings" element={<Settings username={username} />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
