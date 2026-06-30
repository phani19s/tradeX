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
  const [unreadChats, setUnreadChats] = useState(0);
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
    fetchUnreadChats();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchUnreadChats();
    }, 30000); // Check every 30 seconds

    const handleChatUpdate = () => {
      fetchUnreadChats();
    };
    window.addEventListener("tradex_chats_updated", handleChatUpdate);

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
      window.removeEventListener("tradex_chats_updated", handleChatUpdate);
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

  async function fetchUnreadChats() {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) return;
    try {
      const res = await api.get("/support/admin/chat/users", getAuthHeaders());
      const totalUnread = res.data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
      setUnreadChats(totalUnread);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch unread chats", error);
      }
    }
  }

  const linkStyle = (path) => {
    const isActive = path === "/profile"
      ? location.pathname.startsWith("/profile")
      : location.pathname === path;

    return isActive
      ? {
          className: "px-2 py-1.5 rounded font-bold text-xs whitespace-nowrap",
          style: { backgroundColor: accentColor, color: "var(--accent-contrast)" },
        }
      : {
          className: "px-2 py-1.5 transition hover:opacity-80 text-xs font-bold whitespace-nowrap",
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
            <Link to="/admin/market" {...linkStyle("/admin/market")}>
              Market
            </Link>
            <Link to="/admin/users" {...linkStyle("/admin/users")}>
              Users
            </Link>
            <Link to="/admin/administrators" {...linkStyle("/admin/administrators")}>
              Admins
            </Link>
            <Link to="/admin/stocks" {...linkStyle("/admin/stocks")}>
              Stocks
            </Link>
            <Link to="/admin/content-market" {...linkStyle("/admin/content-market")}>
              Holidays
            </Link>
            <Link to="/admin/trading" {...linkStyle("/admin/trading")}>
              Monitor
            </Link>
            <Link to="/admin/support" {...linkStyle("/admin/support")}>
              Support {unreadChats > 0 && <span className="ml-1 text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full">{unreadChats}</span>}
            </Link>
            <Link to="/admin/analytics" {...linkStyle("/admin/analytics")}>
              Analytics
            </Link>
            <Link to="/admin/audit-logs" {...linkStyle("/admin/audit-logs")}>
              Audit Logs
            </Link>
            <Link to="/admin/settings" {...linkStyle("/admin/settings")}>
              Settings
            </Link>
            <Link to="/admin/backup-restore" {...linkStyle("/admin/backup-restore")}>
              Backup & Restore
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
            <Link to="/alerts" {...linkStyle("/alerts")}>
              Alerts
            </Link>
            <Link to="/market-insights" {...linkStyle("/market-insights")}>
              Insights
            </Link>
            <Link to="/risk-dashboard" {...linkStyle("/risk-dashboard")}>
              Risk
            </Link>
            <Link to="/ai-assistant" {...linkStyle("/ai-assistant")}>
              AI Assistant
            </Link>
            <Link to="/market-holidays" {...linkStyle("/market-holidays")}>
              Holidays
            </Link>
            <Link to="/feedback" {...linkStyle("/feedback")}>
              Feedback
            </Link>
          </>
        )}

        <Link to="/profile" {...linkStyle("/profile")}>
          Profile
        </Link>

        <div className="ml-auto relative flex items-center gap-4">
          <button
            onClick={() => setShowTheme(true)}
            className="rounded-lg px-2 py-1.5 transition hover:opacity-90 font-bold text-xs whitespace-nowrap"
            style={{ backgroundColor: accentColor, color: "var(--accent-contrast)" }}
          >
            Theme
          </button>
          
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded bg-red-500 hover:bg-red-600 px-2 py-1.5 text-white font-bold text-xs whitespace-nowrap"
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
