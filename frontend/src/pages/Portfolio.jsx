/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import ModifyHoldingModal from "../components/ModifyHoldingModal";
import ModifyAutoBuyModal from "../components/ModifyAutoBuyModal";
import ConfirmDialog from "../components/ConfirmDialog";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sltpOrders, setSltpOrders] = useState([]);
  const [orderToCancel, setOrderToCancel] = useState(null);

  const [selectedAutoBuy, setSelectedAutoBuy] = useState(null);
  const [isAutoBuyModalOpen, setIsAutoBuyModalOpen] = useState(false);

  async function fetchPortfolioSummary() {
    try {
      const response = await api.get("/portfolio/summary", getAuthHeaders());
      setSummary(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  async function fetchHoldings() {
    try {
      const response = await api.get("/trade/holdings", getAuthHeaders());
      setHoldings(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  async function fetchSLTPOrders() {
    try {
      const response = await api.get("/trade/sl-tp", getAuthHeaders());
      setSltpOrders(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  async function cancelOrder(orderId) {
    try {
      await api.delete(`/trade/sl-tp/${orderId}`, getAuthHeaders());
      fetchSLTPOrders();
    } catch (error) {
      console.log(error);
    }
  }

  async function modifyOrder(order) {
    setSelectedAutoBuy(order);
    setIsAutoBuyModalOpen(true);
  }

  useEffect(() => {
    fetchPortfolioSummary();
    fetchHoldings();
    fetchSLTPOrders();
  }, []);

  const cards = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        label: "Cash Balance",
        value: `₹${formatMoney(summary.cash_balance)}`,
        note: "Ready to deploy",
      },
      {
        label: "Invested Amount",
        value: `₹${formatMoney(summary.invested_amount)}`,
        note: "Currently held in positions",
      },
      {
        label: "Portfolio Value",
        value: `₹${formatMoney(summary.total_portfolio_value)}`,
        note: "Cash + investments",
      },
      {
        label: "Total Profit",
        value: `${summary.profit >= 0 ? "+" : ""}₹${formatMoney(summary.profit)}`,
        note: "Portfolio Value - Deposits",
        positive: summary.profit >= 0,
      },
    ];
  }, [summary]);

  const autoBuyOrders = useMemo(() => {
    return sltpOrders.filter((o) => o.buy_price !== null);
  }, [sltpOrders]);

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
            Portfolio Snapshot
          </p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">Portfolio</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 opacity-75 md:text-base">
            See your cash, invested amount, and total value in one place with a
            cleaner overview of your current positions.
          </p>
        </div>

        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-[26px] border p-6 shadow-lg"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <p className="text-sm font-medium opacity-70">{card.label}</p>
                <p
                  className={`mt-3 text-3xl font-black ${
                    card.label === "Total Profit"
                      ? card.positive
                        ? "text-green-500"
                        : "text-red-500"
                      : ""
                  }`}
                >
                  {card.value}
                </p>
                <p className="mt-2 text-sm opacity-60">{card.note}</p>
              </div>
            ))}
          </div>
        )}

        <div
          className="mt-6 rounded-[28px] border p-6 shadow-xl"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Holdings</h2>
              <p className="mt-1 text-sm opacity-70">
                Current positions are listed below with live price context.
              </p>
            </div>
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {holdings.length} positions
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-4 text-left text-sm">Symbol</th>
                  <th className="px-4 py-4 text-left text-sm">Company</th>
                  <th className="px-4 py-4 text-left text-sm">Quantity</th>
                  <th className="px-4 py-4 text-left text-sm">Buy Price</th>
                  <th className="px-4 py-4 text-left text-sm">Current Price</th>
                  <th className="px-4 py-4 text-left text-sm">P/L</th>
                  <th className="px-4 py-4 text-left text-sm">Market Value</th>
                  <th className="px-4 py-4 text-left text-sm">Limits (SL/TP)</th>
                  <th className="px-4 py-4 text-left text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm opacity-70">
                      No holdings yet.
                    </td>
                  </tr>
                ) : (
                  holdings.map((holding) => {
                    const orders = sltpOrders.filter(o => o.symbol === holding.symbol);
                    return (
                      <tr
                        key={holding.symbol}
                        className="border-b last:border-b-0"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="px-4 py-4 font-semibold">{holding.symbol}</td>
                        <td className="px-4 py-4">{holding.company_name}</td>
                        <td className="px-4 py-4">{holding.quantity}</td>
                        <td className="px-4 py-4">₹{formatMoney(holding.buy_price)}</td>
                        <td className="px-4 py-4">₹{formatMoney(holding.current_price)}</td>
                        <td
                          className={`px-4 py-4 font-semibold ${
                            holding.profit_loss >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          ₹{formatMoney(holding.profit_loss)}
                        </td>
                        <td className="px-4 py-4 font-bold">₹{formatMoney(holding.market_value)}</td>
                        <td className="px-4 py-4">
                          {orders.length > 0 ? (
                            <div className="flex flex-col gap-2 text-[10px] leading-tight">
                              {orders.map((order, idx) => (
                                <div key={idx} className="flex flex-col border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                  {order.sl_price && (
                                    <span className="text-red-500 font-bold">
                                      SL: ₹{formatMoney(order.sl_price)} ({order.quantity})
                                    </span>
                                  )}
                                  {order.tp_price && (
                                    <span className="text-green-500 font-bold">
                                      TP: ₹{formatMoney(order.tp_price)} ({order.quantity})
                                    </span>
                                  )}
                                  {order.buy_price && (
                                    <span className="text-amber-500 font-bold">
                                      Auto-Buy: ₹{formatMoney(order.buy_price)} ({order.quantity})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] opacity-40">None set</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => {
                              setSelectedHolding(holding);
                              setIsModalOpen(true);
                            }}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-white transition hover:opacity-80"
                            style={{ backgroundColor: "var(--accent)" }}
                          >
                            Modify
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {autoBuyOrders.length > 0 && (
          <div
            className="mt-6 rounded-[28px] border p-6 shadow-xl"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pending Auto-Buy Orders</h2>
                <p className="mt-1 text-sm opacity-70">
                  These orders will execute automatically when the price target is reached.
                </p>
              </div>
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {autoBuyOrders.length} orders
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-4 py-4 text-left text-sm">Symbol</th>
                    <th className="px-4 py-4 text-left text-sm">Quantity</th>
                    <th className="px-4 py-4 text-left text-sm">Target Price</th>
                    <th className="px-4 py-4 text-left text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {autoBuyOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-4 font-bold">{order.symbol}</td>
                      <td className="px-4 py-4">{order.quantity}</td>
                      <td className="px-4 py-4 font-bold text-amber-500">₹{formatMoney(order.buy_price)}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => modifyOrder(order)}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 transition"
                          >
                            Modify
                          </button>
                          <button
                            onClick={() => setOrderToCancel(order.id)}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ModifyHoldingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        holding={selectedHolding}
        onUpdate={() => {
          fetchPortfolioSummary();
          fetchHoldings();
          fetchSLTPOrders();
        }}
      />
      <ModifyAutoBuyModal
        isOpen={isAutoBuyModalOpen}
        onClose={() => setIsAutoBuyModalOpen(false)}
        order={selectedAutoBuy}
        onUpdate={() => {
          fetchSLTPOrders();
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(orderToCancel)}
        title="Cancel order?"
        message="This pending auto-buy order will be cancelled and will not execute."
        confirmText="Cancel Order"
        onCancel={() => setOrderToCancel(null)}
        onConfirm={() => {
          const orderId = orderToCancel;
          setOrderToCancel(null);
          cancelOrder(orderId);
        }}
      />
    </div>
  );
}

export default Portfolio;
