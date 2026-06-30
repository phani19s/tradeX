import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";
import Reports from "../components/Reports";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { accentColor } = useTheme();
  const [mainTab, setMainTab] = useState("analytics"); // "analytics", "reports"
  
  const [filter, setFilter] = useState("this_month"); // today, this_week, this_month, custom
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Details modal state
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [activeTab, setActiveTab] = useState("users"); // users, deposits, withdrawals, trades, ai_requests, support_tickets

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin || (user.role !== "Administrator" && user.role !== "Super Administrator")) {
      navigate("/dashboard");
      return;
    }
    fetchAnalytics();
  }, [navigate, filter]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const params = { time_filter: filter };
      if (filter === "custom") {
        if (!startDate || !endDate) {
          toast.error("Please select start and end dates");
          setLoading(false);
          return;
        }
        params.start_date = startDate;
        params.end_date = endDate;
      }
      
      const response = await api.get("/admin/analytics", {
        ...getAuthHeaders(),
        params
      });
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Failed to load analytics data", error);
      toast.error(error.response?.data?.detail || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }

  const exportToCSV = () => {
    if (!analyticsData || !analyticsData.charts) return;
    const headers = [
      "Period", "New Users", "User Growth", "Deposits Amount", "Deposits Count",
      "Withdrawals Amount", "Withdrawals Count", "Trade Volume", "Trade Count",
      "Revenue", "AI Requests", "Support Tickets"
    ];
    const rows = analyticsData.charts.map(c => [
      c.label,
      c.new_users,
      c.user_growth,
      c.deposits_amount,
      c.deposits_count,
      c.withdrawals_amount,
      c.withdrawals_count,
      c.trades_amount,
      c.trades_count,
      c.revenue,
      c.ai_requests,
      c.support_tickets
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tradex_analytics_${filter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (!analyticsData || !analyticsData.charts) return;
    
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Analytics Summary</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <h2>TradeX Analytics Report</h2>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <p>Time Filter: ${filter.toUpperCase()}</p>
        
        <h3>Overall Summary Stats</h3>
        <table border="1">
          <tr style="background:#f2f2f2; font-weight:bold;">
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr><td>Total Registered Users</td><td>${analyticsData.summary.total_users}</td></tr>
          <tr><td>Total Revenue</td><td>₹${analyticsData.summary.total_revenue.toFixed(2)}</td></tr>
          <tr><td>Total Trades</td><td>${analyticsData.summary.total_trades}</td></tr>
          <tr><td>Total Deposits (Approved)</td><td>₹${analyticsData.summary.total_deposits.toFixed(2)}</td></tr>
          <tr><td>Total Withdrawals (Approved)</td><td>₹${analyticsData.summary.total_withdrawals.toFixed(2)}</td></tr>
          <tr><td>Total AI Requests</td><td>${analyticsData.summary.total_ai_requests}</td></tr>
          <tr><td>Total Support Tickets</td><td>${analyticsData.summary.total_support_tickets}</td></tr>
        </table>
        
        <br/>
        <h3>Daily / Period Breakdown</h3>
        <table border="1">
          <tr style="background:#e6e6e6; font-weight:bold;">
            <th>Period</th>
            <th>New Users</th>
            <th>User Growth</th>
            <th>Deposits Amount (INR)</th>
            <th>Deposits Count</th>
            <th>Withdrawals Amount (INR)</th>
            <th>Withdrawals Count</th>
            <th>Trade Volume (INR)</th>
            <th>Trade Count</th>
            <th>Calculated Revenue (INR)</th>
            <th>AI Requests</th>
            <th>Support Tickets</th>
          </tr>
          ${analyticsData.charts.map(c => `
            <tr>
              <td>${c.label}</td>
              <td>${c.new_users}</td>
              <td>${c.user_growth}</td>
              <td>${c.deposits_amount}</td>
              <td>${c.deposits_count}</td>
              <td>${c.withdrawals_amount}</td>
              <td>${c.withdrawals_count}</td>
              <td>${c.trades_amount}</td>
              <td>${c.trades_count}</td>
              <td>${c.revenue}</td>
              <td>${c.ai_requests}</td>
              <td>${c.support_tickets}</td>
            </tr>
          `).join("")}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradex_analytics_${filter}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleChartClick = (dataPoint) => {
    if (!dataPoint || !analyticsData || !analyticsData.charts) return;
    const bucket = analyticsData.charts.find(c => c.label === dataPoint.activeLabel || c.key === dataPoint.activeLabel);
    if (bucket) {
      setSelectedBucket(bucket);
      // Auto-select tab with data if possible
      const tabs = ["users", "deposits", "withdrawals", "trades", "ai_requests", "support_tickets"];
      const firstWithData = tabs.find(t => bucket.details[t] && bucket.details[t].length > 0);
      setActiveTab(firstWithData || "users");
    }
  };

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      {/* CSS Styles for Print/PDF Mode */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .theme-card {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            break-inside: avoid;
            background: white !important;
          }
        }
      `}</style>

      <div className="theme-main p-5">
        
        {/* Header Block */}
        <div className="theme-card rounded-2xl p-6 shadow mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">Analytics & Reports</h1>
            <p className="mt-2 opacity-70">
              Interactive reports, data exports, detailed user activity logs, and system audits.
            </p>

            {/* Combined Tabs */}
            <div className="flex border-b mt-4" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setMainTab("analytics")}
                className={`px-5 py-2 font-bold text-sm transition border-b-2 cursor-pointer ${
                  mainTab === "analytics"
                    ? "border-accent text-accent"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                style={mainTab === "analytics" ? { borderColor: accentColor || "var(--accent)", color: accentColor || "var(--accent)" } : {}}
              >
                📊 System Analytics
              </button>
              <button
                onClick={() => setMainTab("reports")}
                className={`px-5 py-2 font-bold text-sm transition border-b-2 cursor-pointer ${
                  mainTab === "reports"
                    ? "border-accent text-accent"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                style={mainTab === "reports" ? { borderColor: accentColor || "var(--accent)", color: accentColor || "var(--accent)" } : {}}
              >
                📄 System Reports
              </button>
            </div>
          </div>
          
          {mainTab === "analytics" && (
            <div className="flex flex-wrap gap-3 no-print">
              <button
                onClick={exportToCSV}
                disabled={loading || !analyticsData}
                className="px-4 py-2.5 rounded-xl font-semibold border text-sm transition hover:opacity-80 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                CSV
              </button>
              <button
                onClick={exportToExcel}
                disabled={loading || !analyticsData}
                className="px-4 py-2.5 rounded-xl font-semibold border text-sm transition hover:opacity-80 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                Excel
              </button>
              <button
                onClick={() => window.print()}
                disabled={loading || !analyticsData}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm transition hover:opacity-80 flex items-center gap-2 cursor-pointer disabled:opacity-50 text-white"
                style={{ backgroundColor: accentColor || "var(--accent)" }}
              >
                Export PDF
              </button>
            </div>
          )}
        </div>

        {mainTab === "analytics" ? (
          <>
            {/* Filter Controls */}
            <div className="theme-card rounded-2xl p-6 shadow mb-6 no-print flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border px-4 py-3 outline-none text-sm cursor-pointer"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {filter === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                />
                <span className="opacity-70 text-sm">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                />
              </div>
            )}
            
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer text-white"
              style={{ backgroundColor: accentColor || "var(--accent)" }}
            >
              Refresh
            </button>
          </div>
          
          <div className="text-sm opacity-60 w-full md:w-auto text-right font-medium">
            * Click on chart nodes to drill down into detailed logs.
          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="theme-card rounded-2xl p-16 shadow mb-6 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: accentColor || "var(--accent)" }}></div>
            <span className="ml-3 font-semibold text-lg">Loading analytics data...</span>
          </div>
        ) : analyticsData ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              
              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Users</p>
                  <h3 className="text-3xl font-extrabold mt-1">{formatMoney(analyticsData.summary.total_users)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Platform wide registered users</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Revenue</p>
                  <h3 className="text-3xl font-extrabold mt-1 text-emerald-500">₹{formatMoney(analyticsData.summary.total_revenue)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Commissions + deposit fees</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Trades</p>
                  <h3 className="text-3xl font-extrabold mt-1">{formatMoney(analyticsData.summary.total_trades)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">All buying/selling activities</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Deposits (Approved)</p>
                  <h3 className="text-3xl font-extrabold mt-1">₹{formatMoney(analyticsData.summary.total_deposits)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Verified user deposits amount</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Withdrawals (Approved)</p>
                  <h3 className="text-3xl font-extrabold mt-1">₹{formatMoney(analyticsData.summary.total_withdrawals)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Completed payout requests</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total AI Requests</p>
                  <h3 className="text-3xl font-extrabold mt-1">{formatMoney(analyticsData.summary.total_ai_requests)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Chat messages sent to AI</p>
              </div>

              <div className="theme-card rounded-2xl p-5 shadow flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Support Tickets</p>
                  <h3 className="text-3xl font-extrabold mt-1">{formatMoney(analyticsData.summary.total_support_tickets)}</h3>
                </div>
                <p className="text-[11px] opacity-50 mt-3">Created support queries</p>
              </div>

            </div>

            {/* Empty dataset message */}
            {analyticsData.charts.length === 0 ? (
              <div className="theme-card rounded-2xl p-16 shadow text-center text-lg opacity-60">
                No analytics logs found matching the selected timeframe.
              </div>
            ) : (
              /* Charts Grid */
              <div className="grid gap-6 md:grid-cols-2 print-grid">
                
                {/* 1. User Growth Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">User Growth (Cumulative)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={accentColor || "var(--accent)"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={accentColor || "var(--accent)"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Area type="monotone" dataKey="user_growth" name="Total Users" stroke={accentColor || "var(--accent)"} strokeWidth={2} fillOpacity={1} fill="url(#userGrowthGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Daily User Registrations Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Daily Registrations</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Bar dataKey="new_users" name="New Registrations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Deposits Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Deposits</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="depositGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Area type="monotone" dataKey="deposits_amount" name="Deposit Volume (₹)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#depositGrad)" />
                        <Line type="monotone" dataKey="deposits_count" name="Count" stroke="#8b5cf6" strokeWidth={2} dot={true} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Withdrawals Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Withdrawals</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="withdrawalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Area type="monotone" dataKey="withdrawals_amount" name="Payout Volume (₹)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#withdrawalGrad)" />
                        <Line type="monotone" dataKey="withdrawals_count" name="Count" stroke="#f59e0b" strokeWidth={2} dot={true} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. Trades Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Trading Activity</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Bar dataKey="trades_amount" name="Trade Volume (₹)" fill="#eab308" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="trades_count" name="Trades Count" stroke="#3b82f6" strokeWidth={2} dot={true} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. Revenue Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Estimated Platform Revenue</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#revenueGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 7. AI Usage Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">AI Usage (Chat History)</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Bar dataKey="ai_requests" name="AI Messages" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 8. Support Tickets Chart */}
                <div className="theme-card rounded-2xl p-5 shadow">
                  <h3 className="text-lg font-bold mb-4">Support Tickets</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.charts} onClick={handleChartClick} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" stroke="var(--text)" fontSize={11} />
                        <YAxis stroke="var(--text)" fontSize={11} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
                        <Bar dataKey="support_tickets" name="Tickets Raised" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </>
        ) : (
          <div className="theme-card rounded-2xl p-6 shadow mb-6 text-center text-rose-500 font-bold">
            Failed to load analytics dashboard. Please refresh.
          </div>
        )}
          </>
        ) : (
          <div className="animate-in fade-in duration-200">
            <Reports />
          </div>
        )}
      </div>

      {/* Details Drill-Down Modal */}
      {selectedBucket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print">
          <div className="relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            
            {/* Modal Header */}
            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-2xl font-bold">Details: {selectedBucket.label}</h3>
                <p className="text-xs opacity-60 mt-1">Drill-down breakdown of activity for this period</p>
              </div>
              <button
                onClick={() => setSelectedBucket(null)}
                className="text-2xl font-bold hover:opacity-75 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Tabs Selector */}
            <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              {[
                { id: "users", label: `Registrations (${selectedBucket.details.users.length})` },
                { id: "deposits", label: `Deposits (${selectedBucket.details.deposits.length})` },
                { id: "withdrawals", label: `Withdrawals (${selectedBucket.details.withdrawals.length})` },
                { id: "trades", label: `Trades (${selectedBucket.details.trades.length})` },
                { id: "ai_requests", label: `AI Usage (${selectedBucket.details.ai_requests.length})` },
                { id: "support_tickets", label: `Tickets (${selectedBucket.details.support_tickets.length})` }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-5 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer`}
                  style={{
                    color: activeTab === t.id ? (accentColor || "var(--accent)") : "var(--text)",
                    borderColor: activeTab === t.id ? (accentColor || "var(--accent)") : "transparent"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* Users Tab Content */}
              {activeTab === "users" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Registered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.users.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center opacity-50">No users registered during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.users.map((u, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-semibold">{u.username}</td>
                            <td className="px-4 py-3">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'Trader' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>{u.role}</span>
                            </td>
                            <td className="px-4 py-3 opacity-80">{u.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Deposits Tab Content */}
              {activeTab === "deposits" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.deposits.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center opacity-50">No deposits recorded during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.deposits.map((d, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-semibold">{d.user_email}</td>
                            <td className="px-4 py-3 font-extrabold text-emerald-500">₹{formatMoney(d.amount)}</td>
                            <td className="px-4 py-3">{d.payment_type}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                d.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" :
                                d.status === "Rejected" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                              }`}>{d.status}</span>
                            </td>
                            <td className="px-4 py-3 opacity-80">{d.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Withdrawals Tab Content */}
              {activeTab === "withdrawals" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.withdrawals.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center opacity-50">No payouts/withdrawals during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.withdrawals.map((w, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-semibold">{w.user_email}</td>
                            <td className="px-4 py-3 font-extrabold text-rose-500">₹{formatMoney(w.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" :
                                w.status === "Rejected" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                              }`}>{w.status}</span>
                            </td>
                            <td className="px-4 py-3 opacity-80">{w.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Trades Tab Content */}
              {activeTab === "trades" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Symbol</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Value</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.trades.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center opacity-50">No trades executed during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.trades.map((t, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-semibold">{t.user_email}</td>
                            <td className="px-4 py-3 font-bold text-accent" style={{ color: accentColor || "var(--accent)" }}>{t.stock_symbol}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.trade_type === "BUY" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              }`}>{t.trade_type}</span>
                            </td>
                            <td className="px-4 py-3">{t.quantity}</td>
                            <td className="px-4 py-3">₹{formatMoney(t.price)}</td>
                            <td className="px-4 py-3 font-bold">₹{formatMoney(t.price * t.quantity)}</td>
                            <td className="px-4 py-3 opacity-80">{t.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Requests Tab Content */}
              {activeTab === "ai_requests" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Prompt Excerpt</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.ai_requests.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center opacity-50">No AI usage recorded during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.ai_requests.map((c, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-semibold">{c.user_email}</td>
                            <td className="px-4 py-3 italic">"{c.question}"</td>
                            <td className="px-4 py-3 opacity-80">{c.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Support Tickets Tab Content */}
              {activeTab === "support_tickets" && (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wider font-bold opacity-75 text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <th className="px-4 py-3">Ticket ID</th>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Issue Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {selectedBucket.details.support_tickets.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center opacity-50">No support tickets created during this period.</td>
                        </tr>
                      ) : (
                        selectedBucket.details.support_tickets.map((s, i) => (
                          <tr key={i} className="hover:bg-surface/10">
                            <td className="px-4 py-3 font-bold text-accent" style={{ color: accentColor || "var(--accent)" }}>{s.ticket_number}</td>
                            <td className="px-4 py-3 font-semibold">{s.user_email}</td>
                            <td className="px-4 py-3">{s.issue_type}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === "RESOLVED" || s.status === "CLOSED" ? "bg-emerald-500/10 text-emerald-500" :
                                s.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                              }`}>{s.status}</span>
                            </td>
                            <td className="px-4 py-3 opacity-80">{s.created_at}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
            
            {/* Modal Footer */}
            <div className="p-5 border-t flex justify-end no-print" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setSelectedBucket(null)}
                className="px-5 py-2.5 rounded-xl font-bold border text-sm transition hover:opacity-80 cursor-pointer"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default AdminAnalyticsPage;
