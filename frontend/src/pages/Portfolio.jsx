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

function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);

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

  useEffect(() => {
    fetchPortfolioSummary();
    fetchHoldings();
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
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm opacity-70">
                      No holdings yet.
                    </td>
                  </tr>
                ) : (
                  holdings.map((holding) => (
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
                      {/* <td className="px-4 py-4">
                        <span className={holding.profit_loss >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {holding.profit_loss >= 0 ? "▲" : "▼"} ₹{Math.abs(holding.profit_loss).toFixed(2)}
                        </span>
                      </td> */}
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

export default Portfolio;
