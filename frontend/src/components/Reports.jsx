import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN");
  } catch (e) {
    return isoString;
  }
}

export default function Reports() {
  const [period, setPeriod] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // History state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Exporting state
  const [exporting, setExporting] = useState({
    pdf: false,
    excel: false,
    csv: false
  });

  async function fetchHistory() {
    try {
      setLoadingHistory(true);
      const res = await api.get("/admin/reports/history", getAuthHeaders());
      setHistory(res.data);
    } catch (error) {
      console.error("Failed to fetch report history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  // Generate Preview
  async function handleGeneratePreview(e) {
    e.preventDefault();
    if (period === "custom" && (!startDate || !endDate)) {
      toast.error("Please select both start and end dates");
      return;
    }

    try {
      setGenerating(true);
      setPreviewData(null);

      const queryParams = new URLSearchParams({ period });
      if (period === "custom") {
        queryParams.append("start_date", startDate);
        queryParams.append("end_date", endDate);
      }

      const res = await api.get(`/admin/reports/generate?${queryParams.toString()}`, getAuthHeaders());
      setPreviewData(res.data);
      toast.success("Report preview generated successfully");
      fetchHistory(); // Refresh history
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate system report");
    } finally {
      setGenerating(false);
    }
  }

  // Export File (PDF, Excel, CSV)
  async function handleExport(format) {
    if (!previewData) return;

    try {
      setExporting(prev => ({ ...prev, [format]: true }));
      const payload = {
        format,
        period: previewData.period,
        start_date: period === "custom" ? startDate : undefined,
        end_date: period === "custom" ? endDate : undefined
      };

      const res = await api.post("/admin/reports/export", payload, {
        responseType: "blob",
        ...getAuthHeaders()
      });

      // Handle download stream
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const fileExt = format === "excel" ? "xls" : format;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `tradex_report_${previewData.period}_${dateStr}.${fileExt}`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} report exported successfully`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to export ${format.toUpperCase()} report`);
    } finally {
      setExporting(prev => ({ ...prev, [format]: false }));
    }
  }

  // Preview an entry from history
  function handlePreviewHistory(h) {
    setPreviewData({
      generated_at: h.generated_at,
      generated_by: h.generated_by,
      period: h.report_type.toLowerCase(),
      start_date: h.start_date,
      end_date: h.end_date,
      metrics: h.metrics
    });
    // Sync inputs
    setPeriod(h.report_type.toLowerCase());
    if (h.report_type.toLowerCase() === "custom") {
      setStartDate(h.start_date.slice(0, 10));
      setEndDate(h.end_date.slice(0, 10));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {/* Parameters Selection Card */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <h3 className="text-xl font-bold mb-4">Generate New Report</h3>
        <form onSubmit={handleGeneratePreview} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Report Type Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold block opacity-75">Report Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border focus:outline-none text-sm cursor-pointer"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <option value="daily">Daily Report (Today)</option>
                <option value="weekly">Weekly Report (Last 7 Days)</option>
                <option value="monthly">Monthly Report (Last 30 Days)</option>
                <option value="custom">Custom Period Range</option>
              </select>
            </div>

            {/* Start Date */}
            {period === "custom" && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-xs font-bold block opacity-75">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none text-sm"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            )}

            {/* End Date */}
            {period === "custom" && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-xs font-bold block opacity-75">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border focus:outline-none text-sm"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="md:col-start-4">
              <button
                type="submit"
                disabled={generating}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Report Preview Display */}
      {previewData && (
        <div className="theme-card rounded-2xl p-6 shadow space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Header Info */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-2xl font-black capitalize">{previewData.period} System Audit Report</h2>
              <p className="text-xs opacity-75 mt-1">
                Generated at: <strong>{formatDateTime(previewData.generated_at)}</strong> by admin: <strong>{previewData.generated_by}</strong>
              </p>
              <p className="text-xs opacity-60">
                Data interval evaluated: <strong>{formatDateTime(previewData.start_date)}</strong> to <strong>{formatDateTime(previewData.end_date)}</strong>
              </p>
            </div>

            {/* Export download actions */}
            <div className="flex flex-wrap gap-2">
              {/* PDF Export */}
              <button
                disabled={exporting.pdf}
                onClick={() => handleExport("pdf")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                {exporting.pdf ? "Exporting..." : "Download PDF"}
              </button>

              {/* Excel Export */}
              <button
                disabled={exporting.excel}
                onClick={() => handleExport("excel")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                {exporting.excel ? "Exporting..." : "Download Excel"}
              </button>

              {/* CSV Export */}
              <button
                disabled={exporting.csv}
                onClick={() => handleExport("csv")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                {exporting.csv ? "Exporting..." : "Download CSV"}
              </button>
            </div>
          </div>

          {/* Metrics Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* User Statistics */}
            <div className="p-4 rounded-xl border space-y-2 bg-surface/10" style={{ borderColor: "var(--border)" }}>
              <h4 className="text-xs font-bold opacity-60 uppercase">User Accounts</h4>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black">{previewData.metrics.total_users}</span>
                <span className="text-xs opacity-75">Total Registered</span>
              </div>
              <div className="text-xs space-y-1 opacity-80 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between">
                  <span>Traders:</span>
                  <span className="font-semibold">{previewData.metrics.total_traders}</span>
                </div>
                <div className="flex justify-between">
                  <span>Administrators:</span>
                  <span className="font-semibold">{previewData.metrics.total_administrators}</span>
                </div>
                <div className="flex justify-between">
                  <span>New Registrations:</span>
                  <span className="font-semibold text-sky-400">+{previewData.metrics.new_user_registrations}</span>
                </div>
              </div>
            </div>

            {/* Trading Volume & Activities */}
            <div className="p-4 rounded-xl border space-y-2 bg-surface/10" style={{ borderColor: "var(--border)" }}>
              <h4 className="text-xs font-bold opacity-60 uppercase">Trading Activity</h4>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black">{previewData.metrics.total_trades}</span>
                <span className="text-xs opacity-75">Trades Placed</span>
              </div>
              <div className="text-xs space-y-1 opacity-80 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between">
                  <span>Trading Volume:</span>
                  <span className="font-semibold">₹{formatMoney(previewData.metrics.total_trading_volume)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Alerts:</span>
                  <span className="font-semibold">{previewData.metrics.active_price_alerts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Watchlists:</span>
                  <span className="font-semibold">{previewData.metrics.total_watchlists}</span>
                </div>
              </div>
            </div>

            {/* Deposits Overview */}
            <div className="p-4 rounded-xl border space-y-2 bg-surface/10" style={{ borderColor: "var(--border)" }}>
              <h4 className="text-xs font-bold opacity-60 uppercase">Deposits Audit</h4>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black">₹{formatMoney(previewData.metrics.total_deposits_amount)}</span>
                <span className="text-xs opacity-75">Total Inflow</span>
              </div>
              <div className="text-xs space-y-1 opacity-80 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between">
                  <span>Approved Deposits:</span>
                  <span className="font-semibold">{previewData.metrics.total_deposits_count} approved</span>
                </div>
                <div className="flex justify-between">
                  <span>Open Tickets:</span>
                  <span className="font-semibold">{previewData.metrics.open_support_tickets} open</span>
                </div>
              </div>
            </div>

            {/* Withdrawals & Financial Summary */}
            <div className="p-4 rounded-xl border space-y-2 bg-surface/10" style={{ borderColor: "var(--border)" }}>
              <h4 className="text-xs font-bold opacity-60 uppercase">Financial Summary</h4>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black">₹{formatMoney(previewData.metrics.total_withdrawals_amount)}</span>
                <span className="text-xs opacity-75">Outflow</span>
              </div>
              <div className="text-xs space-y-1 opacity-80 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between">
                  <span>Approved Withdrawals:</span>
                  <span className="font-semibold">{previewData.metrics.total_withdrawals_count} approved</span>
                </div>
                <div className="flex justify-between pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <span>Profit/Loss Summary:</span>
                  <span className={`font-black ${previewData.metrics.profit_loss_summary >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{formatMoney(previewData.metrics.profit_loss_summary)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Reports History Log */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <h3 className="text-xl font-bold mb-4">Report Generation History</h3>
        
        {loadingHistory ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
            <span className="ml-2 text-sm opacity-70">Loading history logs...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 opacity-60 text-sm">
            No previously generated reports found in audit log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] divide-y divide-border">
              <thead>
                <tr className="bg-surface/50 text-left text-xs font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Report Type</th>
                  <th className="px-4 py-3">Date Range Evaluated</th>
                  <th className="px-4 py-3">Generated By</th>
                  <th className="px-4 py-3">Generated Date</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm" style={{ color: "var(--text)" }}>
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs">#{h.id}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent/15 text-accent border border-accent/20">
                        {h.report_type} Report
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs opacity-85 whitespace-nowrap">
                      {new Date(h.start_date).toLocaleDateString()} - {new Date(h.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-xs opacity-75">{h.generated_by}</td>
                    <td className="px-4 py-3.5 text-xs opacity-75 whitespace-nowrap">
                      {formatDateTime(h.generated_at)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handlePreviewHistory(h)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border hover:bg-surface transition cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Preview Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
