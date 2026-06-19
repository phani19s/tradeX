/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";

import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import {useStocks} from "../context/StockContext";

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Watchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const {stocks: stockOptions} = useStocks();
  const [stockId, setStockId] = useState("");

  async function fetchWatchlist() {

    try {
  
      const response =
        await api.get(
          "/watchlist/",
          getAuthHeaders()
        );
  
      setWatchlist(
        response.data
      );
  
    } catch (error) {
  
      console.log(error);
  
    }
  
  }

  useEffect(() => {
    fetchWatchlist();

    const timer = window.setInterval(() => {
      fetchWatchlist();
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const addStock = async () => {
    try {
      await api.post(
        "/watchlist/add",
        {
          stock_id: Number(stockId),
        },
        getAuthHeaders()
      );

      await fetchWatchlist();
      setStockId("");
    } catch {
      toast.error("Failed to add stock");
    }
  };

  const removeStock = async (stockIdValue) => {
    try {
      await api.delete("/watchlist/remove", {
        data: {
          stock_id: stockIdValue,
        },
        headers: getAuthHeaders().headers,
      });

      await fetchWatchlist();
    } catch {
      toast.error("Failed to remove stock");
    }
  };

  const watchlistCount = watchlist.length;
  const availableCount = stockOptions.length;
  const canAdd = Boolean(stockId);

  const mergedWatchlist = watchlist.map(item => {
    const liveStock = stockOptions.find(s => s.id === item.stock_id);
    return liveStock ? { ...item, ...liveStock } : item;
  });

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div
          className="mb-6 rounded-3xl border p-6 shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--surface) 94%, transparent))",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">
                Market Watch
              </p>
              <h1 className="mt-3 text-4xl font-black md:text-5xl">
                Watchlist
              </h1>
              <p className="mt-3 text-sm leading-6 opacity-75 md:text-base">
                Track the stocks you care about, keep the list focused, and
                remove items whenever you want to clean up your view.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Tracked
                </p>
                <p className="mt-1 text-2xl font-black">{watchlistCount}</p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Available
                </p>
                <p className="mt-1 text-2xl font-black">{availableCount}</p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Focus
                </p>
                <p className="mt-1 text-2xl font-black">Stocks</p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Style
                </p>
                <p className="mt-1 text-2xl font-black">Live</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div
            className="rounded-3xl border p-6 shadow-lg"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Add Stock</h2>
                <p className="mt-1 text-sm opacity-70">
                  Pick a stock to add it to your watchlist.
                </p>
              </div>
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Quick Add
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <label className="text-sm font-semibold opacity-80" htmlFor="stock-select">
                Choose stock
              </label>
              <select
                id="stock-select"
                value={stockId}
                onChange={(e) => setStockId(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:ring-2"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              >
                <option value="">Select Stock</option>
                {stockOptions.map((stock) => (
                  <option key={stock.id} value={stock.id}>
                    {stock.symbol} - {stock.company_name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addStock}
                disabled={!canAdd}
                className="rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Add to Watchlist
              </button>
            </div>

            <div
              className="mt-6 rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <p className="text-sm font-semibold">Tips</p>
              <p className="mt-2 text-sm leading-6 opacity-75">
                Keep the list short so the most important movers stay visible.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mergedWatchlist.length === 0 ? (
              <div
                className="sm:col-span-2 xl:col-span-3 rounded-3xl border px-6 py-14 text-center shadow-lg"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  +
                </div>
                <h3 className="mt-4 text-2xl font-bold">Your watchlist is empty</h3>
                <p className="mt-2 text-sm opacity-70">
                  Add a few stocks on the left to build your tracking board.
                </p>
              </div>
            ) : (
              mergedWatchlist.map((stock) => {
                const prevClose = Number(stock.previous_close) || Number(stock.current_price) || 1;
                const currentPrice = Number(stock.current_price) || 0;
                const up = currentPrice >= prevClose;
                const change = ((currentPrice - prevClose) / prevClose) * 100;

                return (
                  <div
                    key={stock.stock_id}
                    className="rounded-3xl border p-5 shadow-lg transition hover:-translate-y-1"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div
                          className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                        >
                          Watchlist
                        </div>
                        <h3 className="mt-3 text-2xl font-black">{stock.symbol}</h3>
                        <p className="mt-1 text-sm opacity-70">{stock.company_name}</p>
                      </div>

                      <div
                        className="rounded-2xl px-3 py-2 text-right"
                        style={{ background: "var(--surface)" }}
                      >
                        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                          Price
                        </p>
                        <p className="mt-1 text-lg font-bold">
                          Rs. {formatPrice(stock.current_price)}
                        </p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            up ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {up
                            ? `▲ ${change.toFixed(2)}%`
                            : `▼ ${Math.abs(change).toFixed(2)}%`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-sm opacity-70">Tracking active</span>
                      <button
                        type="button"
                        onClick={() => removeStock(stock.stock_id)}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-red-500 hover:text-white"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Watchlist;
