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
  const [targets, setTargets] = useState([]);

  async function fetchTrades() {
    try {
      const response = await api.get("/trade/history", getAuthHeaders());
      setTrades(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  async function fetchTargets() {
    try {
      const response = await api.get("/trade/sl-tp", getAuthHeaders());
      setTargets(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    fetchTrades();
    fetchTargets();
  }, []);

  const summary = useMemo(() => {
    const buys = trades.filter((trade) => trade.trade_type === "BUY").length;
    const sells = trades.filter((trade) => trade.trade_type === "SELL").length;
    
    // Target Orders are SL/TP (where buy_price is null)
    const targetCount = targets.filter(o => o.buy_price === null).length;
    // Auto Buy Orders are Limit Buys (where buy_price is NOT null)
    const autoBuyCount = targets.filter(o => o.buy_price !== null).length;

    return { buys, sells, targetCount, autoBuyCount, total: trades.length };
  }, [trades, targets]);

  const allActivity = useMemo(() => {
    const limitOrders = targets
      .filter((o) => o.buy_price !== null)
      .map((o) => ({
        stock_symbol: o.symbol,
        company_name: "Limit Buy Order",
        trade_type: "LIMIT BUY",
        quantity: o.quantity,
        price: o.buy_price,
        note: "Pending Execution",
        isPending: true,
      }));

    return [...limitOrders, ...trades];
  }, [trades, targets]);

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

        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Total Trades", value: summary.total },
            { label: "Buy Orders", value: summary.buys },
            { label: "Sell Orders", value: summary.sells },
            { label: "Target Orders", value: summary.targetCount },
            { label: "Auto Buy Orders", value: summary.autoBuyCount },
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
                  <th className="px-4 py-4 text-left text-sm">Status / Note</th>
                </tr>
              </thead>
              <tbody>
                {allActivity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm opacity-70">
                      No activity yet.
                    </td>
                  </tr>
                ) : (
                  allActivity.map((trade, index) => (
                    <tr
                      key={`${trade.stock_symbol}-${index}`}
                      className={`border-b last:border-b-0 ${trade.isPending ? "opacity-70 bg-accent/5" : ""}`}
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            trade.trade_type === "BUY"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : trade.trade_type === "LIMIT BUY"
                              ? "bg-amber-500/15 text-amber-500"
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
                      <td className="px-4 py-4">
                        <div className="text-xs italic opacity-70">
                          {trade.note || (trade.trade_type === "BUY" ? "Manual Purchase" : "Manual Sale")}
                        </div>
                      </td>
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
