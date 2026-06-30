import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import ActiveBanners from "../components/ActiveBanners";

const LOCAL_CACHE_KEY = "tradex-market-insights-latest";

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(Number(value || 0));
}

function formatMoney(value) {
  return `₹${formatNumber(value)}`;
}

function getGreeting(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getStatusStyle(status) {
  if (status === "Market Rising") {
    return { icon: "🟢", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" };
  }
  if (status === "Market Falling") {
    return { icon: "🔴", tone: "border-rose-500/30 bg-rose-500/10 text-rose-500" };
  }
  return { icon: "🟡", tone: "border-amber-500/30 bg-amber-500/10 text-amber-500" };
}

function MovementCard({ title, item, tone }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-55">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-black">{item?.symbol || "N/A"}</p>
          <p className="mt-1 text-xs opacity-60">{item?.company_name || "No market data"}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{formatMoney(item?.price)}</p>
          <p className={`mt-1 text-sm font-black ${tone}`}>{Number(item?.change_pct || 0) >= 0 ? "+" : ""}{formatNumber(item?.change_pct)}%</p>
        </div>
      </div>
    </div>
  );
}

function InsightList({ title, items, accent = "var(--accent)" }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-black uppercase tracking-[0.18em]">{title}</h3>
      <div className="mt-4 space-y-3">
        {(items || []).length === 0 ? (
          <p className="text-sm opacity-55">No insights available.</p>
        ) : (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="flex gap-3 text-sm leading-6">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="opacity-80">{item}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MarketInsights() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState("");
  const [now, setNow] = useState(new Date());

  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "null"),
    []
  );

  const loadInsights = useCallback(async (forceRefresh = false) => {
    forceRefresh ? setRefreshing(true) : setLoading(true);
    setWarning("");

    try {
      const response = await api.get("/ai/market-insights/daily", {
        ...getAuthHeaders(),
        params: { refresh: forceRefresh },
      });
      setInsights(response.data);
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(response.data));
      if (forceRefresh) toast.success("Market insights refreshed");
    } catch (error) {
      const saved = localStorage.getItem(LOCAL_CACHE_KEY);
      if (saved) {
        setInsights(JSON.parse(saved));
        setWarning("Latest market data is temporarily unavailable. Showing the most recent saved summary.");
      } else {
        setWarning(error.response?.data?.detail || "Market insights are temporarily unavailable.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.is_admin || currentUser.role !== "Trader") {
      navigate(currentUser?.is_admin ? "/admin" : "/dashboard", { replace: true });
      return;
    }

    const initialLoad = window.setTimeout(() => loadInsights(), 0);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const current = new Date();
    const nextDay = new Date(current);
    nextDay.setHours(24, 0, 5, 0);
    let dailyInterval;
    const dailyTimeout = window.setTimeout(() => {
      loadInsights();
      dailyInterval = window.setInterval(() => loadInsights(), 24 * 60 * 60 * 1000);
    }, nextDay.getTime() - current.getTime());

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(clock);
      window.clearTimeout(dailyTimeout);
      if (dailyInterval) window.clearInterval(dailyInterval);
    };
  }, [currentUser, loadInsights, navigate]);

  const summary = insights?.summary;
  const watch = insights?.what_to_watch;
  const analysis = insights?.ai_analysis;
  const statistics = insights?.statistics;
  const status = getStatusStyle(summary?.market_status);

  const statisticCards = [
    { label: "Total Market Volume", value: formatMoney(statistics?.total_volume) },
    { label: "Total Trades Today", value: formatNumber(statistics?.total_trades, 0) },
    { label: "Top Performing Sector", value: statistics?.top_sector || "N/A" },
    { label: "Worst Performing Sector", value: statistics?.worst_sector || "N/A" },
    { label: "Market Volatility", value: `${formatNumber(statistics?.volatility)}%` },
    { label: "Active Stocks", value: formatNumber(statistics?.active_stocks_count, 0) },
  ];

  if (loading && !insights) {
    return (
      <div className="page-bg min-h-screen">
        <Navbar />
        <div className="theme-main flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-current border-t-transparent" style={{ color: "var(--accent)" }} />
            <p className="mt-4 font-bold">Preparing today&apos;s market insights...</p>
            <p className="mt-1 text-sm opacity-60">Analyzing active stocks, trades, sectors, and market risk.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />
      <main className="theme-main space-y-6 px-4 py-6 md:px-6">
        <ActiveBanners />
        <section
          className="overflow-hidden rounded-[30px] border p-6 shadow-xl md:p-8"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--card) 94%, transparent), color-mix(in srgb, var(--accent) 10%, var(--surface)))",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: "var(--accent)" }}>Daily intelligence</p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">
                {getGreeting(now)}, {currentUser?.username || "Trader"} 👋
              </h1>
              <p className="mt-3 text-sm opacity-70 md:text-base">
                {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {" · "}
                {now.toLocaleTimeString("en-IN")}
              </p>
              <p className="mt-2 text-xs opacity-50">
                Source: {insights?.data_source || "TradeX market data"}
                {insights?.cache?.is_cached ? " · Daily cached analysis" : " · Freshly generated"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadInsights(true)}
              disabled={refreshing}
              className="rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-90 disabled:cursor-wait disabled:opacity-55"
              style={{ background: "var(--accent)" }}
            >
              {refreshing ? "Refreshing analysis..." : "Refresh Market Data"}
            </button>
          </div>
        </section>

        {warning && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-500">
            {warning}
          </div>
        )}

        {insights ? (
          <>
            <section className="rounded-[28px] border p-5 shadow-lg md:p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] opacity-50">Daily Market Summary</p>
                  <h2 className="mt-2 text-2xl font-black">Today&apos;s market at a glance</h2>
                </div>
                <div className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-black ${status.tone}`}>
                  <span>{status.icon}</span>
                  {summary?.market_status || "Market Stable"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {[
                  { label: "NIFTY 50", data: summary?.nifty_50 },
                  { label: "SENSEX", data: summary?.sensex },
                ].map((index) => (
                  <div key={index.label} className="rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] opacity-55">{index.label}</p>
                        <p className="mt-2 text-3xl font-black">{formatNumber(index.data?.current_price)}</p>
                      </div>
                      <div className={`text-right font-black ${Number(index.data?.change_pct || 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        <p>{Number(index.data?.change_pct || 0) >= 0 ? "+" : ""}{formatNumber(index.data?.change_pct)}%</p>
                        <p className="mt-1 text-xs">{Number(index.data?.change_val || 0) >= 0 ? "+" : ""}{formatNumber(index.data?.change_val)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <MovementCard title="Top Gainer" item={summary?.top_gainer} tone="text-emerald-500" />
                <MovementCard title="Top Loser" item={summary?.top_loser} tone="text-rose-500" />
                <MovementCard title="Most Active Stock" item={summary?.most_active} tone={Number(summary?.most_active?.change_pct || 0) >= 0 ? "text-emerald-500" : "text-rose-500"} />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border p-5" style={{ borderColor: "var(--accent-border)", background: "var(--accent-soft)" }}>
                  <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>AI Market Summary</p>
                  <p className="mt-3 text-sm leading-7 opacity-85">{summary?.ai_summary}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Trading Tip of the Day</p>
                  <p className="mt-3 text-sm leading-7 opacity-85">{summary?.trading_tip}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border p-5 shadow-lg md:p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs font-black uppercase tracking-[0.28em] opacity-50">What to Watch Today</p>
              <h2 className="mt-2 text-2xl font-black">Market opportunities and movement</h2>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <InsightList title="Top Sectors to Watch" items={watch?.sectors} />
                <InsightList title="Potential Investment Opportunities" items={watch?.opportunities} accent="#22c55e" />
                <InsightList
                  title="Trending Stocks"
                  items={(watch?.trending_stocks || []).map((stock) => `${stock.symbol} · ${formatMoney(stock.price)} · ${Number(stock.change_pct || 0) >= 0 ? "+" : ""}${formatNumber(stock.change_pct)}%`)}
                  accent="#3b82f6"
                />
                <InsightList
                  title="Unusual Price Movement"
                  items={(watch?.unusual_movement || []).map((stock) => `${stock.symbol} moved ${Number(stock.change_pct || 0) >= 0 ? "+" : ""}${formatNumber(stock.change_pct)}% to ${formatMoney(stock.price)}`)}
                  accent="#f97316"
                />
              </div>
            </section>

            <section className="rounded-[28px] border p-5 shadow-lg md:p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="text-xs font-black uppercase tracking-[0.28em] opacity-50">AI Market Analysis</p>
              <h2 className="mt-2 text-2xl font-black">What is driving today&apos;s market</h2>
              <div className="mt-5 rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>Why the market is moving</p>
                <p className="mt-3 text-sm leading-7 opacity-85">{analysis?.reason_for_status}</p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InsightList title="Major Factors" items={analysis?.major_factors} />
                <InsightList title="Key Risks" items={analysis?.key_risks} accent="#f43f5e" />
                <InsightList title="Recommended Sectors" items={analysis?.recommended_sectors} accent="#22c55e" />
                <InsightList title="Stocks to Monitor" items={analysis?.stocks_to_monitor} accent="#3b82f6" />
              </div>
            </section>

            <section>
              <p className="text-xs font-black uppercase tracking-[0.28em] opacity-50">Market Statistics</p>
              <h2 className="mt-2 text-2xl font-black">Today&apos;s activity metrics</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {statisticCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border p-5 shadow-lg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                    <p className="text-xs font-black uppercase tracking-[0.18em] opacity-50">{card.label}</p>
                    <p className="mt-3 text-2xl font-black">{card.value}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[28px] border p-10 text-center shadow-lg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xl font-black">Market insights could not be loaded.</p>
            <p className="mt-2 text-sm opacity-60">Please use Refresh Market Data to try again.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default MarketInsights;
