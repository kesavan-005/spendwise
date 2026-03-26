import { useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import Toast from "../components/Toast";
import { useToast } from "../utils/useToast";

// Simple deterministic hash — not cryptographic but prevents plain-text PIN storage
function hashPIN(pin, username) {
  const s = `${username}:${pin}:spendwise`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

export default function Login({ onLogin }) {
  const { toast, showToast, clearToast } = useToast();

  const [step,       setStep]       = useState("login");   // "login" | "register"
  const [username,   setUsername]   = useState("");
  const [pin,        setPin]        = useState(["","","",""]);
  const [pinConfirm, setPinConfirm] = useState(["","","",""]);
  const [loading,    setLoading]    = useState(false);

  const pinRefs    = [useRef(), useRef(), useRef(), useRef()];
  const confRefs   = [useRef(), useRef(), useRef(), useRef()];

  // ── PIN input handlers ─────────────────────────────────────────────────
  function onPinChange(val, idx, arr, setArr, refs) {
    // handle paste of full 4-digit PIN
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 4).split("");
      if (!digits.length) return;
      const next = ["", "", "", ""];
      digits.forEach((d, i) => { next[i] = d; });
      setArr(next);
      refs[Math.min(digits.length, 3)].current?.focus();
      return;
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...arr];
    next[idx] = val;
    setArr(next);
    // auto-advance immediately on digit entry
    if (val && idx < 3) refs[idx + 1].current?.focus();
  }

  function onPinKey(e, idx, arr, setArr, refs) {
    if (e.key === "Backspace") {
      if (arr[idx]) {
        // clear current box only
        const next = [...arr]; next[idx] = ""; setArr(next);
      } else if (idx > 0) {
        // move back and clear previous box
        const next = [...arr]; next[idx - 1] = ""; setArr(next);
        refs[idx - 1].current?.focus();
      }
    }
  }

  const pinFull  = pin.every(Boolean);
  const confFull = pinConfirm.every(Boolean);

  function resetPins() {
    setPin(["","","",""]);
    setPinConfirm(["","","",""]);
    setTimeout(() => pinRefs[0].current?.focus(), 50);
  }

  // ── Login ──────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name)    return showToast("Enter your username", "error");
    if (!pinFull) return showToast("Enter your 4-digit PIN", "error");
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", name, "auth", "pin"));
      if (!snap.exists()) {
        // first time — move to register
        setStep("register");
        setPin(["","","",""]);
        showToast("New account — set a PIN to register", "info");
        setLoading(false);
        return;
      }
      const correct = snap.data()?.hash === hashPIN(pin.join(""), name);
      if (!correct) {
        showToast("Incorrect PIN — try again", "error");
        resetPins();
        setLoading(false);
        return;
      }
      localStorage.setItem("spendwise_username", name);
      onLogin(name);
    } catch (err) {
      console.error(err);
      showToast("Login failed — check your connection", "error");
    }
    setLoading(false);
  }

  // ── Register ───────────────────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    const name = username.trim();
    if (!pinFull)  return showToast("Enter a 4-digit PIN", "error");
    if (!confFull) return showToast("Confirm your PIN", "error");
    if (pin.join("") !== pinConfirm.join("")) {
      showToast("PINs don't match", "error");
      setPinConfirm(["","","",""]);
      setTimeout(() => confRefs[0].current?.focus(), 50);
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(db, "users", name, "auth", "pin"), {
        hash:      hashPIN(pin.join(""), name),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("spendwise_username", name);
      onLogin(name);
    } catch (err) {
      console.error(err);
      showToast("Failed to save PIN — check your connection", "error");
    }
    setLoading(false);
  }

  // ── PIN dot row ────────────────────────────────────────────────────────
  function PinRow({ arr, setArr, refs, label }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
          {label}
        </label>
        <div className="flex gap-3 justify-center">
          {arr.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={digit}
              onChange={(e) => onPinChange(e.target.value, i, arr, setArr, refs)}
              onKeyDown={(e) => onPinKey(e, i, arr, setArr, refs)}
              onFocus={(e) => e.target.select()}
              className="w-13 h-13 text-center text-2xl font-black rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700"
              style={{ width: 52, height: 52 }}
            />
          ))}
        </div>
        {/* filled indicator dots */}
        <div className="flex gap-3 justify-center mt-2">
          {arr.map((d, i) => (
            <div key={i}
              className="w-2 h-2 rounded-full transition-all duration-150"
              style={{ background: d ? "#10b981" : "#e2e8f0" }} />
          ))}
        </div>
      </div>
    );
  }

  const fieldClass =
    "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:bg-white dark:focus:bg-slate-700";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#f6f8fa] dark:bg-slate-950 transition-colors"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');`}</style>

      <div className="w-full max-w-sm">

        {/* ── Logo ──────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200 dark:shadow-emerald-900">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 11l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100" style={{ letterSpacing: "-0.03em" }}>
            SpendWise
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {step === "login" ? "Sign in to continue" : `Create PIN for "${username}"`}
          </p>
        </div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

          {/* LOGIN */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && pinRefs[0].current?.focus()}
                  onBlur={() => { if (username.trim()) setTimeout(() => pinRefs[0].current?.focus(), 50); }}
                  placeholder="Enter your username"
                  autoComplete="username"
                  spellCheck={false}
                  className={fieldClass}
                />
              </div>

              <PinRow arr={pin} setArr={setPin} refs={pinRefs} label="4-Digit PIN" />

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>

              <p className="text-center text-xs text-slate-400">
                New user?{" "}
                <button type="button"
                  onClick={() => { setStep("register"); resetPins(); }}
                  className="text-emerald-600 font-semibold hover:underline">
                  Create account
                </button>
              </p>
            </form>
          )}

          {/* REGISTER */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="p-6 space-y-5">
              <div className="px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 text-center">
                  New account for <span className="font-black">{username}</span>
                </p>
              </div>

              <PinRow arr={pin}        setArr={setPin}        refs={pinRefs}  label="Choose a 4-Digit PIN" />
              <PinRow arr={pinConfirm} setArr={setPinConfirm} refs={confRefs} label="Confirm PIN" />

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Creating…
                  </span>
                ) : "Create Account"}
              </button>

              <p className="text-center text-xs text-slate-400">
                <button type="button"
                  onClick={() => { setStep("login"); resetPins(); }}
                  className="text-slate-500 font-semibold hover:underline">
                  Back to sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Data stored securely in Firebase Firestore
        </p>
      </div>

      <Toast message={toast.message} type={toast.type} onClose={clearToast} />
    </div>
  );
}