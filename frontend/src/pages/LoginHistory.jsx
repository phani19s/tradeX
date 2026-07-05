/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import {
  formatBrowser,
  formatDevice,
  formatDuration,
  formatSecurityDate,
  getStatusClass,
} from "../utils/device";

function getLoginStatus(item) {
  return item.status === "Failed" ? "Failed" : "Success";
}

function getSessionStatus(item) {
  if (item.status === "Failed") return "-";
  if (String(item.status || "").toLowerCase().includes("expired")) return "Session Expired";
  if (item.logout_time || item.status === "Logout") return "Logout";
  return "Active";
}

function isEndedSession(item) {
  const status = getSessionStatus(item);
  return status === "Logout" || status === "Session Expired";
}

function getSessionStatusClass(status) {
  if (status === "Logout") {
    return "bg-rose-500/15 text-rose-500 border-rose-500/20";
  }

  return getStatusClass(status);
}

function getEndedSessionDuration(item) {
  if (!item.login_time || !item.logout_time) return 0;

  const loginTime = new Date(item.login_time).getTime();
  const logoutTime = new Date(item.logout_time).getTime();

  if (Number.isNaN(loginTime) || Number.isNaN(logoutTime)) {
    return 0;
  }

  return Math.floor(Math.abs(logoutTime - loginTime) / 1000);
}

function LoginHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  async function fetchHistory() {
    try {
      const response = await api.get("/login-history/", getAuthHeaders());
      setHistory(response.data);
    } catch (error) {
      console.error("Failed to fetch login history:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return history.filter((item) => {
      const statusMatches =
        statusFilter === "ALL" ||
        getLoginStatus(item) === statusFilter ||
        getSessionStatus(item) === statusFilter;
      const searchable = [
        formatDevice(item.device, item.browser),
        formatBrowser(item.device, item.browser),
        item.ip_address,
        item.location,
      ].join(" ").toLowerCase();

      return statusMatches && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [history, search, statusFilter]);

  const totalPages = Math.max(Math.ceil(filteredHistory.length / pageSize), 1);
  const visibleHistory = filteredHistory.slice((page - 1) * pageSize, page * pageSize);

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updateStatus(value) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-8 md:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Security</p>
              <h1 className="mt-3 text-4xl font-black">Login History</h1>
            </div>
            <Link
              to="/profile"
              className="rounded-xl border px-4 py-2 text-sm font-bold transition hover:opacity-80"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              Back to Profile
            </Link>
          </div>

          <div className="rounded-[28px] border p-5 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px]">
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search device, IP, location"
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
              />
              <select
                value={statusFilter}
                onChange={(event) => updateStatus(event.target.value)}
                className="rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
              >
                <option value="ALL">All Status</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="Active">Active</option>
                <option value="Logout">Logout</option>
                <option value="Session Expired">Session Expired</option>
              </select>
            </div>

            {loading ? (
              <div className="p-10 text-center opacity-60">Loading your login activity...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center opacity-60">No login activity has been recorded yet.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border md:block hidden" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-left">
                    <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                      <tr>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Date & Time</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Device</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Browser/App</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">IP Address</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Location</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Login Status</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Session Status</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Logout Time</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Session Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleHistory.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-sm opacity-70">
                            No login activity matches your filters.
                          </td>
                        </tr>
                      ) : visibleHistory.map((item) => {
                        const loginStatus = getLoginStatus(item);
                        const sessionStatus = getSessionStatus(item);
                        const endedSession = isEndedSession(item);

                        return (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-white/5 transition" style={{ borderColor: "var(--border)" }}>
                            <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">{formatSecurityDate(item.login_time)}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm">{formatDevice(item.device, item.browser)}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm">{formatBrowser(item.device, item.browser)}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm">{item.ip_address || "Unknown"}</td>
                            <td className="min-w-[180px] px-4 py-4 text-sm">{item.location || "Unknown Location"}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusClass(loginStatus)}`}>
                                {loginStatus}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {sessionStatus === "-" ? (
                                <span className="text-xs opacity-50">-</span>
                              ) : (
                                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getSessionStatusClass(sessionStatus)}`}>
                                  {sessionStatus}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm">
                              {endedSession ? formatSecurityDate(item.logout_time) : "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-sm">
                              {endedSession ? (
                                formatDuration(getEndedSessionDuration(item))
                              ) : sessionStatus === "Active" ? (
                                <span className="font-bold text-emerald-500">Still Active</span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards for LoginHistory */}
                <div className="block md:hidden space-y-4">
                  {visibleHistory.length === 0 ? (
                    <div className="p-6 text-center text-sm opacity-70 border rounded-3xl" style={{ borderColor: "var(--border)" }}>
                      No login activity matches your filters.
                    </div>
                  ) : (
                    visibleHistory.map((item) => {
                      const loginStatus = getLoginStatus(item);
                      const sessionStatus = getSessionStatus(item);
                      const endedSession = isEndedSession(item);

                      return (
                        <div 
                          key={item.id} 
                          className="p-4 border rounded-3xl space-y-3"
                          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-xs opacity-60 font-semibold">{formatSecurityDate(item.login_time)}</span>
                            <div className="flex gap-1.5">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusClass(loginStatus)}`}>
                                {loginStatus}
                              </span>
                              {sessionStatus !== "-" && (
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getSessionStatusClass(sessionStatus)}`}>
                                  {sessionStatus}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="opacity-60">Device</div>
                              <div className="font-semibold">{formatDevice(item.device, item.browser)}</div>
                            </div>
                            <div>
                              <div className="opacity-60">IP Address</div>
                              <div className="font-mono">{item.ip_address || "Unknown"}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="opacity-60">Location</div>
                              <div>{item.location || "Unknown Location"}</div>
                            </div>
                          </div>
                          {(endedSession || sessionStatus === "Active") && (
                            <div className="pt-2 border-t text-xs flex justify-between" style={{ borderColor: "var(--border)" }}>
                              <span>Duration:</span>
                              {endedSession ? (
                                <span className="font-semibold">{formatDuration(getEndedSessionDuration(item))}</span>
                              ) : (
                                <span className="font-bold text-emerald-500">Still Active</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm opacity-60">
                    Showing {visibleHistory.length} of {filteredHistory.length} entries
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Previous
                    </button>
                    <span className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                      className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginHistory;
