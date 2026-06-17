import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

function SessionTimeout({ timeoutMinutes = 15 }) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState("Your session has expired due to inactivity.");
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const logout = useCallback((message = "Your session has expired due to inactivity.") => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Notify other tabs
    localStorage.setItem("tradex_session_status", "expired_" + Date.now());
    setExpiryMessage(message);
    setIsTimedOut(true);
  }, []);

  const stayLogin = useCallback(() => {
    setIsTimedOut(false);
    resetTimer();
    // Notify other tabs to also reset/stay logged in
    localStorage.setItem("tradex_session_status", "stay_" + Date.now());
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    const token = localStorage.getItem("token");
    if (token) {
      timerRef.current = setTimeout(() => logout(), timeoutMinutes * 60 * 1000);
    }
  }, [logout, timeoutMinutes]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "tradex_session_status") {
        if (e.newValue && e.newValue.startsWith("expired_")) {
          setIsTimedOut(true);
        } else if (e.newValue && e.newValue.startsWith("stay_")) {
          setIsTimedOut(false);
          resetTimer();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    const handleAuthError = () => {
      logout("Your security session has expired or is invalid.");
    };

    window.addEventListener("tradex_auth_expired", handleAuthError);

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    const handleActivity = () => {
      if (!isTimedOut) {
        resetTimer();
      }
    };

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tradex_auth_expired", handleAuthError);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, isTimedOut, logout]);

  const handleRelogin = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsTimedOut(false);
    navigate("/");
  };

  if (!isTimedOut) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-sm rounded-[32px] border p-8 shadow-2xl text-center"
        style={{
          background: "var(--card)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-amber-500/20 p-4">
            <span className="text-4xl">⏳</span>
          </div>
        </div>
        
        <h2 className="text-3xl font-black mb-3">Session Timeout</h2>
        <p className="opacity-70 mb-8 leading-relaxed">
          {expiryMessage} Would you like to stay logged in or re-login?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={stayLogin}
            className="w-full rounded-2xl py-4 font-bold text-white shadow-lg transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Stay-login
          </button>
          <button
            onClick={handleRelogin}
            className="w-full rounded-2xl border py-4 font-bold transition hover:bg-white/5"
            style={{ borderColor: "var(--border)" }}
          >
            Re-login
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeout;
