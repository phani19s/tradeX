import { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

export default function TradingMonitor() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // "", "today", "week", "month"
  const [sortBy, setSortBy] = useState("newest"); // "newest", "oldest", "price", "quantity", "value"
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState(null);

  // For debounce search inputs
  const [searchInput, setSearchInput] = useState("");
  const searchTimeoutRef = useRef(null);

  // Fetch trades helper
  async function fetchTrades(silent = false) {
    if (!silent) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
      });
      if (search) queryParams.append("search", search);
      if (dateFilter) queryParams.append("date_filter", dateFilter);

      const response = await api.get(`/admin/trades?${queryParams.toString()}`, getAuthHeaders());
      setTrades(response.data.trades);
      setTotalCount(response.data.total_count);
      setTotalVolume(response.data.total_volume);
      setTotalPages(response.data.pages);
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.detail || "Failed to load trades");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Handle Search Input Debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  // Refetch trades when page, search, dateFilter, or sortBy changes
  useEffect(() => {
    fetchTrades();
  }, [page, search, dateFilter, sortBy]);

  // Periodic polling every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrades(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [page, search, dateFilter, sortBy]);

  // Format currency helper
  function formatCurrency(val) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  }

  // Format Date Helper
  function formatDateTime(valStr) {
    if (!valStr) return "-";
    try {
      const dt = new Date(valStr);
      if (isNaN(dt.getTime())) return "-";
      return dt.toLocaleString();
    } catch {
      return "-";
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Live Trading Monitor</h2>
          <p className="text-sm opacity-70 mt-1">
            Monitor and audit all real-time trading actions on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold opacity-70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live updating in background
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="rounded-[28px] border p-6 shadow-xl flex flex-col justify-between"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div>
            <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Total Trades</span>
            <h3 className="text-4xl font-black mt-2">{totalCount}</h3>
          </div>
          <p className="text-xs opacity-50 mt-4">Number of executed trades matching active filters</p>
        </div>

        <div
          className="rounded-[28px] border p-6 shadow-xl flex flex-col justify-between"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div>
            <span className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Total Trading Volume</span>
            <h3 className="text-4xl font-black mt-2 text-accent" style={{ color: "var(--accent)" }}>
              {formatCurrency(totalVolume)}
            </h3>
          </div>
          <p className="text-xs opacity-50 mt-4">Cumulative value of all trades under current filters</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        className="rounded-[28px] border p-6 shadow-xl"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user name or stock symbol..."
              className="w-full rounded-xl border p-3 pl-10 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
              style={{ borderColor: "var(--border)" }}
            />
            <span className="absolute left-3 top-3.5 opacity-60 text-lg">🔍</span>
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filters */}
            <div className="flex rounded-xl border p-1" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => { setDateFilter(""); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  dateFilter === "" ? "bg-accent text-accent-contrast" : "hover:bg-surface/10 opacity-70"
                }`}
                style={dateFilter === "" ? { backgroundColor: "var(--accent)", color: "var(--accent-contrast)" } : {}}
              >
                All Time
              </button>
              <button
                onClick={() => { setDateFilter("today"); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  dateFilter === "today" ? "bg-accent text-accent-contrast" : "hover:bg-surface/10 opacity-70"
                }`}
                style={dateFilter === "today" ? { backgroundColor: "var(--accent)", color: "var(--accent-contrast)" } : {}}
              >
                Today
              </button>
              <button
                onClick={() => { setDateFilter("week"); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  dateFilter === "week" ? "bg-accent text-accent-contrast" : "hover:bg-surface/10 opacity-70"
                }`}
                style={dateFilter === "week" ? { backgroundColor: "var(--accent)", color: "var(--accent-contrast)" } : {}}
              >
                This Week
              </button>
              <button
                onClick={() => { setDateFilter("month"); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  dateFilter === "month" ? "bg-accent text-accent-contrast" : "hover:bg-surface/10 opacity-70"
                }`}
                style={dateFilter === "month" ? { backgroundColor: "var(--accent)", color: "var(--accent-contrast)" } : {}}
              >
                This Month
              </button>
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="rounded-xl border p-2.5 text-xs font-bold bg-card outline-none cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price">Highest Price</option>
              <option value="quantity">Highest Quantity</option>
              <option value="value">Highest Value</option>
            </select>
          </div>
        </div>

        {/* Table / Lists */}
        <div className="mt-6">
          {loading && trades.length === 0 ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-accent" style={{ borderColor: "var(--accent)" }}></div>
              <span className="ml-3 font-semibold">Loading trades...</span>
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-16 opacity-60">
              <p className="text-lg font-semibold">No trades found</p>
              <p className="text-xs opacity-75 mt-1">Try modifying your search query or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">User</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Type</th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">Price</th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">Total Value</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {trades.map((t) => (
                    <tr key={t.id} className="hover:bg-surface/10 transition">
                      {/* User */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{t.username}</span>
                          <span className="text-xs opacity-60">{t.email}</span>
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded bg-accent-soft text-accent font-bold px-2 py-0.5 text-xs">
                            {t.stock_symbol}
                          </span>
                          <span className="text-sm opacity-80 hidden sm:inline truncate max-w-[120px]">
                            {t.stock_name}
                          </span>
                        </div>
                      </td>

                      {/* Trade Type */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            t.trade_type === "BUY"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          }`}
                        >
                          {t.trade_type}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-4 text-right font-medium text-sm">
                        {t.quantity}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4 text-right font-semibold text-sm">
                        {formatCurrency(t.price)}
                      </td>

                      {/* Total Value */}
                      <td className="px-4 py-4 text-right font-bold text-sm text-accent" style={{ color: "var(--accent)" }}>
                        {formatCurrency(t.total_value)}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-4 text-sm opacity-80">
                        {formatDateTime(t.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-500">
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => setSelectedTrade(t)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-surface/20 cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs opacity-60">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-surface/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-surface/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Side Panel/Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl space-y-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Trade Audit details</span>
                <h3 className="text-2xl font-bold mt-1">Receipt #{selectedTrade.id}</h3>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="p-1 rounded-lg hover:bg-surface border border-transparent transition opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Breakdown Content */}
            <div className="space-y-4 rounded-2xl border p-4 bg-surface/5" style={{ borderColor: "var(--border)" }}>
              {/* Trader Details */}
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-xs opacity-60 uppercase font-black tracking-wider">Trader</p>
                  <p className="font-bold text-sm mt-0.5">{selectedTrade.username}</p>
                </div>
                <p className="text-xs opacity-75 font-mono">{selectedTrade.email}</p>
              </div>

              {/* Stock Details */}
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-xs opacity-60 uppercase font-black tracking-wider">Asset</p>
                  <p className="font-bold text-sm mt-0.5">{selectedTrade.stock_name}</p>
                </div>
                <span className="rounded bg-accent-soft text-accent font-bold px-2 py-0.5 text-xs">
                  {selectedTrade.stock_symbol}
                </span>
              </div>

              {/* Type Details */}
              <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs opacity-60 uppercase font-black tracking-wider">Transaction Type</p>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    selectedTrade.trade_type === "BUY"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  }`}
                >
                  {selectedTrade.trade_type}
                </span>
              </div>

              {/* Quantities & Values */}
              <div className="grid grid-cols-2 gap-4 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-xs opacity-60 uppercase font-black tracking-wider">Quantity</p>
                  <p className="font-bold text-sm mt-0.5">{selectedTrade.quantity} shares</p>
                </div>
                <div>
                  <p className="text-xs opacity-60 uppercase font-black tracking-wider">Unit Price</p>
                  <p className="font-bold text-sm mt-0.5">{formatCurrency(selectedTrade.price)}</p>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold uppercase opacity-85">Total Trade Value</p>
                <p className="text-xl font-black text-accent" style={{ color: "var(--accent)" }}>
                  {formatCurrency(selectedTrade.total_value)}
                </p>
              </div>
            </div>

            {/* Timestamps & Audit */}
            <div className="space-y-2 text-xs opacity-70">
              <div className="flex justify-between">
                <span>Execution Timestamp:</span>
                <span className="font-semibold">{formatDateTime(selectedTrade.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Status:</span>
                <span className="font-semibold text-emerald-500">SETTLED & COMPLETED</span>
              </div>
              {selectedTrade.note && (
                <div className="flex flex-col mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <span>System Note:</span>
                  <span className="font-mono mt-1 p-2 rounded bg-surface/10">{selectedTrade.note}</span>
                </div>
              )}
            </div>

            {/* Footer Close */}
            <button
              onClick={() => setSelectedTrade(null)}
              className="w-full rounded-xl py-3 font-bold text-sm transition hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
