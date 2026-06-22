import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

const chartColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

const metricNotes = {
  "Portfolio Value": "Cash plus current market value of holdings.",
  "Total P&L": "Current holdings value minus invested amount.",
  "Sharpe Ratio": "Higher is better. It compares return against volatility.",
  "Max Drawdown": "Largest fall from a previous portfolio peak.",
  "Risk Score": "0-30 low, 31-70 medium, 71-100 high.",
  Diversification: "Higher means better spread across stocks and sectors.",
};

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function getRiskClass(riskLevel) {
  if (riskLevel === "High") return "bg-rose-500/15 text-rose-500 border-rose-500/20";
  if (riskLevel === "Medium") return "bg-amber-500/15 text-amber-500 border-amber-500/20";
  return "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";
}

function RiskDashboard() {
  const [showRiskInfo, setShowRiskInfo] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-risk"],
    queryFn: async () => {
      const response = await api.get("/portfolio/risk-analysis", getAuthHeaders());
      return response.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="page-bg min-h-screen">
        <Navbar />
        <div className="p-10 text-center opacity-70">Loading risk analytics...</div>
      </div>
    );
  }

  const cards = [
    ["Portfolio Value", `Rs. ${formatMoney(data.portfolio_value)}`],
    ["Total P&L", `${data.profit_loss >= 0 ? "+" : "-"}Rs. ${formatMoney(Math.abs(data.profit_loss))}`],
    ["Sharpe Ratio", data.sharpe_ratio],
    ["Max Drawdown", `${data.max_drawdown}%`],
    ["Risk Score", `${data.risk_score}/100`],
    ["Diversification", `${data.diversification_score}/100`],
  ];

  // console.log("stock_allocation", data.stock_allocation);
  // console.log("portfolio_growth", data.portfolio_growth);

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[28px] border p-6 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Portfolio Analytics</p>
            <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h1 className="text-4xl font-black">Risk Dashboard</h1>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${getRiskClass(data.risk_level)}`}>
                  {data.risk_level} Risk
                </span>
                <button
                  type="button"
                  onClick={() => setShowRiskInfo(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-base font-black text-white shadow-lg transition hover:scale-105 hover:opacity-90"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
                    background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #111827))",
                  }}
                  aria-label="Show risk categories"
                  title="Risk categories"
                >
                  ?
                </button>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 opacity-70">
              Risk score blends live volatility, diversification, position concentration, and drawdown. Lower is safer; higher needs closer review.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-[24px] border p-5 shadow-lg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60">{label}</p>
                <p className="mt-3 text-2xl font-black">{value}</p>
                <p className="mt-2 text-xs leading-5 opacity-60">{metricNotes[label]}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] border p-5 shadow-xl min-w-0" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-black">Sector Allocation</h2>
              <p className="mt-1 text-sm opacity-60">Shows how much of your holdings are concentrated in each sector.</p>
              <div className="mt-4 w-full min-w-0" style={{ height: "320px" }}>
                  <PieChart width={500} height={320}>
                    <Pie data={data.sector_allocation} dataKey="value" nameKey="label" outerRadius={110} label>
                      {data.sector_allocation.map((_, index) => (
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
              </div>
            </section>

            <section className="rounded-[28px] border p-5 shadow-xl min-w-0" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-black">Stock Allocation</h2>
              <p className="mt-1 text-sm opacity-60">Large bars show stocks that dominate your portfolio value.</p>
              <div style={{ width: "100%", height: 320 }}>
                <BarChart
                  width={600}
                  height={320}
                  data={data.stock_allocation || []}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </div>
            </section>

            <section className="rounded-[28px] border p-5 shadow-xl lg:col-span-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-black">Portfolio Growth</h2>
              <p className="mt-1 text-sm opacity-60">Tracks estimated portfolio value after each recorded trade.</p>
              <div className="mt-4 w-full min-w-0" style={{ height: "320px" }}>
                  <LineChart width={900} height={320} data={data.portfolio_growth || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
                  </LineChart>
              </div>
            </section>

            <section className="rounded-[28px] border p-5 shadow-xl lg:col-span-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-black">Risk Meter</h2>
              <p className="mt-1 text-sm opacity-60">
                Current score is {data.risk_score}. Low is 0-30, medium is 31-70, high is 71-100.
              </p>
              <div className="mt-5 h-5 overflow-hidden rounded-full bg-slate-500/15">
                <div
                  className={`h-full ${data.risk_score <= 30 ? "bg-emerald-500" : data.risk_score <= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${data.risk_score}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs font-bold uppercase tracking-wider opacity-60">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </section>
          </div>
        </div>
      </div>
      {showRiskInfo && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-[28px] border p-6 shadow-2xl"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">Risk Categories</p>
                <h2 className="mt-2 text-2xl font-black">How to Read Risk</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRiskInfo(false)}
                className="rounded-xl border px-3 py-2 text-sm font-bold transition hover:opacity-80"
                style={{ borderColor: "var(--border)" }}
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["Low Risk", "0-30", "Usually steadier holdings, better diversification, and lower drawdown.", "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"],
                ["Medium Risk", "31-70", "Balanced risk, but watch volatility, sector concentration, and position size.", "bg-amber-500/15 text-amber-500 border-amber-500/20"],
                ["High Risk", "71-100", "Risky portfolio zone with higher volatility, drawdown, or concentration.", "bg-rose-500/15 text-rose-500 border-rose-500/20"],
              ].map(([title, range, detail, className]) => (
                <div key={title} className={`rounded-2xl border p-4 ${className}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{title}</p>
                    <span className="text-xs font-black">{range}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RiskDashboard;
