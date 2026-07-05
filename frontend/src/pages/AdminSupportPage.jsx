import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";
import AdminChatModal from "../components/AdminChatModal";
import ConfirmDialog from "../components/ConfirmDialog";

function AdminSupportPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chats"); // "chats", "tickets", or "feedback"

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

  // Feedback states
  const [feedbacks, setFeedbacks] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState(""); // "" (All), "Pending", "Resolved"
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [feedbackDeleteConfirmId, setFeedbackDeleteConfirmId] = useState(null);

  // Fetch all tab data on initial mount to populate the unread/pending counts
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    fetchChatUsers();
    fetchTickets();
    fetchFeedbacks();
  }, [navigate]);

  // Tab switch refetch (skip initial load duplicate query using useRef)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (activeTab === "chats") {
      fetchChatUsers();
    } else if (activeTab === "tickets") {
      fetchTickets();
    } else if (activeTab === "feedback") {
      fetchFeedbacks();
    }
  }, [activeTab]);

  // Debounced search for feedback
  useEffect(() => {
    if (activeTab !== "feedback") return;
    const delayDebounce = setTimeout(() => {
      fetchFeedbacks();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [feedbackSearch, feedbackStatusFilter]);

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

  // Feedback API call
  async function fetchFeedbacks() {
    try {
      setLoadingFeedback(true);
      const params = {};
      if (feedbackStatusFilter) params.status = feedbackStatusFilter;
      if (feedbackSearch) params.search = feedbackSearch;

      const res = await api.get("/feedback/admin", {
        ...getAuthHeaders(),
        params
      });
      setFeedbacks(res.data);
    } catch (error) {
      console.error("Failed to fetch feedbacks", error);
      toast.error("Failed to load feedback logs");
    } finally {
      setLoadingFeedback(false);
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

  // Feedback resolution
  async function handleFeedbackResolve(id) {
    try {
      const res = await api.patch(`/feedback/admin/${id}/resolve`, {}, getAuthHeaders());
      toast.success("Feedback marked as resolved");
      setFeedbacks(prev => prev.map(f => f.id === id ? res.data : f));
      if (selectedFeedback && selectedFeedback.id === id) {
        setSelectedFeedback(res.data);
      }
    } catch (error) {
      console.error("Failed to resolve feedback", error);
      toast.error("Failed to resolve feedback");
    }
  }

  // Feedback deletion
  async function handleFeedbackDeleteConfirm() {
    if (!feedbackDeleteConfirmId) return;
    try {
      await api.delete(`/feedback/admin/${feedbackDeleteConfirmId}`, getAuthHeaders());
      toast.success("Feedback deleted successfully");
      setFeedbacks(prev => prev.filter(f => f.id !== feedbackDeleteConfirmId));
      if (selectedFeedback && selectedFeedback.id === feedbackDeleteConfirmId) {
        setSelectedFeedback(null);
      }
    } catch (error) {
      console.error("Failed to delete feedback", error);
      toast.error("Failed to delete feedback");
    } finally {
      setFeedbackDeleteConfirmId(null);
    }
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  const unreadChatsCount = (users || []).reduce((acc, u) => acc + (u.unread_count || 0), 0);
  const unreadTicketsCount = (tickets || []).filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const unreadFeedbackCount = (feedbacks || []).filter(f => f.status === "Pending").length;

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main p-5 space-y-6">
        {/* Support Header */}
        <div className="theme-card rounded-2xl p-6 shadow">
          <h1 className="text-4xl font-bold">Support & Feedback Center</h1>
          <p className="mt-2 opacity-70">
            Address customer tickets, engage in live conversations, and manage user feedback in one unified panel.
          </p>

          {/* Combined Tabs */}
          <div className="flex border-b mt-6" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setActiveTab("chats")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "chats"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "chats" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Active Chats
              {unreadChatsCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center">
                  {unreadChatsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "tickets"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "tickets" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Support Tickets
              {unreadTicketsCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center">
                  {unreadTicketsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "feedback"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "feedback" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              User Feedback
              {unreadFeedbackCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full flex items-center justify-center">
                  {unreadFeedbackCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chats Tab content */}
        {activeTab === "chats" && (
          <div className="theme-card rounded-2xl p-6 shadow animate-in fade-in duration-200">
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
          <div className="theme-card rounded-2xl p-6 shadow animate-in fade-in duration-200">
            {loadingTickets ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                <span className="ml-3 font-semibold">Loading support tickets...</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full min-w-[700px]">
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
                          <td className="px-4 py-4 text-sm font-bold">
                            <div>{ticket.ticket_number}</div>
                            <div className="text-[10px] text-gray-400 font-normal mt-1" title={ticket.email || ticket.username}>
                              {ticket.email || ticket.username || `User #${ticket.user_id}`}
                            </div>
                          </td>
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
                                  className="text-sky-400 hover:underline cursor-pointer font-bold animate-in fade-in"
                                >
                                  Progress
                                </button>
                                <button
                                  onClick={() => updateTicketStatus(ticket.id, 'RESOLVED')}
                                  className="text-emerald-400 hover:underline cursor-pointer font-bold animate-in fade-in"
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

        {/* Feedback Tab content */}
        {activeTab === "feedback" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Controls: Search and Filters */}
            <div className="theme-card rounded-2xl p-6 shadow flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:max-w-md">
                <input
                  type="text"
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  placeholder="Search by user name, email, or subject..."
                  className="w-full rounded-2xl border px-4 py-3 outline-none text-sm"
                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                />
              </div>
              
              <div className="w-full md:w-auto flex gap-4">
                <select
                  value={feedbackStatusFilter}
                  onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                  className="w-full md:w-[180px] rounded-2xl border px-4 py-3 outline-none text-sm"
                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Resolved">Resolved</option>
                </select>
                
                <button
                  onClick={() => { setFeedbackSearch(""); setFeedbackStatusFilter(""); }}
                  className="px-4 py-3 rounded-2xl font-bold border text-sm transition hover:opacity-80 cursor-pointer"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* List */}
            <div className="theme-card rounded-2xl p-6 shadow">
              {loadingFeedback ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                  <span className="ml-3 font-semibold">Loading feedback logs...</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">User</th>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Email</th>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Subject</th>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Submitted Date</th>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {feedbacks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center opacity-50 text-sm">
                            No feedback logs found matching filters.
                          </td>
                        </tr>
                      ) : (
                        feedbacks.map(item => (
                          <tr key={item.id} className="hover:bg-surface/10 transition animate-in fade-in duration-200">
                            <td className="px-4 py-4 text-sm font-bold">{item.user?.username}</td>
                            <td className="px-4 py-4 text-sm">{item.user?.email}</td>
                            <td className="px-4 py-4 text-sm max-w-[220px] truncate" title={item.subject}>
                              {item.subject}
                            </td>
                            <td className="px-4 py-4 text-sm opacity-80">{formatDateTime(item.created_at)}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                item.status === 'Pending'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm">
                              <div className="flex gap-4">
                                <button
                                  onClick={() => setSelectedFeedback(item)}
                                  className="text-accent hover:underline font-semibold cursor-pointer"
                                >
                                  Details
                                </button>
                                {item.status === 'Pending' && (
                                  <button
                                    onClick={() => handleFeedbackResolve(item.id)}
                                    className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                                  >
                                    Resolve
                                  </button>
                                )}
                                <button
                                  onClick={() => setFeedbackDeleteConfirmId(item.id)}
                                  className="text-rose-500 hover:underline font-semibold cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

      {/* Details View Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold mb-2 ${
                  selectedFeedback.status === 'Pending'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  {selectedFeedback.status}
                </span>
                <h3 className="text-2xl font-black">{selectedFeedback.subject}</h3>
              </div>
              <button 
                onClick={() => setSelectedFeedback(null)}
                className="text-lg font-bold opacity-60 hover:opacity-100 transition p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 border-y py-4" style={{ borderColor: "var(--border)" }}>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="opacity-60 text-xs font-semibold uppercase">Submitted By</p>
                  <p className="font-bold mt-0.5">{selectedFeedback.user?.username}</p>
                </div>
                <div>
                  <p className="opacity-60 text-xs font-semibold uppercase">Email Address</p>
                  <p className="font-bold mt-0.5">{selectedFeedback.user?.email}</p>
                </div>
                <div className="col-span-2 mt-2">
                  <p className="opacity-60 text-xs font-semibold uppercase">Submitted On</p>
                  <p className="font-bold mt-0.5">{formatDateTime(selectedFeedback.created_at)}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="opacity-60 text-xs font-semibold uppercase mb-1">Feedback Message</p>
                <div 
                  className="p-4 rounded-2xl border text-sm max-h-[220px] overflow-y-auto whitespace-pre-wrap leading-relaxed"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  {selectedFeedback.message}
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <div>
                {selectedFeedback.status === 'Pending' && (
                  <button
                    onClick={() => handleFeedbackResolve(selectedFeedback.id)}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-sm transition hover:bg-emerald-600 shadow-md cursor-pointer"
                  >
                    Mark as Resolved
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { 
                    setFeedbackDeleteConfirmId(selectedFeedback.id); 
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-rose-500 text-white font-bold text-sm transition hover:bg-rose-600 shadow-md cursor-pointer"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="px-5 py-2.5 rounded-2xl border font-bold text-sm transition hover:opacity-85 cursor-pointer"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={feedbackDeleteConfirmId !== null}
        title="Delete Feedback"
        message="Are you sure you want to permanently delete this feedback? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleFeedbackDeleteConfirm}
        onCancel={() => setFeedbackDeleteConfirmId(null)}
      />
    </div>
  );
}

export default AdminSupportPage;
