import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import ThemeModal from "./ThemeModal";
import NotificationCenter from "./NotificationCenter";
import ConfirmDialog from "./ConfirmDialog";
import { useTheme } from "../context/ThemeContext";
import api from "../api/api";
import { getAuthHeaders, logoutCurrentSession } from "../api/authApi";

function Navbar() {
  const location = useLocation();
  const [showTheme, setShowTheme] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { accentColor } = useTheme();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const logout = async () => {
    try {
      if (localStorage.getItem("token")) {
        await logoutCurrentSession();
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Failed to close current session", error);
      }
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("tradex_last_activity");
      localStorage.removeItem("tradex_stay_login_timestamp");
      localStorage.setItem("tradex_session_status", `logged_out_${Date.now()}`);
      window.location.href = "/";
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
    const token = localStorage.getItem("token");
    const wsBase = api.defaults.baseURL.replace(/^http/, "ws");
    const socket = token
      ? new WebSocket(`${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`)
      : null;

    if (socket) {
      socket.onmessage = () => {
        fetchUnreadCount();
        window.dispatchEvent(
          new Event("tradex_notifications_updated")
        );
      };
    
      socket.onerror = () => {
        socket.close();
      };
    }

    return () => {
      clearInterval(interval);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
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
    const isActive = path === "/profile"
      ? location.pathname.startsWith("/profile")
      : location.pathname === path;

    return isActive
      ? {
          className: "px-4 py-2 rounded font-semibold",
          style: { backgroundColor: accentColor, color: "var(--accent-contrast)" },
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
        <Link to={currentUser?.is_admin ? "/admin" : "/dashboard"} {...linkStyle(currentUser?.is_admin ? "/admin" : "/dashboard")}>
          Dashboard
        </Link>

        {currentUser?.is_admin && (
          <>
            <Link to="/admin/users" {...linkStyle("/admin/users")}>
              User Management
            </Link>
            <Link to="/admin/administrators" {...linkStyle("/admin/administrators")}>
              Admin Management
            </Link>
            <Link to="/admin/trading" {...linkStyle("/admin/trading")}>
              Trading Monitor
            </Link>
            <Link to="/admin/tickets" {...linkStyle("/admin/tickets")}>
              Tickets
            </Link>
            <Link to="/admin/chats" {...linkStyle("/admin/chats")}>
              Chats
            </Link>
            <Link to="/admin/stocks" {...linkStyle("/admin/stocks")}>
              Stock Management
            </Link>
          </>
        )}

        {!currentUser?.is_admin && (
          <>
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

            <Link to="/ai-assistant" {...linkStyle("/ai-assistant")}>
              AI Assistant
            </Link>

            <Link to="/alerts" {...linkStyle("/alerts")}>
              Alerts
            </Link>

            <Link to="/risk-dashboard" {...linkStyle("/risk-dashboard")}>
              Risk
            </Link>
          </>
        )}

        <Link to="/profile" {...linkStyle("/profile")}>
          Profile
        </Link>

        <div className="ml-auto relative flex items-center gap-4">
          <button
            onClick={() => setShowTheme(true)}
            className="rounded-lg px-4 py-2 transition hover:opacity-90"
            style={{ backgroundColor: accentColor, color: "var(--accent-contrast)" }}
          >
            Theme
          </button>
          
          <button
            onClick={() => setShowLogoutConfirm(true)}
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
        <ConfirmDialog
          isOpen={showLogoutConfirm}
          title="Logout?"
          message="You will be signed out of this TradeX session."
          confirmText="Logout"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logout();
          }}
        />
      </div>
    </div>
  );
}

export default Navbar;
