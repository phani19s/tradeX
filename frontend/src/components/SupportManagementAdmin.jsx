import { useEffect, useState } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";
import AdminChatModal from "./AdminChatModal";

function SupportManagementAdmin() {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [resolvingTicketId, setResolvingTicketId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [activeTab, setActiveTab] = useState("tickets"); // "tickets" or "chats"

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [ticketsRes, usersRes] = await Promise.all([
        api.get("/support/admin/tickets", getAuthHeaders()),
        api.get("/support/admin/chat/users", getAuthHeaders())
      ]);
      setTickets(ticketsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error("Failed to load support data", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(id, newStatus) {
    if (newStatus === "RESOLVED") {
      setResolvingTicketId(id);
      return;
    }
    
    try {
      await api.patch(`/support/admin/tickets/${id}`, { status: newStatus }, getAuthHeaders());
      toast.success("Ticket updated");
      fetchData();
    } catch (error) {
      toast.error("Failed to update ticket");
    }
  }

  async function handleResolveSubmit() {
    if (!resolutionReason.trim()) {
      toast.error("Please enter a valid reason to resolve");
      return;
    }

    try {
      await api.patch(`/support/admin/tickets/${resolvingTicketId}`, { 
        status: "RESOLVED", 
        resolution: resolutionReason 
      }, getAuthHeaders());
      
      toast.success("Ticket resolved");
      setResolvingTicketId(null);
      setResolutionReason("");
      fetchData();
    } catch (error) {
      toast.error("Failed to resolve ticket");
    }
  }

  if (loading) return <div className="p-4 opacity-50">Loading support data...</div>;

  return (
    <div className="mt-6 space-y-6">
      {/* Tabs Header */}
      <div className="flex border-b mb-6" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setActiveTab("tickets")}
          className={`px-6 py-3 font-semibold transition border-b-2 text-sm cursor-pointer ${
            activeTab === "tickets"
              ? "border-accent text-accent font-bold"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
          style={activeTab === "tickets" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
        >
          🎫 Support Tickets
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          className={`px-6 py-3 font-semibold transition border-b-2 text-sm cursor-pointer ${
            activeTab === "chats"
              ? "border-accent text-accent font-bold"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
          style={activeTab === "chats" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
        >
          💬 Active Chats
        </button>
      </div>

      {activeTab === "tickets" && (
        <div className="theme-card rounded-2xl p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Support Tickets</h2>
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Ticket #</th>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Type</th>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Description</th>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Status</th>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Date</th>
                  <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center opacity-50 text-sm">No tickets found.</td></tr>
                ) : (
                  tickets.map(ticket => (
                    <tr key={ticket.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-4 text-xs font-bold text-left">
                        <div>{ticket.ticket_number}</div>
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5" title={ticket.email || ticket.username}>
                          {ticket.email || ticket.username || `User #${ticket.user_id}`}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs">{ticket.issue_type}</td>
                      <td className="px-3 py-4 text-xs max-w-[200px] truncate" title={ticket.description}>{ticket.description}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ticket.status === 'OPEN' ? 'text-amber-500 border-amber-500/30' : ticket.status === 'RESOLVED' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-xs opacity-70">{new Date(ticket.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-4 text-xs">
                        {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                          <div className="flex gap-2">
                            <button onClick={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')} className="text-blue-500 hover:underline">Progress</button>
                            <button onClick={() => updateTicketStatus(ticket.id, 'RESOLVED')} className="text-emerald-500 hover:underline">Resolve</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resolvingTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border p-6 shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <h3 className="text-xl font-bold">Resolve Ticket</h3>
            <p className="mt-1 text-sm opacity-70">Enter a resolution message for the user.</p>
            
            <textarea
              className="mt-4 w-full rounded-2xl border p-4 text-sm outline-none transition focus:ring-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              rows={4}
              placeholder="Enter resolution reason..."
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setResolvingTicketId(null); setResolutionReason(""); }}
                className="flex-1 rounded-2xl border py-3 font-semibold transition hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSubmit}
                className="flex-1 rounded-2xl bg-emerald-500 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "chats" && (
        <div className="theme-card rounded-2xl p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Active Chats</h2>
          <div className="grid gap-3">
            {users.length === 0 ? (
              <div className="text-sm opacity-50">No active chats.</div>
            ) : (
              users.map(u => (
                <div key={u.user_id} className="flex justify-between items-center p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <div className="font-bold">{u.email} {u.unread_count > 0 && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{u.unread_count} new</span>}</div>
                    <div className="text-xs opacity-70 truncate max-w-sm">{u.last_message}</div>
                  </div>
                  <button 
                    onClick={() => { setSelectedChatUser(u); setIsChatModalOpen(true); }} 
                    className="text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    Reply
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <AdminChatModal 
        isOpen={isChatModalOpen} 
        onClose={() => { setIsChatModalOpen(false); setSelectedChatUser(null); fetchData(); }} 
        user={selectedChatUser} 
      />
    </div>
  );
}

export default SupportManagementAdmin;
