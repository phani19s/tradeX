import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

export default function AdminAuditLogsPage() {
  const navigate = useNavigate();

  // Authentication protection
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
    }
  }, [navigate]);

  // States
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState({ csv: false, excel: false, pdf: false });
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Lists for dropdown options
  const [adminsList, setAdminsList] = useState([]);
  const [modulesList, setModulesList] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [statusesList, setStatusesList] = useState([]);

  // Fetch Logs
  async function fetchLogs(customParams = {}) {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      const s = customParams.hasOwnProperty('search') ? customParams.search : search;
      const sd = customParams.hasOwnProperty('startDate') ? customParams.startDate : startDate;
      const ed = customParams.hasOwnProperty('endDate') ? customParams.endDate : endDate;
      const adm = customParams.hasOwnProperty('selectedAdminId') ? customParams.selectedAdminId : selectedAdminId;
      const mod = customParams.hasOwnProperty('selectedModule') ? customParams.selectedModule : selectedModule;
      const act = customParams.hasOwnProperty('selectedAction') ? customParams.selectedAction : selectedAction;
      const stat = customParams.hasOwnProperty('selectedStatus') ? customParams.selectedStatus : selectedStatus;
      const st = customParams.hasOwnProperty('sort') ? customParams.sort : sort;
      const p = customParams.hasOwnProperty('page') ? customParams.page : page;

      if (s) params.append("search", s);
      if (sd) params.append("start_date", sd);
      if (ed) params.append("end_date", ed);
      if (adm) params.append("admin_id", adm);
      if (mod) params.append("module", mod);
      if (act) params.append("action", act);
      if (stat) params.append("status", stat);
      params.append("sort", st);
      params.append("page", p.toString());
      params.append("limit", limit.toString());

      const res = await api.get(`/admin/audit-logs?${params.toString()}`, getAuthHeaders());
      setLogs(res.data?.logs || []);
      setTotalCount(res.data?.total_count || 0);
      
      // Populate lists for dropdown filters if they are not loaded yet
      if (res.data?.filters) {
        setAdminsList(res.data.filters.admins || []);
        setModulesList(res.data.filters.modules || []);
        setActionsList(res.data.filters.actions || []);
        setStatusesList(res.data.filters.statuses || []);
      }
    } catch (error) {
      console.error("Failed to load audit logs", error);
      toast.error(error.response?.data?.detail || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  // Trigger search on page change
  useEffect(() => {
    fetchLogs();
  }, [page]);

  // Handle Search/Date Submit
  function handleShowAudits(e) {
    if (e) e.preventDefault();
    setPage(1);
    fetchLogs({ page: 1 });
  }

  // Reset Filters
  function handleResetFilters() {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setSelectedAdminId("");
    setSelectedModule("");
    setSelectedAction("");
    setSelectedStatus("");
    setSort("newest");
    setPage(1);
    fetchLogs({
      search: "",
      startDate: "",
      endDate: "",
      selectedAdminId: "",
      selectedModule: "",
      selectedAction: "",
      selectedStatus: "",
      sort: "newest",
      page: 1
    });
  }

  // Export File (PDF, Excel, CSV)
  async function handleExport(format) {
    try {
      setExporting((prev) => ({ ...prev, [format]: true }));
      const payload = {
        format,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        admin_id: selectedAdminId ? Number(selectedAdminId) : undefined,
        module: selectedModule || undefined,
        action: selectedAction || undefined,
        status: selectedStatus || undefined,
        sort,
      };

      const res = await api.post("/admin/audit-logs/export", payload, {
        responseType: "blob",
        ...getAuthHeaders(),
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const fileExt = format === "excel" ? "xls" : format;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `tradex_audit_logs_${dateStr}.${fileExt}`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} audit logs exported successfully`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to export audit logs as ${format.toUpperCase()}`);
    } finally {
      setExporting((prev) => ({ ...prev, [format]: false }));
    }
  }

  // Helper styles
  function getStatusStyle(status) {
    const normalized = String(status || "Success").toLowerCase();
    if (normalized === "success") {
      return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25";
    }
    return "bg-rose-500/15 text-rose-500 border border-rose-500/25";
  }

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5 max-w-7xl mx-auto space-y-6">
        
        {/* Card Header */}
        <div className="theme-card rounded-2xl p-6 shadow border" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold flex items-center gap-2">
                📋 Audit Logs
              </h1>
              <p className="mt-2 opacity-75 text-sm max-w-2xl">
                Track, audit, and analyze system actions taken by administrators. This log is append-only to maintain system security compliance and record integrity.
              </p>
            </div>
            
            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={exporting.csv}
                onClick={() => handleExport("csv")}
                className="rounded-xl px-4 py-2 text-xs font-bold border transition hover:bg-black/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                📥 {exporting.csv ? "Exporting..." : "Export CSV"}
              </button>
              <button
                disabled={exporting.excel}
                onClick={() => handleExport("excel")}
                className="rounded-xl px-4 py-2 text-xs font-bold border transition hover:bg-black/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                📊 {exporting.excel ? "Exporting..." : "Export Excel"}
              </button>
              <button
                disabled={exporting.pdf}
                onClick={() => handleExport("pdf")}
                className="rounded-xl px-4 py-2 text-xs font-bold border transition hover:bg-black/5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                📕 {exporting.pdf ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="theme-card rounded-2xl p-5 shadow border space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
          
          <form onSubmit={handleShowAudits} className="grid gap-3 grid-cols-1 sm:grid-cols-3 md:grid-cols-5 items-end">
            
            {/* Search Input */}
            <div className="sm:col-span-2 md:col-span-2">
              <label className="text-xs font-bold opacity-75 mb-1.5 block">Search Logs</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search admin, email, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
            </div>

            {/* Show Audits Button */}
            <div>
              <button
                type="submit"
                className="w-full rounded-xl border px-4 py-2 text-sm font-bold bg-accent text-white hover:bg-accent/90 cursor-pointer transition h-[38px] flex items-center justify-center gap-1"
                style={{ background: "var(--accent)", color: "white" }}
              >
                🔎 Show Audits
              </button>
            </div>

          </form>

          {/* More Filters Row */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-5">
            
            {/* Admin Select */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1 block">Administrator</label>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full rounded-xl border px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <option value="">All Admins</option>
                {adminsList.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.username} ({admin.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Module Select */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1 block">Module</label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="w-full rounded-xl border px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <option value="">All Modules</option>
                {modulesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Select */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1 block">Action Type</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full rounded-xl border px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <option value="">All Actions</option>
                {actionsList.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div>
              <label className="text-xs font-bold opacity-75 mb-1 block">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-xl border px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <option value="">All Statuses</option>
                {statusesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className="col-span-2 sm:col-span-4 md:col-span-1 flex items-end gap-2">
              <div className="w-full">
                <label className="text-xs font-bold opacity-75 mb-1 block">Sort</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full rounded-xl border px-2 py-2 text-xs focus:outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
              
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-xl border px-3 py-2 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 cursor-pointer h-[34px] flex items-center justify-center transition"
                style={{ borderColor: "rgba(239, 68, 68, 0.25)" }}
              >
                Reset
              </button>
            </div>

          </div>

        </div>

        {/* Audit Logs Table */}
        <div className="theme-card rounded-2xl p-5 shadow border relative" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
          
          {loading ? (
            <div className="py-24 flex flex-col justify-center items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: "var(--accent)" }} />
              <p className="text-sm opacity-70 font-semibold animate-pulse">Retrieving system logs...</p>
            </div>
          ) : (logs || []).length === 0 ? (
            <div className="py-16 text-center opacity-60">
              <span className="text-4xl block mb-2">🔍</span>
              <p className="text-sm font-semibold">No audit logs found matching criteria.</p>
              <p className="text-xs mt-1">Try modifying your search text, filtering options, or date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65 pl-2">Timestamp</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65">Admin User</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65">Action</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65">Module</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65">IP Address</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65">Status</th>
                    <th className="pb-3 font-extrabold uppercase tracking-wider text-xs opacity-65 text-right pr-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-solid" style={{ divideColor: "var(--border)" }}>
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-black/5 transition">
                      <td className="py-4.5 pl-2 font-medium whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </td>
                      <td className="py-4.5 whitespace-nowrap">
                        <div className="font-bold">{log.admin_name}</div>
                        <div className="text-xs opacity-60">{log.admin_email}</div>
                      </td>
                      <td className="py-4.5 font-semibold whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-4.5">
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                          {log.module}
                        </span>
                      </td>
                      <td className="py-4.5 font-mono text-xs whitespace-nowrap">
                        {log.ip_address || "None"}
                      </td>
                      <td className="py-4.5 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${getStatusStyle(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-4.5 text-right pr-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && (logs || []).length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div className="text-sm opacity-70">
                Showing {Math.min((page - 1) * limit + 1, totalCount)} to {Math.min(page * limit, totalCount)} of {totalCount} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-50 hover:bg-black/5 transition cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  First
                </button>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-50 hover:bg-black/5 transition cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 text-xs font-bold rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {page} / {Math.ceil(totalCount / limit) || 1}
                </span>
                <button
                  disabled={page >= Math.ceil(totalCount / limit)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-50 hover:bg-black/5 transition cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Next
                </button>
                <button
                  disabled={page >= Math.ceil(totalCount / limit)}
                  onClick={() => setPage(Math.ceil(totalCount / limit))}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-50 hover:bg-black/5 transition cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Last
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden animate-fade-in"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider mb-1.5 inline-block ${getStatusStyle(selectedLog.status)}`}>
                  {selectedLog.status}
                </span>
                <h3 className="text-xl font-extrabold">Audit Log Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-2xl font-bold opacity-60 hover:opacity-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Event & Module */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase font-extrabold opacity-60">Action Event</p>
                  <p className="font-bold text-base mt-0.5">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-extrabold opacity-60">System Module</p>
                  <p className="font-bold text-base mt-0.5">{selectedLog.module}</p>
                </div>
              </div>

              {/* Administrator Details */}
              <div className="border rounded-2xl p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-xs uppercase font-extrabold opacity-60">Administrator</p>
                <div className="flex justify-between items-center mt-1.5">
                  <div>
                    <p className="font-extrabold text-sm">{selectedLog.admin_name}</p>
                    <p className="text-xs opacity-70 mt-0.5">{selectedLog.admin_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-60 font-mono">ID: {selectedLog.admin_id}</p>
                  </div>
                </div>
              </div>

              {/* IP and Device */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase font-extrabold opacity-60">IP Address</p>
                  <p className="font-mono text-sm mt-0.5">{selectedLog.ip_address || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-extrabold opacity-60">Device / Browser</p>
                  <p className="text-sm font-semibold mt-0.5">{selectedLog.device_browser}</p>
                </div>
              </div>

              {/* Description Details */}
              <div>
                <p className="text-xs uppercase font-extrabold opacity-60 mb-1.5">Action Description</p>
                <div className="rounded-2xl border p-4 font-semibold text-sm leading-relaxed" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {selectedLog.details || "No description provided."}
                </div>
              </div>

              {/* Log ID & Timestamp */}
              <div className="flex justify-between items-center text-xs opacity-50 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <span>Log Record ID: #{selectedLog.id}</span>
                <span>Captured: {new Date(selectedLog.timestamp).toLocaleString("en-IN")}</span>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-4 border-t gap-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-2xl border px-6 py-2.5 text-xs font-bold hover:bg-black/5 transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
