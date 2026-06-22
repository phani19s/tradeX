import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function AdminChatModal({ isOpen, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMessages() {
    if (!user) {
      return;
    }

    try {
      const response = await api.get(`/support/admin/chat/${user.user_id}`, getAuthHeaders());
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!newMessage.trim() || !user) {
      return;
    }

    setLoading(true);
    try {
      await api.post(`/support/admin/chat/${user.user_id}`, { message: newMessage }, getAuthHeaders());
      setNewMessage("");
      fetchMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !user) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-[1000] w-96 flex flex-col rounded-3xl border shadow-2xl overflow-hidden"
      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)", height: "500px" }}
    >
      <div
        className="p-4 border-b flex justify-between items-center"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        <div>
          <h3 className="font-bold text-lg truncate w-64">{user.email}</h3>
          <p className="text-xs opacity-80">Replying as Admin</p>
        </div>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 transition p-2">x</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "var(--surface)" }}>
        {messages.length === 0 ? (
          <div className="text-center opacity-50 mt-10 text-sm">
            No messages found for this user.
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.sender_type === "ADMIN";

            return (
              <div key={msg.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl p-3 text-sm shadow-sm"
                  style={{
                    background: isAdmin ? "var(--accent)" : "var(--card)",
                    color: isAdmin ? "var(--accent-contrast)" : "var(--text)",
                    border: isAdmin ? "none" : "1px solid var(--border)",
                    borderBottomRightRadius: isAdmin ? "4px" : "16px",
                    borderBottomLeftRadius: isAdmin ? "16px" : "4px",
                  }}
                >
                  {msg.message}
                </div>
                <span className="text-[10px] opacity-40 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            placeholder="Type reply..."
            className="flex-1 rounded-full border px-4 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 transition"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="rounded-full w-10 h-10 flex items-center justify-center transition hover:opacity-90 disabled:opacity-50 flex-shrink-0"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            {">"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminChatModal;
