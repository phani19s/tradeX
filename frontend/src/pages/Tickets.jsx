import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    try {
      const response = await api.get("/support/tickets", getAuthHeaders());
      setTickets(response.data);
    } catch (error) {
      console.error("Failed to load tickets:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusStyle(status) {
    switch (status) {
      case "OPEN": return "bg-amber-500/15 text-amber-500";
      case "IN_PROGRESS": return "bg-blue-500/15 text-blue-500";
      case "RESOLVED": return "bg-emerald-500/15 text-emerald-500";
      case "CLOSED": return "bg-slate-500/15 text-slate-500";
      default: return "bg-slate-500/15 text-slate-500";
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />
      
      <div className="theme-main px-4 py-8 md:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Help & Support</p>
              <h1 className="mt-3 text-4xl font-black">My Tickets</h1>
            </div>
            <Link 
              to="/profile" 
              className="px-4 py-2 rounded-xl text-sm font-bold border transition hover:opacity-80"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              Back to Profile
            </Link>
          </div>

          <div className="rounded-[28px] border overflow-hidden shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            {loading ? (
              <div className="p-10 text-center opacity-60">Loading your tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="p-10 text-center opacity-60">You haven't raised any support tickets yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Ticket #</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Issue Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Description</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id} className="border-b last:border-0 hover:bg-white/5 transition" style={{ borderColor: "var(--border)" }}>
                      <td className="px-6 py-4 font-bold">{ticket.ticket_number}</td>
                      <td className="px-6 py-4">{ticket.issue_type}</td>
                      <td className="px-6 py-4 text-sm max-w-[200px] truncate" title={ticket.description}>{ticket.description}</td>
                      <td className="px-6 py-4 text-sm opacity-80">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${getStatusStyle(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link 
                          to={`/profile/tickets/${ticket.id}`}
                          className="text-accent hover:underline text-sm font-bold"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tickets;
