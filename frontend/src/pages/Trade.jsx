/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import StockChart from "../components/StockChart";

import { useStocks }from "../context/StockContext";



function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Trade() {
  // const [stocks, setStocks] = useState([]);
  const {stocks: stockOptions} = useStocks();
  const [quantity, setQuantity] = useState("");
  const [selectedStock, setSelectedStock] = useState("");
  const [holdings, setHoldings] = useState([]);

  const fetchHoldings = async () => {
    try {
      const response = await api.get("/trade/holdings", getAuthHeaders());
      setHoldings(response.data);
    } catch (error) {
      console.error("Failed to fetch holdings", error);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  const selectedStockData = useMemo(
    () => stockOptions.find((stock) => String(stock.id) === String(selectedStock)),
    [stockOptions, selectedStock]
  );

  const selectedHolding = useMemo(() => {
    if (!selectedStockData) return null;
    return holdings.find((h) => h.symbol === selectedStockData.symbol);
  }, [selectedStockData, holdings]);

  const ownedQuantity = selectedHolding ? selectedHolding.quantity : 0;
  const profitLoss = selectedHolding ? selectedHolding.profit_loss : 0;

  const stockAdvice = useMemo(() => {
    if (!selectedStockData) return null;
    const change = ((selectedStockData.current_price - selectedStockData.previous_close) / selectedStockData.previous_close) * 100;
    if (change > 1.5) return { label: "Good to Buy", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (change < -1.5) return { label: "Risky", color: "text-rose-500", bg: "bg-rose-500/10" };
    return { label: "Moderate", color: "text-amber-500", bg: "bg-amber-500/10" };
  }, [selectedStockData]);

  const canTrade = Boolean(selectedStock) && Number(quantity) > 0;

  const buyStock = async () => {
    try {
      const response = await api.post(
        "/trade/buy",
        {
          stock_id: Number(selectedStock),
          quantity: Number(quantity),
        },
        getAuthHeaders()
      );

      toast.success(response.data.message);
      setQuantity("");
      fetchHoldings();
    } catch {
      toast.error("Buy Failed");
    }
  };

  const sellStock = async () => {
    try {
      const response = await api.post(
        "/trade/sell",
        {
          stock_id: Number(selectedStock),
          quantity: Number(quantity),
        },
        getAuthHeaders()
      );

      toast.success(response.data.message);
      setQuantity("");
      fetchHoldings();
    } catch {
      toast.error("Sell Failed");
    }
  };

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div
          className="mb-6 rounded-3xl border p-6 shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--card) 94%, transparent), color-mix(in srgb, var(--surface) 92%, transparent))",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">
                Live Trading
              </p>
              <h1 className="mt-3 text-4xl font-black md:text-5xl">
                Trade Stocks
              </h1>
              <p className="mt-3 text-sm leading-6 opacity-75 md:text-base">
                Browse the available market list, choose a stock, and place buy
                or sell orders with a cleaner trading panel.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Markets
                </p>
                <p className="mt-1 text-2xl font-black">{stockOptions.length}</p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Selected
                </p>
                <p className="mt-1 text-2xl font-black">
                  {selectedStockData ? selectedStockData.symbol : "--"}
                  {selectedStockData && ownedQuantity > 0 && (
                    <span className="ml-2 text-sm font-bold text-accent">
                      ({ownedQuantity})
                    </span>
                  )}
                </p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Action
                </p>
                <p className="mt-1 text-2xl font-black">Buy / Sell</p>
              </div>
              <div
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  View
                </p>
                <p className="mt-1 text-2xl font-black">Live</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stockOptions.map((stock) => {
              const isSelected = String(stock.id) === String(selectedStock);
              const holding = holdings.find((h) => h.symbol === stock.symbol);
              const owned = holding ? holding.quantity : 0;

              return (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => setSelectedStock(String(stock.id))}
                  className="rounded-3xl border p-5 text-left shadow-lg transition hover:-translate-y-1"
                  style={{
                    background: isSelected ? "var(--accent-soft)" : "var(--card)",
                    borderColor: isSelected ? "var(--accent-border)" : "var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                        style={{
                          background: "var(--surface)",
                          color: "var(--accent)",
                        }}
                      >
                        {isSelected ? "Selected" : (owned > 0 ? `Owned: ${owned}` : "Stock")}
                      </div>
                      <h3 className="mt-3 text-2xl font-black">{stock.symbol}</h3>
                    </div>
                    <div
                      className="rounded-2xl px-3 py-2 text-right"
                      style={{ background: "var(--surface)" }}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                        Price
                      </p>
                      <p className="mt-1 text-base font-bold">
                        Rs. {formatPrice(stock.current_price)}
                      </p>
                        {Number(stock.current_price) >
                         Number(stock.previous_close) ? (
                        
                          <p className="mt-1 text-xs font-semibold text-emerald-500">
                            ▲
                            {(
                              (
                                stock.current_price -
                                stock.previous_close
                              ) /
                              stock.previous_close
                            * 100
                            ).toFixed(2)}
                            %
                          </p>
                        
                        ) : (
                        
                          <p className="mt-1 text-xs font-semibold text-rose-500">
                            ▼
                            {Math.abs(
                              (
                                (
                                  stock.current_price -
                                  stock.previous_close
                                ) /
                                stock.previous_close
                              ) * 100
                            ).toFixed(2)}
                            %
                          </p>
                        
                        )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 opacity-75">
                    {stock.company_name}
                  </p>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-3xl border p-6 shadow-lg"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Trade Ticket</h2>
                <p className="mt-1 text-sm opacity-70">
                  Choose a stock and place your order from one panel.
                </p>
              </div>
              <div
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Action Center
              </div>
            </div>

            <div
              className="mt-6 rounded-2xl border p-4"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex justify-between items-center">
                <p className="text-xs uppercase tracking-[0.25em] opacity-60">
                  Selected Stock
                </p>
                <div className="flex flex-col items-end gap-1.5">
                  {stockAdvice && (
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ${stockAdvice.bg} ${stockAdvice.color} border border-current/10`}>
                      {stockAdvice.label}
                    </span>
                  )}
                  {selectedStockData && ownedQuantity > 0 && (
                    <div className="text-right">
                      <p className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full inline-block">
                        Owned: {ownedQuantity}
                      </p>
                      <p className={`text-[10px] font-bold mt-1 ${profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {profitLoss >= 0 ? "+" : ""}₹{formatPrice(profitLoss)} P&L
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-2xl font-black">
                {selectedStockData ? selectedStockData.symbol : "None"}
              </p>
              <p className="mt-1 text-sm opacity-70">
                {selectedStockData
                  ? selectedStockData.company_name
                  : "Click a stock card to load it here."}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="text-sm font-semibold opacity-80" htmlFor="trade-stock">
                Stock
              </label>
              <select
                id="trade-stock"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:ring-2"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              >
                <option value="">Select Stock</option>
                {stockOptions.map((stock) => {
                  const holding = holdings.find((h) => h.symbol === stock.symbol);
                  const owned = holding ? holding.quantity : 0;
                  return (
                    <option key={stock.id} value={stock.id}>
                      {stock.symbol} - {stock.company_name} {owned > 0 ? `(Owned: ${owned})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="text-sm font-semibold opacity-80" htmlFor="quantity">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:ring-2"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              />
            </div>

            <div
              className="mt-6 rounded-2xl border p-4"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Order Ready</span>
                <span className={canTrade ? "font-semibold" : "font-semibold opacity-50"}>
                  {canTrade ? "Yes" : "Not yet"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={buyStock}
                disabled={!canTrade}
                className="rounded-2xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Buy
              </button>

              <button
                type="button"
                onClick={sellStock}
                disabled={!canTrade}
                className="rounded-2xl border px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                Sell
              </button>
            </div>

            {selectedStockData && (
              <StockChart 
                currentPrice={selectedStockData.current_price} 
                previousClose={selectedStockData.previous_close} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Trade;
