import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

function SessionTimeout({ timeoutMinutes = 15 }) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState("Your session has expired due to inactivity.");
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const logout = useCallback((message = "Your session has expired due to inactivity.") => {
    // Check if we recently clicked "Stay Login" to avoid redundant prompts (especially from 401 loops)
    const lastStay = parseInt(localStorage.getItem("tradex_stay_login_timestamp") || "0");
    const now = Date.now();
    
    // If it was less than 15 minutes ago, don't show the timeout again
    if (now - lastStay < 15 * 60 * 1000) return;

    // Notify other tabs
    localStorage.setItem("tradex_session_status", "expired_" + now);
    setExpiryMessage(message);
    setIsTimedOut(true);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    const token = localStorage.getItem("token");
    if (token) {
      timerRef.current = setTimeout(() => logout(), timeoutMinutes * 60 * 1000);
    }
  }, [logout, timeoutMinutes]);

  const stayLogin = useCallback(() => {
    setIsTimedOut(false);
    resetTimer();
    // Update last activity and session status to sync other tabs
    const now = Date.now().toString();
    localStorage.setItem("tradex_stay_login_timestamp", now);
    localStorage.setItem("tradex_last_activity", now);
    localStorage.setItem("tradex_session_status", "stay_" + now);
  }, [resetTimer]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "tradex_session_status") {
        if (e.newValue) {
          if (e.newValue.startsWith("expired_")) {
            // Check if we recently stayed before showing the modal from another tab's notification
            const lastStay = parseInt(localStorage.getItem("tradex_stay_login_timestamp") || "0");
            if (Date.now() - lastStay < 15 * 60 * 1000) return;
            
            setIsTimedOut(true);
          } else if (e.newValue.startsWith("stay_")) {
            setIsTimedOut(false);
            resetTimer();
          }
        }
      } else if (e.key === "tradex_last_activity") {
        if (!isTimedOut) resetTimer();
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
      // Don't reset activity if we're already showing the timeout modal
      const currentStatus = localStorage.getItem("tradex_session_status");
      if (currentStatus && currentStatus.startsWith("expired_")) return;

      const now = Date.now();
      const lastSync = parseInt(localStorage.getItem("tradex_last_activity") || "0");
      
      // Only sync to localStorage once every 30 seconds to avoid performance issues
      if (now - lastSync > 30000) {
        localStorage.setItem("tradex_last_activity", now.toString());
      }
      
      resetTimer();
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
