/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function History() {
  const [trades, setTrades] = useState([]);

  async function fetchTrades() {
    try {
      const response = await api.get("/trade/history", getAuthHeaders());
      setTrades(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchTrades();
  }, []);

  const summary = useMemo(() => {
    const buys = trades.filter((trade) => trade.trade_type === "BUY").length;
    const sells = trades.filter((trade) => trade.trade_type === "SELL").length;

    return { buys, sells, total: trades.length };
  }, [trades]);

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div
          className="mb-6 rounded-[28px] border p-6 shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--surface) 96%, transparent))",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">
            Trade Ledger
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Trade History</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 opacity-75 md:text-base">
            Review every buy and sell order with a cleaner history layout and a
            quick summary of recent activity.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Trades", value: summary.total },
            { label: "Buy Orders", value: summary.buys },
            { label: "Sell Orders", value: summary.sells },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[26px] border p-6 shadow-lg"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <p className="text-sm font-medium opacity-70">{item.label}</p>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-6 rounded-[28px] border p-6 shadow-xl"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Activity List</h2>
              <p className="mt-1 text-sm opacity-70">
                The latest trades appear first.
              </p>
            </div>
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              Live history
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-4 text-left text-sm">Type</th>
                  <th className="px-4 py-4 text-left text-sm">Stock</th>
                  <th className="px-4 py-4 text-left text-sm">Quantity</th>
                  <th className="px-4 py-4 text-left text-sm">Price</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm opacity-70">
                      No trades yet.
                    </td>
                  </tr>
                ) : (
                  trades.map((trade, index) => (
                    <tr
                      key={`${trade.stock_symbol}-${index}`}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            trade.trade_type === "BUY"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-rose-500/15 text-rose-500"
                          }`}
                        >
                          {trade.trade_type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{trade.stock_symbol}</div>
                        <div className="text-sm opacity-60">{trade.company_name}</div>
                      </td>
                      <td className="px-4 py-4">{trade.quantity}</td>
                      <td className="px-4 py-4 font-semibold">₹{formatMoney(trade.price)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default History;
