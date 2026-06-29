import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";
import AdminChatModal from "../components/AdminChatModal";

function AdminSupportPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chats"); // "chats" or "tickets"

  // Chats states
  const [users, setUsers] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Tickets states
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [resolvingTicketId, setResolvingTicketId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    
    // Fetch data for the initial active tab
    if (activeTab === "chats") {
      fetchChatUsers();
    } else {
      fetchTickets();
    }
  }, [navigate, activeTab]);

  // Chats API call
  async function fetchChatUsers() {
    try {
      setLoadingChats(true);
      const res = await api.get("/support/admin/chat/users", getAuthHeaders());
      setUsers(res.data);
      window.dispatchEvent(new Event("tradex_chats_updated"));
    } catch (error) {
      console.error("Failed to fetch chat users:", error);
      toast.error("Failed to load active chats");
    } finally {
      setLoadingChats(false);
    }
  }

  // Tickets API call
  async function fetchTickets() {
    try {
      setLoadingTickets(true);
      const res = await api.get("/support/admin/tickets", getAuthHeaders());
      setTickets(res.data);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoadingTickets(false);
    }
  }

  // Tickets status update
  async function updateTicketStatus(id, newStatus) {
    if (newStatus === "RESOLVED") {
      setResolvingTicketId(id);
      return;
    }
    
    try {
      await api.patch(`/support/admin/tickets/${id}`, { status: newStatus }, getAuthHeaders());
      toast.success("Ticket updated successfully");
      fetchTickets();
    } catch (error) {
      toast.error("Failed to update ticket");
    }
  }

  // Ticket resolution submission
  async function handleResolveSubmit() {
    if (!resolutionReason.trim()) {
      toast.error("Please enter a valid resolution reason");
      return;
    }

    try {
      await api.patch(`/support/admin/tickets/${resolvingTicketId}`, { 
        status: "RESOLVED", 
        resolution: resolutionReason 
      }, getAuthHeaders());
      
      toast.success("Ticket marked as resolved");
      setResolvingTicketId(null);
      setResolutionReason("");
      fetchTickets();
    } catch (error) {
      toast.error("Failed to resolve ticket");
    }
  }

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5 space-y-6">
        {/* Support Header */}
        <div className="theme-card rounded-2xl p-6 shadow">
          <h1 className="text-4xl font-bold">Support Center</h1>
          <p className="mt-2 opacity-70">
            Address customer tickets, engage in live conversations, and audit resolution histories in one unified panel.
          </p>

          {/* Combined Tabs */}
          <div className="flex border-b mt-6" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setActiveTab("chats")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer ${
                activeTab === "chats"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "chats" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Active Chats
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer ${
                activeTab === "tickets"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "tickets" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Support Tickets
            </button>
          </div>
        </div>

        {/* Chats Tab content */}
        {activeTab === "chats" && (
          <div className="theme-card rounded-2xl p-6 shadow">
            {loadingChats ? (
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
                    className="flex justify-between items-center p-4 rounded-xl border hover:bg-surface/10 transition animate-in fade-in duration-200" 
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
        )}

        {/* Tickets Tab content */}
        {activeTab === "tickets" && (
          <div className="theme-card rounded-2xl p-6 shadow">
            {loadingTickets ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                <span className="ml-3 font-semibold">Loading support tickets...</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Ticket #</th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Type</th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Description</th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Date</th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center opacity-50 text-sm">
                          No support tickets found.
                        </td>
                      </tr>
                    ) : (
                      tickets.map(ticket => (
                        <tr key={ticket.id} className="hover:bg-surface/10 transition animate-in fade-in duration-200">
                          <td className="px-4 py-4 text-sm font-bold">{ticket.ticket_number}</td>
                          <td className="px-4 py-4 text-sm">{ticket.issue_type}</td>
                          <td className="px-4 py-4 text-sm max-w-[300px] truncate" title={ticket.description}>
                            {ticket.description}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              ticket.status === 'OPEN'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : ticket.status === 'RESOLVED'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            }`}>
                              {ticket.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm opacity-70">
                            {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-center">
                            {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
                              <div className="flex justify-center gap-3">
                                <button
                                  onClick={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                                  className="text-sky-400 hover:underline cursor-pointer font-bold"
                                >
                                  Progress
                                </button>
                                <button
                                  onClick={() => updateTicketStatus(ticket.id, 'RESOLVED')}
                                  className="text-emerald-400 hover:underline cursor-pointer font-bold"
                                >
                                  Resolve
                                </button>
                              </div>
                            ) : (
                              <span className="opacity-45">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reply Chat Modal */}
      <AdminChatModal 
        isOpen={isChatModalOpen} 
        onClose={() => { 
          setIsChatModalOpen(false); 
          setSelectedChatUser(null); 
          fetchChatUsers(); 
        }} 
        user={selectedChatUser} 
      />

      {/* Resolve Ticket Modal */}
      {resolvingTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border p-6 shadow-2xl animate-in fade-in zoom-in duration-150" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
            <h3 className="text-xl font-bold">Resolve Ticket</h3>
            <p className="mt-1 text-sm opacity-70">Enter a resolution message for the user.</p>
            
            <textarea
              className="mt-4 w-full rounded-2xl border p-4 text-sm outline-none transition focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              rows={4}
              placeholder="Enter resolution details..."
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setResolvingTicketId(null); setResolutionReason(""); }}
                className="flex-1 rounded-xl border py-3 font-semibold transition hover:bg-black/5 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSubmit}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 font-semibold text-white transition hover:opacity-90 cursor-pointer"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSupportPage;
