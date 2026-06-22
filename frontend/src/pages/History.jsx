/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import { useStocks } from "../context/StockContext";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getTriggerInfo(note) {
  const safeNote = note || "";
  const priceMatch = safeNote.match(/(?:Trigger:\s*(?:₹|Rs\.?\s*)?)([\d.]+)/i);
  const triggerPrice = priceMatch ? Number(priceMatch[1]) : null;

  if (/stop loss/i.test(safeNote)) {
    return { type: "Stop Loss Triggered Sale", triggerPrice };
  }

  if (/take profit/i.test(safeNote)) {
    return { type: "Take Profit Triggered Sale", triggerPrice };
  }

  if (/limit buy/i.test(safeNote)) {
    return { type: "Auto Buy Executed", triggerPrice };
  }

  return null;
}

function getTradeDetailItems(trade) {
  const quantity = Number(trade.quantity || 0);
  const buyPrice = Number(trade.buy_price ?? trade.price ?? 0);
  const sellPrice = Number(trade.price || 0);
  const buyAmount = quantity * buyPrice;
  const sellAmount = quantity * sellPrice;
  const profit = sellAmount - buyAmount;
  const triggerInfo = getTriggerInfo(trade.note);

  if (trade.trade_type === "LIMIT BUY") {
    return [
      { label: "Buy Type", value: "Limit Buy" },
      { label: "Quantity", value: quantity },
      { label: "Set Buy Price", value: `Rs. ${formatMoney(buyPrice)}` },
      { label: "Buy Amount", value: `Rs. ${formatMoney(buyAmount)}` },
      { label: "Current Stock Price", value: `Rs. ${formatMoney(trade.current_price)}` },
    ];
  }

  if (trade.trade_type === "SELL") {
    return [
      { label: "Sale Type", value: triggerInfo?.type || "Manual Sale" },
      { label: "Quantity", value: quantity },
      { label: "Buy Price", value: `Rs. ${formatMoney(buyPrice)}` },
      ...(triggerInfo?.triggerPrice
        ? [{ label: "Set Trigger Price", value: `Rs. ${formatMoney(triggerInfo.triggerPrice)}` }]
        : []),
      { label: triggerInfo ? "Triggered Sold Price" : "Sell Price", value: `Rs. ${formatMoney(sellPrice)}` },
      { label: "Buy Amount", value: `Rs. ${formatMoney(buyAmount)}` },
      { label: "Sell Amount", value: `Rs. ${formatMoney(sellAmount)}` },
      {
        label: profit >= 0 ? "Sale Profit" : "Sale Loss",
        value: `${profit >= 0 ? "+" : "-"}Rs. ${formatMoney(Math.abs(profit))}`,
        tone: profit >= 0 ? "profit" : "loss",
      },
    ];
  }

  if (triggerInfo) {
    const setBuyPrice = triggerInfo.triggerPrice ?? buyPrice;

    return [
      { label: "Buy Type", value: triggerInfo.type },
      { label: "Quantity", value: quantity },
      { label: "Set Buy Price", value: `Rs. ${formatMoney(setBuyPrice)}` },
      { label: "Triggered Buy Price", value: `Rs. ${formatMoney(buyPrice)}` },
      { label: "Buy Amount", value: `Rs. ${formatMoney(quantity * buyPrice)}` },
    ];
  }

  return [
    { label: "Buy Type", value: "Manual Buy" },
    { label: "Quantity", value: quantity },
    { label: "Buy Price", value: `Rs. ${formatMoney(buyPrice)}` },
    { label: "Buy Amount", value: `Rs. ${formatMoney(buyAmount)}` },
  ];
}

function getDetailTitle(tradeType) {
  if (tradeType === "LIMIT BUY") return "Limit Buy Details";
  if (tradeType === "SELL") return "Sale Details";
  return "Buy Details";
}

function History() {
  const [trades, setTrades] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const { stocks } = useStocks();

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
      .map((o) => {
        const stock = stocks.find((item) => item.symbol === o.symbol);

        return {
          id: `limit-${o.id}`,
          stock_symbol: o.symbol,
          company_name: stock?.company_name || "Limit Buy Order",
          trade_type: "LIMIT BUY",
          quantity: o.quantity,
          price: o.buy_price,
          buy_price: o.buy_price,
          current_price: stock?.current_price ?? o.buy_price,
          note: "Pending Execution",
          isPending: true,
        };
      });

    return [...limitOrders, ...trades];
  }, [stocks, trades, targets]);

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
                  <th className="px-4 py-4 text-left text-sm">Details</th>
                </tr>
              </thead>
              <tbody>
                {allActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm opacity-70">
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
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedTrade(trade)}
                          className="rounded-xl border px-4 py-2 text-xs font-bold transition hover:opacity-80"
                          style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedTrade && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-60">
                  {getDetailTitle(selectedTrade.trade_type)}
                </p>
                <h3 className="mt-2 text-3xl font-black">{selectedTrade.stock_symbol}</h3>
                <p className="mt-1 text-sm opacity-70">{selectedTrade.company_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrade(null)}
                className="rounded-xl border px-3 py-2 text-sm font-bold transition hover:opacity-80"
                style={{ borderColor: "var(--border)" }}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {getTradeDetailItems(selectedTrade).map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">{item.label}</p>
                  <p
                    className={`mt-2 text-lg font-black ${
                      item.tone === "profit"
                        ? "text-emerald-500"
                        : item.tone === "loss"
                        ? "text-rose-500"
                        : ""
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-50">
                {selectedTrade.isPending ? "Order Status" : "Trade Note"}
              </p>
              <p className="mt-2 text-sm opacity-80">
                {selectedTrade.note || (selectedTrade.trade_type === "BUY" ? "Manual Purchase" : "Manual Sale")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default History;
