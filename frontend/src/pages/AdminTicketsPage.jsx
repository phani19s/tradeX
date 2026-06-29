import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";

function AdminTicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingTicketId, setResolvingTicketId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    console.log("AdminTicketsPage: user is_admin:", user?.is_admin);
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    fetchTickets();
  }, [navigate]);

  async function fetchTickets() {
    try {
      console.log("AdminTicketsPage: Fetching tickets...");
      setLoading(true);
      const res = await api.get("/support/admin/tickets", getAuthHeaders());
      console.log("AdminTicketsPage: Fetched tickets successfully", res.data);
      setTickets(res.data);
    } catch (error) {
      console.error("AdminTicketsPage: Failed to fetch tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      console.log("AdminTicketsPage: Done loading");
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
      fetchTickets();
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
      fetchTickets();
    } catch (error) {
      toast.error("Failed to resolve ticket");
    }
  }

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5">
        <div className="theme-card rounded-2xl p-6 shadow mb-6">
          <h1 className="text-4xl font-bold">Support Tickets</h1>
          <p className="mt-2 opacity-70">
            View, progress, and resolve user raised support requests.
          </p>
        </div>

        <div className="theme-card rounded-2xl p-6 shadow">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
              <span className="ml-3 font-semibold">Loading tickets...</span>
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
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Action</th>
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
                      <tr key={ticket.id} className="hover:bg-surface/10 transition">
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
                        <td className="px-4 py-4 text-sm">
                          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
                            <div className="flex gap-3">
                              <button
                                onClick={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                                className="text-blue-500 hover:underline cursor-pointer font-semibold"
                              >
                                Progress
                              </button>
                              <button
                                onClick={() => updateTicketStatus(ticket.id, 'RESOLVED')}
                                className="text-emerald-500 hover:underline cursor-pointer font-semibold"
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
      </div>

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

export default AdminTicketsPage;
