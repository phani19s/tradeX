import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";
import ConfirmDialog from "../components/ConfirmDialog";
import { useTheme } from "../context/ThemeContext";

function AdminFeedbackPage() {
  const navigate = useNavigate();
  const { accentColor } = useTheme();
  
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" (All), "Pending", "Resolved"
  
  const [selectedFeedback, setSelectedFeedback] = useState(null); // for details modal
  const [deleteConfirmId, setDeleteConfirmId] = useState(null); // for delete dialog

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    fetchFeedbacks();
  }, [navigate]);

  // Refetch when search/filter changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchFeedbacks();
    }, 300); // Debounce search
    return () => clearTimeout(delayDebounce);
  }, [search, statusFilter]);

  async function fetchFeedbacks() {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get("/feedback/admin", {
        ...getAuthHeaders(),
        params
      });
      setFeedbacks(res.data);
    } catch (error) {
      console.error("Failed to fetch feedbacks", error);
      toast.error("Failed to load feedback logs");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id) {
    try {
      const res = await api.patch(`/feedback/admin/${id}/resolve`, {}, getAuthHeaders());
      toast.success("Feedback marked as resolved");
      
      // Update local state
      setFeedbacks(prev => prev.map(f => f.id === id ? res.data : f));
      if (selectedFeedback && selectedFeedback.id === id) {
        setSelectedFeedback(res.data);
      }
    } catch (error) {
      console.error("Failed to resolve feedback", error);
      toast.error("Failed to resolve feedback");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmId) return;
    try {
      await api.delete(`/feedback/admin/${deleteConfirmId}`, getAuthHeaders());
      toast.success("Feedback deleted successfully");
      setFeedbacks(prev => prev.filter(f => f.id !== deleteConfirmId));
      if (selectedFeedback && selectedFeedback.id === deleteConfirmId) {
        setSelectedFeedback(null);
      }
    } catch (error) {
      console.error("Failed to delete feedback", error);
      toast.error("Failed to delete feedback");
    } finally {
      setDeleteConfirmId(null);
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

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main p-5">
        
        {/* Header section */}
        <div className="theme-card rounded-2xl p-6 shadow mb-6">
          <h1 className="text-4xl font-black">Feedback Management</h1>
          <p className="mt-2 opacity-70">
            Review user-submitted suggestions, experience reports, and feedback. Mark items as resolved or delete them.
          </p>
        </div>

        {/* Controls: Search and Filters */}
        <div className="theme-card rounded-2xl p-6 shadow mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user name, email, or subject..."
              className="w-full rounded-2xl border px-4 py-3 outline-none text-sm"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            />
          </div>
          
          <div className="w-full md:w-auto flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-[180px] rounded-2xl border px-4 py-3 outline-none text-sm"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
            </select>
            
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="px-4 py-3 rounded-2xl font-bold border text-sm transition hover:opacity-80"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Feedback List Card */}
        <div className="theme-card rounded-2xl p-6 shadow">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor || "var(--accent)" }}></div>
              <span className="ml-3 font-semibold">Loading feedback logs...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
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
                      <tr key={item.id} className="hover:bg-surface/10 transition">
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
                              style={{ color: accentColor || "var(--accent)" }}
                            >
                              Details
                            </button>
                            {item.status === 'Pending' && (
                              <button
                                onClick={() => handleResolve(item.id)}
                                className="text-emerald-500 hover:underline font-semibold cursor-pointer"
                              >
                                Resolve
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
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

      {/* Details View Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl space-y-6"
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
                className="text-lg font-bold opacity-60 hover:opacity-100 transition p-1"
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
                    onClick={() => handleResolve(selectedFeedback.id)}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 text-white font-bold text-sm transition hover:bg-emerald-600 shadow-md"
                  >
                    Mark as Resolved
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { 
                    setDeleteConfirmId(selectedFeedback.id); 
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-rose-500 text-white font-bold text-sm transition hover:bg-rose-600 shadow-md"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="px-5 py-2.5 rounded-2xl border font-bold text-sm transition hover:opacity-85"
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
        isOpen={deleteConfirmId !== null}
        title="Delete Feedback"
        message="Are you sure you want to permanently delete this feedback? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

export default AdminFeedbackPage;
