import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  async function fetchTicket() {
    try {
      const response = await api.get(`/support/tickets/${id}`, getAuthHeaders());
      setTicket(response.data);
    } catch (error) {
      console.error("Failed to load ticket:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-bg min-h-screen">
        <Navbar />
        <div className="text-center mt-20">Loading ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="page-bg min-h-screen">
        <Navbar />
        <div className="text-center mt-20 text-red-500">Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />
      
      <div className="theme-main px-4 py-8 md:px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Ticket Details</p>
              <h1 className="mt-3 text-4xl font-black">{ticket.ticket_number}</h1>
            </div>
            <Link 
              to="/profile/tickets" 
              className="px-4 py-2 rounded-xl text-sm font-bold border transition hover:opacity-80"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              Back to Tickets
            </Link>
          </div>

          <div className="rounded-[28px] border p-8 shadow-xl space-y-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Status</p>
                <p className="font-bold text-accent">{ticket.status}</p>
              </div>
              <div>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Issue Type</p>
                <p className="font-bold">{ticket.issue_type}</p>
              </div>
              <div>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Date Created</p>
                <p className="font-bold">{new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-1">Related Txn</p>
                <p className="font-bold">{ticket.transaction_type ? `${ticket.transaction_type} #${ticket.transaction_id}` : "N/A"}</p>
              </div>
            </div>

            <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-3">Description</p>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 whitespace-pre-wrap">
                {ticket.description}
              </div>
            </div>

            {ticket.resolution && (
              <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider mb-3 text-emerald-500">Resolution / Admin Reply</p>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 whitespace-pre-wrap text-emerald-500">
                  {ticket.resolution}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketDetail;
