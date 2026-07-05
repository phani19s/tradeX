import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ThemeModal from "./ThemeModal";
import NotificationCenter from "./NotificationCenter";
import ConfirmDialog from "./ConfirmDialog";
import { useTheme } from "../context/ThemeContext";
import api from "../api/api";
import { getAuthHeaders, logoutCurrentSession } from "../api/authApi";

const traderNavigation = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Watchlist", path: "/watchlist" },
  { label: "Trade", path: "/trade" },
  { label: "History", path: "/history" },
  { label: "Alerts", path: "/alerts" },
  { label: "Insights", path: "/market-insights" },
  { label: "Risk", path: "/risk-dashboard" },
  { label: "AI Assistant", path: "/ai-assistant" },
  { label: "Holidays", path: "/market-holidays" },
  { label: "Feedback", path: "/feedback" },
  { label: "Profile", path: "/profile" },
];

const adminNavigation = [
  { label: "Dashboard", path: "/admin" },
  { label: "Market", path: "/admin/market" },
  { label: "Users", path: "/admin/users" },
  { label: "Admins", path: "/admin/administrators" },
  { label: "Stocks", path: "/admin/stocks" },
  { label: "Holidays", path: "/admin/content-market" },
  { label: "Monitor", path: "/admin/trading" },
  { label: "Support", path: "/admin/support", showSupportCount: true },
  { label: "Analytics", path: "/admin/analytics" },
  { label: "Audit Logs", path: "/admin/audit-logs" },
  { label: "Settings", path: "/admin/settings" },
  { label: "Backup & Restore", path: "/admin/backup-restore" },
  { label: "Profile", path: "/profile" },
];

function Navbar() {
  const location = useLocation();
  const [showTheme, setShowTheme] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState("desktop");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const { accentColor } = useTheme();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const navigationItems = currentUser?.is_admin ? adminNavigation : traderNavigation;

  const closeMobileMenu = (returnFocus = false) => {
    setIsMobileMenuOpen(false);
    setShowNotifications(false);
    if (returnFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

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
      if (socket) {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const sidebar = sidebarRef.current;
    const focusableElements = sidebar?.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusableElements?.[0]?.focus();
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu(true);
        return;
      }

      if (event.key !== "Tab" || !focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  async function fetchUnreadCount() {
    const token = localStorage.getItem("token");
    if (!token) return;
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
    const token = localStorage.getItem("token");
    if (!token) return;
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) return;
    try {
      const [chatsRes, ticketsRes, feedbackRes] = await Promise.all([
        api.get("/support/admin/chat/users", getAuthHeaders()),
        api.get("/support/admin/tickets", getAuthHeaders()),
        api.get("/feedback/admin", getAuthHeaders())
      ]);
      const totalUnreadChats = chatsRes.data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
      const openTicketsCount = ticketsRes.data.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
      const pendingFeedbackCount = feedbackRes.data.filter(f => f.status === "Pending").length;
      setUnreadChats(totalUnreadChats + openTicketsCount + pendingFeedbackCount);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch unread chats, tickets, or feedback notifications", error);
      }
    }
  }

  const isPathActive = (path) => path === "/profile"
      ? location.pathname.startsWith("/profile")
      : location.pathname === path;

  const linkStyle = (path) => {
    const isActive = isPathActive(path);

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
      className="sticky top-0 z-40 max-w-full border-b"
      style={{ background: "var(--card)", color: "var(--text)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between px-3 py-3 sm:px-4 md:hidden">
        <Link
          to={currentUser?.is_admin ? "/admin" : "/dashboard"}
          className="min-w-0 truncate text-sm font-bold"
        >
          TradeX
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: accentColor }}
          aria-label="Open navigation menu"
          aria-controls="mobile-navigation"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <span aria-hidden="true" className="text-2xl leading-none">&#9776;</span>
        </button>
      </div>

      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => closeMobileMenu(true)}
      />

      <aside
        id="mobile-navigation"
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2rem))] max-w-full flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--card)", color: "var(--text)" }}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-sm font-bold">TradeX</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: accentColor }}
            aria-label="Close navigation menu"
            onClick={() => closeMobileMenu(true)}
          >
            <span aria-hidden="true" className="text-xl leading-none">&#10005;</span>
          </button>
        </div>

        <nav className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile navigation">
          <div className="flex flex-col gap-1">
            {navigationItems.map((item) => {
              const isActive = isPathActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => closeMobileMenu()}
                  className={`flex min-w-0 items-center justify-between rounded px-3 py-2.5 text-sm font-bold transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isActive ? "" : "hover:bg-black/5"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: accentColor, color: "var(--accent-contrast)", outlineColor: accentColor }
                      : { outlineColor: accentColor }
                  }
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  {item.showSupportCount && unreadChats > 0 && (
                    <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">
                      {unreadChats}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div
          className="grid shrink-0 grid-cols-3 gap-2 border-t p-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={() => {
              closeMobileMenu();
              setShowTheme(true);
            }}
            className="rounded-lg px-2 py-2 text-xs font-bold transition hover:opacity-90"
            style={{ backgroundColor: accentColor, color: "var(--accent-contrast)" }}
          >
            Theme
          </button>

          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setNotificationAnchor("mobile");
                setShowNotifications(!showNotifications);
                fetchUnreadCount();
              }}
              className="relative flex h-full w-full items-center justify-center rounded px-2 py-2 text-xs font-bold transition hover:bg-black/5"
              aria-label="Notifications"
              aria-expanded={showNotifications && notificationAnchor === "mobile"}
            >
              <span aria-hidden="true">&#128276;</span>
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationCenter
              isOpen={showNotifications && notificationAnchor === "mobile"}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              closeMobileMenu();
              setShowLogoutConfirm(true);
            }}
            className="rounded bg-red-500 px-2 py-2 text-xs font-bold text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="relative mx-auto hidden min-w-0 max-w-7xl flex-wrap items-center gap-x-1 gap-y-2 px-3 py-3 md:flex lg:hidden">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <Link key={item.path} to={item.path} {...linkStyle(item.path)}>
              {item.label}
              {item.showSupportCount && unreadChats > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">
                  {unreadChats}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="relative ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTheme(true)}
            className="rounded-lg px-2 py-1.5 text-xs font-bold whitespace-nowrap transition hover:opacity-90"
            style={{ backgroundColor: accentColor, color: "var(--accent-contrast)" }}
          >
            Theme
          </button>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded bg-red-500 px-2 py-1.5 text-xs font-bold whitespace-nowrap text-white hover:bg-red-600"
          >
            Logout
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationAnchor("tablet");
                setShowNotifications(!showNotifications);
                fetchUnreadCount();
              }}
              className="relative flex items-center justify-center rounded-full p-2 transition hover:bg-black/5"
              title="Notifications"
              aria-label="Notifications"
            >
              &#128276;
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationCenter
              isOpen={showNotifications && notificationAnchor === "tablet"}
              onClose={() => setShowNotifications(false)}
            />
          </div>
        </div>
      </div>

      <div className="relative mx-auto hidden max-w-7xl items-center gap-1 px-4 py-4 lg:flex xl:gap-4">
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

        <div className="ml-auto relative flex items-center gap-1 xl:gap-4">
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
              onClick={() => {
                setNotificationAnchor("desktop");
                setShowNotifications(!showNotifications);
                fetchUnreadCount();
              }}
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
            <NotificationCenter
              isOpen={showNotifications && notificationAnchor === "desktop"}
              onClose={() => setShowNotifications(false)}
            />
          </div>
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
  );
}

export default Navbar;
