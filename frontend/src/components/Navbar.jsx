import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import ThemeModal from "./ThemeModal";
import NotificationCenter from "./NotificationCenter";
import { useTheme } from "../context/ThemeContext";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function Navbar() {
  const location = useLocation();
  const [showTheme, setShowTheme] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { accentColor } = useTheme();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function fetchUnreadCount() {
    try {
      const res = await api.get("/notifications/unread-count", getAuthHeaders());
      setUnreadCount(res.data.count);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch unread count", error);
      }
    }
  }

  const linkStyle = (path) => {
    return location.pathname === path
      ? {
          className: "px-4 py-2 rounded font-semibold text-white",
          style: { backgroundColor: accentColor },
        }
      : {
          className: "transition hover:opacity-80",
          style: {},
        };
  };

  return (
    <div
      className="border-b"
      style={{ background: "var(--card)", color: "var(--text)", borderColor: "var(--border)" }}
    >
      <div className="relative mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        <Link to="/dashboard" {...linkStyle("/dashboard")}>
          Dashboard
        </Link>

        <Link to="/portfolio" {...linkStyle("/portfolio")}>
          Portfolio
        </Link>

        <Link to="/watchlist" {...linkStyle("/watchlist")}>
          Watchlist
        </Link>

        <Link to="/trade" {...linkStyle("/trade")}>
          Trade
        </Link>

        <Link to="/history" {...linkStyle("/history")}>
          History
        </Link>

        <Link to="/profile" {...linkStyle("/profile")}>
          Profile
        </Link>

        {currentUser?.is_admin && (
          <Link to="/admin" {...linkStyle("/admin")}>
            Admin
          </Link>
        )}

        <div className="ml-auto relative flex items-center gap-4">
          <button
            onClick={() => setShowTheme(true)}
            className="rounded-lg px-4 py-2 text-white transition hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            Theme
          </button>
          
          <button
            onClick={logout}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Logout
          </button>

          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); fetchUnreadCount(); }}
              className="p-2 rounded-full transition hover:bg-black/5 flex items-center justify-center relative"
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
          </div>
        </div>

        <ThemeModal isOpen={showTheme} onClose={() => setShowTheme(false)} />
      </div>
    </div>
  );
}

export default Navbar;
