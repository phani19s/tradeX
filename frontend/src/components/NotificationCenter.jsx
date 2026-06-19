import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function NotificationCenter({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef(null);
  const navigate = useNavigate();

  async function fetchNotifications() {
    try {
      setLoading(true);
      const res = await api.get("/notifications", getAuthHeaders());
      setNotifications(res.data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  async function markAsRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`, {}, getAuthHeaders());
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  }

  async function deleteNotification(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`, getAuthHeaders());
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  }

  async function clearAllNotifications() {
    try {
      await api.delete("/notifications", getAuthHeaders());
      setNotifications([]);
    } catch (error) {
      console.error("Failed to clear all notifications", error);
    }
  }

  async function markAllAsRead() {
    try {
      await api.post("/notifications/read-all", {}, getAuthHeaders());
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  }

  const handleNotificationClick = async (notif) => {
    // Redirection logic based on type
    if (notif.type === "CHAT") {
      navigate("/profile");
      // Dispatch custom event to open chat box on profile page
      setTimeout(() => {
        window.dispatchEvent(new Event("tradex_open_chat"));
      }, 100);
    } else if (notif.type === "TICKET") {
      navigate("/profile/tickets");
    } else if (notif.type === "DEPOSIT" || notif.type === "WITHDRAWAL" || notif.type === "TRADE") {
      navigate("/history");
    } else {
      navigate("/dashboard");
    }

    // Close the notification center
    onClose();

    // Delete the notification after redirection so it doesn't appear again
    try {
      await api.delete(`/notifications/${notif.id}`, getAuthHeaders());
      setNotifications(notifications.filter(n => n.id !== notif.id));
    } catch (error) {
      console.error("Failed to delete notification after click", error);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50">
      <div 
        ref={modalRef}
        className="rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", maxHeight: "400px" }}
      >
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <h3 className="font-bold text-sm">Notifications {unreadCount > 0 && <span className="ml-1 text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>}</h3>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-[10px] font-semibold text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        
        <div className="overflow-y-auto flex-1 p-2 space-y-2 min-h-[100px]">
          {loading ? (
            <div className="p-4 text-center text-sm opacity-50">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm opacity-50">No notifications</div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-3 rounded-xl border transition cursor-pointer hover:opacity-80 relative group ${notif.is_read ? 'opacity-60' : 'bg-accent/5 border-accent/20'}`}
                style={{ borderColor: notif.is_read ? "var(--border)" : undefined }}
                onClick={() => handleNotificationClick(notif)}
              >
                <button
                  onClick={(e) => deleteNotification(notif.id, e)}
                  className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-opacity text-xs"
                  title="Clear"
                >
                  ✕
                </button>
                <div className="flex justify-between items-start mb-1 pr-6">
                  <h4 className="font-bold text-xs">{notif.title}</h4>
                  <span className="text-[9px] opacity-50">{new Date(notif.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed pr-4">{notif.message}</p>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t text-center" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={clearAllNotifications}
              className="w-full py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition"
            >
              Clear All Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;