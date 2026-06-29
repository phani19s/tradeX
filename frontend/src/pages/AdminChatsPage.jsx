import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";
import AdminChatModal from "../components/AdminChatModal";

function AdminChatsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    console.log("AdminChatsPage: user is_admin:", user?.is_admin);
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    fetchChatUsers();
  }, [navigate]);

  async function fetchChatUsers() {
    try {
      console.log("AdminChatsPage: Fetching chat users...");
      setLoading(true);
      const res = await api.get("/support/admin/chat/users", getAuthHeaders());
      console.log("AdminChatsPage: Fetched chat users successfully", res.data);
      setUsers(res.data);
      window.dispatchEvent(new Event("tradex_chats_updated"));
    } catch (error) {
      console.error("AdminChatsPage: Failed to fetch chat users:", error);
      toast.error("Failed to load active chats");
    } finally {
      console.log("AdminChatsPage: Done loading");
      setLoading(false);
    }
  }

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5">
        <div className="theme-card rounded-2xl p-6 shadow mb-6">
          <h1 className="text-4xl font-bold">Support Chats</h1>
          <p className="mt-2 opacity-70">
            Real-time chat replies and support conversations with active traders.
          </p>
        </div>

        <div className="theme-card rounded-2xl p-6 shadow">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
              <span className="ml-3 font-semibold">Loading active chats...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 opacity-60">
              <p className="text-base font-semibold">No active support chats found.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map(u => (
                <div 
                  key={u.user_id} 
                  className="flex justify-between items-center p-4 rounded-xl border hover:bg-surface/10 transition" 
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="font-bold text-sm flex items-center gap-2">
                      {u.email} 
                      {u.unread_count > 0 && (
                        <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                          {u.unread_count} new
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-75 truncate max-w-md mt-1">
                      {u.last_message || "No messages yet."}
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSelectedChatUser(u); setIsChatModalOpen(true); }} 
                    className="text-xs font-bold px-4 py-2 rounded-xl transition hover:opacity-90 cursor-pointer"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    Reply
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminChatModal 
        isOpen={isChatModalOpen} 
        onClose={() => { 
          setIsChatModalOpen(false); 
          setSelectedChatUser(null); 
          fetchChatUsers(); 
        }} 
        user={selectedChatUser} 
      />
    </div>
  );
}

export default AdminChatsPage;
