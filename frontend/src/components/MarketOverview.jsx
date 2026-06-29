import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompact(number) {
  if (number >= 1.0e7) return (number / 1.0e7).toFixed(2) + " Cr";
  if (number >= 1.0e5) return (number / 1.0e5).toFixed(2) + " L";
  if (number >= 1.0e3) return (number / 1.0e3).toFixed(2) + " K";
  return number.toFixed(2);
}

export default function MarketOverview() {
  const [period, setPeriod] = useState("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // Detail Modal state
  const [selectedStock, setSelectedStock] = useState(null);

  async function fetchMarketData() {
    if (period === "custom" && (!startDate || !endDate)) {
      return;
    }

    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ period });
      if (period === "custom") {
        queryParams.append("start_date", startDate);
        queryParams.append("end_date", endDate);
      }

      const res = await api.get(`/admin/market-overview?${queryParams.toString()}`, getAuthHeaders());
      setData(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load market statistics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMarketData();
  }, [period, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Date Filters Card */}
      <div className="theme-card rounded-2xl p-6 shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Analytics Range</h3>
          <p className="text-xs opacity-70 mt-1">Select period boundaries for trade volume tracking.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-xl border focus:outline-none text-sm cursor-pointer"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date Range</option>
          </select>

          {period === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border focus:outline-none text-sm"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <span className="text-xs font-bold opacity-60">to</span>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border focus:outline-none text-sm"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 space-y-4 theme-card rounded-2xl p-6 shadow">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
          <span className="font-bold opacity-75">Compiling market statistics...</span>
        </div>
      ) : !data ? (
        <div className="text-center py-12 theme-card rounded-2xl p-6 opacity-65">
          Please select date ranges to generate analytics.
        </div>
      ) : (
        <>
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Trades */}
            <div className="theme-card rounded-2xl p-5 shadow border-l-4 border-accent/70 space-y-2">
              <h4 className="text-xs font-bold opacity-60 uppercase">Total Trades</h4>
              <div className="text-2xl font-black">{data.summary.total_trades}</div>
              <p className="text-xs opacity-75">Completed orders in range</p>
            </div>

            {/* Trading Volume */}
            <div className="theme-card rounded-2xl p-5 shadow border-l-4 border-emerald-500/70 space-y-2">
              <h4 className="text-xs font-bold opacity-60 uppercase">Trading Volume</h4>
              <div className="text-2xl font-black">₹{formatMoney(data.summary.total_volume)}</div>
              <p className="text-xs opacity-75">Total value exchanged</p>
            </div>

            {/* Total Profit (SELLs) */}
            <div className="theme-card rounded-2xl p-5 shadow border-l-4 border-blue-500/70 space-y-2">
              <h4 className="text-xs font-bold opacity-60 uppercase">Total Sells (Inflow)</h4>
              <div className="text-2xl font-black text-emerald-400">₹{formatMoney(data.summary.total_profit)}</div>
              <p className="text-xs opacity-75">Admin cash inflow volume</p>
            </div>

            {/* Total Loss (BUYs) */}
            <div className="theme-card rounded-2xl p-5 shadow border-l-4 border-rose-500/70 space-y-2">
              <h4 className="text-xs font-bold opacity-60 uppercase">Total Buys (Outflow)</h4>
              <div className="text-2xl font-black text-rose-400">₹{formatMoney(data.summary.total_loss)}</div>
              <p className="text-xs opacity-75">Admin cash outflow volume</p>
            </div>
          </div>

          {/* Gainers & Losers Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Gainers */}
            <div className="theme-card rounded-2xl p-6 shadow space-y-4">
              <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
                Top Gainers (vs Previous Close)
              </h3>
              {data.top_gainers.length === 0 ? (
                <div className="text-center py-6 text-xs opacity-60">No gainers found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.top_gainers.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStock(s)}
                      className="flex justify-between items-center py-3 hover:bg-surface/20 transition px-2 rounded-lg cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-sm">{s.symbol}</div>
                        <div className="text-xs opacity-75">{s.company_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">₹{formatMoney(s.current_price)}</div>
                        <div className="text-xs font-extrabold text-emerald-400">+{s.change_percent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Losers */}
            <div className="theme-card rounded-2xl p-6 shadow space-y-4">
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 015.82 5.523l2.74 1.218m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941" />
                </svg>
                Top Losers (vs Previous Close)
              </h3>
              {data.top_losers.length === 0 ? (
                <div className="text-center py-6 text-xs opacity-60">No losers found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {data.top_losers.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStock(s)}
                      className="flex justify-between items-center py-3 hover:bg-surface/20 transition px-2 rounded-lg cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-sm">{s.symbol}</div>
                        <div className="text-xs opacity-75">{s.company_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">₹{formatMoney(s.current_price)}</div>
                        <div className="text-xs font-extrabold text-rose-400">{s.change_percent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Most Traded Bar Chart */}
            <div className="theme-card rounded-2xl p-6 shadow space-y-4">
              <h3 className="text-lg font-bold">Most Traded Stocks (Volume Value)</h3>
              {data.most_traded.length === 0 ? (
                <div className="text-center py-20 text-xs opacity-60">No trade volume logs found.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.most_traded}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tickFormatter={(v) => formatCompact(v)} stroke="var(--text)" opacity={0.6} style={{ fontSize: "10px" }} />
                      <YAxis dataKey="symbol" type="category" stroke="var(--text)" opacity={0.8} style={{ fontSize: "12px", fontWeight: "bold" }} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", borderColor: "var(--border)" }}
                        formatter={(value) => [`₹${formatMoney(value)}`, "Trading Volume"]}
                      />
                      <Bar dataKey="volume" fill="var(--accent)" radius={[0, 4, 4, 0]} onClick={(d) => setSelectedStock(d)}>
                        {data.most_traded.map((entry, index) => (
                          <Cell key={`cell-${index}`} cursor="pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Trading Volume Trend Line Chart */}
            <div className="theme-card rounded-2xl p-6 shadow space-y-4">
              <h3 className="text-lg font-bold">Trading Volume Trend (Inflow Flow)</h3>
              {data.trading_volume_chart.length === 0 ? (
                <div className="text-center py-20 text-xs opacity-60">No historical trends available.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trading_volume_chart} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="var(--text)" opacity={0.6} style={{ fontSize: "9px" }} />
                      <YAxis tickFormatter={(v) => formatCompact(v)} stroke="var(--text)" opacity={0.6} style={{ fontSize: "10px" }} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", borderColor: "var(--border)" }}
                        formatter={(value) => [`₹${formatMoney(value)}`, "Volume"]}
                      />
                      <Line type="monotone" dataKey="volume" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Daily Profit/Loss Flow Bar Chart */}
          <div className="theme-card rounded-2xl p-6 shadow space-y-4">
            <h3 className="text-lg font-bold">Daily Profit/Loss Cashflow Summary</h3>
            {data.daily_pl_chart.length === 0 ? (
              <div className="text-center py-20 text-xs opacity-60">No daily transaction summaries recorded.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily_pl_chart} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text)" opacity={0.6} style={{ fontSize: "9px" }} />
                    <YAxis tickFormatter={(v) => formatCompact(v)} stroke="var(--text)" opacity={0.6} style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", borderColor: "var(--border)" }}
                      formatter={(value) => [`₹${formatMoney(value)}`, "Net Cashflow"]}
                    />
                    <Bar dataKey="pl">
                      {data.daily_pl_chart.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.pl >= 0 ? "rgba(52, 211, 153, 0.85)" : "rgba(248, 113, 113, 0.85)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* Click Detail Dialog Modal */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in fade-in zoom-in duration-200"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Asset Audit Details</h3>
              <button
                onClick={() => setSelectedStock(null)}
                className="p-1 rounded-lg hover:bg-surface transition cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                <span className="opacity-70">Stock Symbol:</span>
                <span className="font-extrabold text-accent px-2 py-0.5 rounded bg-accent/15 border border-accent/20">
                  {selectedStock.symbol}
                </span>
              </div>
              
              {selectedStock.company_name && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Company Name:</span>
                  <span className="font-bold">{selectedStock.company_name}</span>
                </div>
              )}

              {selectedStock.current_price && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Current Market Price:</span>
                  <span className="font-bold text-emerald-400">₹{formatMoney(selectedStock.current_price)}</span>
                </div>
              )}

              {selectedStock.previous_close && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Previous Close Price:</span>
                  <span className="font-bold opacity-80">₹{formatMoney(selectedStock.previous_close)}</span>
                </div>
              )}

              {selectedStock.change_percent !== undefined && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Price Delta (%):</span>
                  <span className={`font-black ${selectedStock.change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedStock.change_percent >= 0 ? "+" : ""}{selectedStock.change_percent}%
                  </span>
                </div>
              )}

              {selectedStock.count && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Total Trades Count:</span>
                  <span className="font-bold">{selectedStock.count} transactions</span>
                </div>
              )}

              {selectedStock.volume && (
                <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  <span className="opacity-70">Total Period Volume:</span>
                  <span className="font-black text-sky-400">₹{formatMoney(selectedStock.volume)}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedStock(null)}
              className="w-full mt-6 py-2.5 rounded-xl border text-sm font-bold transition hover:bg-surface cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
