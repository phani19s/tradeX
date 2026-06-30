/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

const suggestedQuestions = [
  "Should I buy Infosys?",
  "Analyze my portfolio.",
  "What is the riskiest stock?",
  "Show market sentiment.",
];

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function AiAssistant() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef(null);

  // AI Advisor Tab selection
  const [activeTab, setActiveTab] = useState("chat"); // chat, portfolio, simulator, recommendations, market

  // 1. Portfolio Analysis State
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);
  const [portfolioSuggestions, setPortfolioSuggestions] = useState(null);
  const [portfolioAlerts, setPortfolioAlerts] = useState(null);
  const [analyzingPortfolio, setAnalyzingPortfolio] = useState(false);

  // 2. Trading Simulator State
  const [simInitial, setSimInitial] = useState(50000);
  const [simMonthly, setSimMonthly] = useState(5000);
  const [simYears, setSimYears] = useState(5);
  const [simSymbol, setSimSymbol] = useState("RELIANCE");
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // 3. Recommendation State
  const [recType, setRecType] = useState("long_term");
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // 4. Market Insights State
  const [marketInsights, setMarketInsights] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(false);

  async function fetchHistory() {
    try {
      const response = await api.get("/ai/chat/history", getAuthHeaders());
      setHistory(response.data);
    } catch (error) {
      console.error("Failed to load chat history", error);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle Tab transitions auto-fetch
  useEffect(() => {
    if (activeTab === "recommendations") {
      fetchRecommendations(recType);
    } else if (activeTab === "market") {
      fetchMarketInsights();
    }
  }, [activeTab, recType]);

  async function sendMessage(nextMessage = message) {
    const text = nextMessage.trim();
    if (!text || loading) return;

    setMessage("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);

    try {
      const response = await api.post("/ai/chat", { message: text }, getAuthHeaders());
      setMessages((current) => [...current, { role: "assistant", text: response.data.answer }]);
      fetchHistory();
    } catch (error) {
      const fallback = error.response?.data?.detail || "Unable to answer right now. Please try again.";
      setMessages((current) => [...current, { role: "assistant", text: fallback }]);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (clearing || history.length === 0) return;

    setClearing(true);
    try {
      await api.delete("/ai/chat/history", getAuthHeaders());
      setHistory([]);
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear chat history", error);
    } finally {
      setClearing(false);
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await api.delete(`/ai/chat/history/${id}`, getAuthHeaders());
      setHistory((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete chat history item", error);
    }
  }

  // --- AI ADVISOR METHODS ---
  async function runPortfolioAnalysis() {
    setAnalyzingPortfolio(true);
    try {
      const [resAnalysis, resSuggestions, resAlerts] = await Promise.all([
        api.get("/ai/portfolio-analysis", getAuthHeaders()),
        api.get("/ai/portfolio-suggestions", getAuthHeaders()),
        api.get("/ai/portfolio-alerts", getAuthHeaders())
      ]);
      setPortfolioAnalysis(resAnalysis.data);
      setPortfolioSuggestions(resSuggestions.data.suggestions);
      setPortfolioAlerts(resAlerts.data.alerts);
      toast.success("AI Portfolio analysis and health check complete!");
    } catch (error) {
      toast.error("Failed to load portfolio analysis reports.");
    } finally {
      setAnalyzingPortfolio(false);
    }
  }

  async function runSimulation(e) {
    e.preventDefault();
    setSimulating(true);
    try {
      const response = await api.post("/ai/trading-simulation", {
        initial_amount: Number(simInitial),
        monthly_amount: Number(simMonthly),
        years: Number(simYears),
        symbol: simSymbol
      }, getAuthHeaders());
      setSimResult(response.data);
      toast.success("Investment simulation calculated successfully!");
    } catch (error) {
      toast.error("Failed to run simulator. Check stock symbol.");
    } finally {
      setSimulating(false);
    }
  }

  async function fetchRecommendations(type) {
    setLoadingRecs(true);
    try {
      const response = await api.get(`/ai/stock-recommendations?rec_type=${type}`, getAuthHeaders());
      setRecommendations(response.data.recommendations);
    } catch (error) {
      toast.error("Failed to fetch stock recommendations.");
    } finally {
      setLoadingRecs(false);
    }
  }

  async function fetchMarketInsights() {
    setLoadingMarket(true);
    try {
      const response = await api.get("/ai/market-insights", getAuthHeaders());
      setMarketInsights(response.data);
    } catch (error) {
      toast.error("Failed to load daily market insights.");
    } finally {
      setLoadingMarket(false);
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px]">
          
          {/* Main AI Advisor Panel */}
          <section className="flex min-h-[72vh] flex-col rounded-[28px] border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            
            {/* Header Block */}
            <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">TradeX AI</p>
              <h1 className="mt-2 text-3xl font-black">AI Investment Advisor</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                Get personalized investment recommendations, simulate trading projections, analyze portfolio risk, and check market sentiment.
              </p>

              {/* Tabs Switcher */}
              <div className="flex border-b overflow-x-auto mt-5 gap-1" style={{ borderColor: "var(--border)" }}>
                {[
                  { id: "chat", label: "Advisor Chat" },
                  { id: "portfolio", label: "Portfolio Analysis" },
                  { id: "simulator", label: "Trading Simulator" },
                  { id: "recommendations", label: "Stock Recommendations" },
                  { id: "market", label: "Market Insights" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-xs font-extrabold whitespace-nowrap border-b-2 transition cursor-pointer`}
                    style={{
                      color: activeTab === tab.id ? "var(--accent)" : "var(--text)",
                      borderColor: activeTab === tab.id ? "var(--accent)" : "transparent",
                      opacity: activeTab === tab.id ? 1.0 : 0.65
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeTab === "chat" && (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-5 min-h-[400px]">
                  {messages.length === 0 && (
                    <div className="rounded-2xl border p-5 text-sm leading-6 opacity-75 animate-in fade-in" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      Ask about a stock, your portfolio risk, live prices, predictions, or investment advice.
                    </div>
                  )}

                  {messages.map((item, index) => (
                    <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 duration-150`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                          item.role === "user" ? "text-white animate-in zoom-in-50" : "border"
                        }`}
                        style={item.role === "user"
                          ? { background: "var(--accent)" }
                          : { background: "var(--surface)", borderColor: "var(--border)" }}
                      >
                        {item.text}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="inline-flex rounded-2xl border px-4 py-3 text-sm opacity-70 animate-pulse" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      Thinking...
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input block */}
                <div className="border-t p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => sendMessage(question)}
                        className="rounded-full border px-3 py-1 text-xs font-bold transition hover:opacity-80 cursor-pointer"
                        style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>

                  <form
                    className="flex gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendMessage();
                    }}
                  >
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Ask TradeX Advisor..."
                      className="flex-1 rounded-2xl border px-4 py-3 outline-none"
                      style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-2xl px-5 py-3 font-bold text-white disabled:opacity-50 cursor-pointer transition hover:opacity-90"
                      style={{ background: "var(--accent)" }}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* TAB CONTENT: PORTFOLIO ANALYSIS */}
            {activeTab === "portfolio" && (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-[450px]">
                <div className="flex justify-between items-center bg-surface/30 p-4 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h3 className="font-bold text-base">Analyze Current Portfolio Holdings</h3>
                    <p className="text-xs opacity-60 mt-1">Evaluates asset allocation, risk metrics, diversification, and growth possibilities.</p>
                  </div>
                  <button
                    onClick={runPortfolioAnalysis}
                    disabled={analyzingPortfolio}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 cursor-pointer hover:opacity-90 transition"
                    style={{ background: "var(--accent)" }}
                  >
                    {analyzingPortfolio ? "Analyzing Portfolio..." : "Analyze My Portfolio"}
                  </button>
                </div>

                {portfolioAnalysis ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Top Stats Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Advisor Score</span>
                        <span className="text-3xl font-black text-accent mt-2 block" style={{ color: "var(--accent)" }}>{portfolioAnalysis.portfolio_score}/100</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Risk Level</span>
                        <span className={`text-3xl font-black mt-2 block ${
                          portfolioAnalysis.risk_level === "High" ? "text-rose-500" : (portfolioAnalysis.risk_level === "Medium" ? "text-amber-500" : "text-emerald-500")
                        }`}>{portfolioAnalysis.risk_level}</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Diversification</span>
                        <span className="text-3xl font-black mt-2 block text-sky-400">{portfolioAnalysis.diversification_score}/100</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Expected Return</span>
                        <span className="text-3xl font-black mt-2 block text-emerald-500">{portfolioAnalysis.expected_return}% p.a.</span>
                      </div>
                    </div>

                    {/* Overall Summary Card */}
                    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                      <h4 className="font-bold text-sm mb-2 opacity-80 uppercase tracking-wider">Overall Portfolio Health</h4>
                      <p className="text-sm leading-relaxed">{portfolioAnalysis.health}</p>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-3 text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Strengths
                        </h4>
                        <ul className="space-y-2 text-sm pl-4 list-disc opacity-90">
                          {portfolioAnalysis.strengths.map((str, idx) => (
                            <li key={idx}>{str}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-3 text-rose-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          Weaknesses
                        </h4>
                        <ul className="space-y-2 text-sm pl-4 list-disc opacity-90">
                          {portfolioAnalysis.weaknesses.map((wk, idx) => (
                            <li key={idx}>{wk}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* AI Suggestions Section */}
                    {portfolioSuggestions && (
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-4 opacity-80 uppercase tracking-wider">Advisor Recommendations</h4>
                        <div className="space-y-3">
                          {portfolioSuggestions.map((s, idx) => (
                            <div key={idx} className="border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: "var(--border)" }}>
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-sm text-accent" style={{ color: "var(--accent)" }}>{s.text}</span>
                                <span className="text-xs font-bold bg-accent/15 px-2.5 py-0.5 rounded-full text-accent" style={{ color: "var(--accent)" }}>
                                  Confidence: {s.confidence}%
                                </span>
                              </div>
                              <p className="text-xs opacity-75 mt-1">{s.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Portfolio Alerts */}
                    {portfolioAlerts && (
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-4 opacity-80 uppercase tracking-wider">Portfolio Risk Alerts</h4>
                        <div className="space-y-3">
                          {portfolioAlerts.map((a, idx) => (
                            <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border ${
                              a.severity === "Warning" ? "bg-amber-500/10 border-amber-500/20" : 
                              (a.severity === "Critical" ? "bg-rose-500/10 border-rose-500/20" : "bg-blue-500/10 border-blue-500/20")
                            }`}>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                a.severity === "Warning" ? "bg-amber-500/20 text-amber-400" : 
                                (a.severity === "Critical" ? "bg-rose-500/20 text-rose-400" : "bg-blue-500/20 text-blue-400")
                              }`}>{a.severity}</span>
                              <div>
                                <span className="font-bold text-xs block">{a.type}</span>
                                <p className="text-xs opacity-80 mt-0.5">{a.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center py-16 opacity-60">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-30 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ stroke: "var(--accent)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                    </svg>
                    <p className="text-sm font-semibold">Ready to analyze your investments</p>
                    <p className="text-xs opacity-75">Click "Analyze My Portfolio" to run a complete diagnostic report.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: TRADING SIMULATOR */}
            {activeTab === "simulator" && (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-[450px]">
                
                {/* Form Inputs */}
                <form onSubmit={runSimulation} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border rounded-2xl" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase opacity-65 mb-1.5">Initial Investment</label>
                    <input
                      type="number"
                      value={simInitial}
                      onChange={(e) => setSimInitial(e.target.value)}
                      className="rounded-xl border px-3 py-2 outline-none text-sm w-full"
                      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase opacity-65 mb-1.5">Monthly SIP Amount</label>
                    <input
                      type="number"
                      value={simMonthly}
                      onChange={(e) => setSimMonthly(e.target.value)}
                      className="rounded-xl border px-3 py-2 outline-none text-sm w-full"
                      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase opacity-65 mb-1.5">Duration (Years)</label>
                    <input
                      type="number"
                      value={simYears}
                      onChange={(e) => setSimYears(e.target.value)}
                      className="rounded-xl border px-3 py-2 outline-none text-sm w-full"
                      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase opacity-65 mb-1.5">Target Stock Symbol</label>
                    <input
                      type="text"
                      value={simSymbol}
                      onChange={(e) => setSimSymbol(e.target.value)}
                      placeholder="e.g. RELIANCE"
                      className="rounded-xl border px-3 py-2 outline-none text-sm w-full"
                      style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex items-end">
                    <button
                      type="submit"
                      disabled={simulating}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 cursor-pointer hover:opacity-90 transition w-full"
                      style={{ background: "var(--accent)" }}
                    >
                      {simulating ? "Projecting..." : "Simulate"}
                    </button>
                  </div>
                </form>

                {simResult ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Projection stats */}
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Future Valuation</span>
                        <span className="text-2xl font-black text-accent mt-2 block" style={{ color: "var(--accent)" }}>₹{formatMoney(simResult.future_value)}</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Estimated Profit</span>
                        <span className="text-2xl font-black text-emerald-500 mt-2 block">₹{formatMoney(simResult.estimated_profit)}</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Expected CAGR</span>
                        <span className="text-2xl font-black text-sky-400 mt-2 block">{simResult.cagr}%</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Probability of Success</span>
                        <span className="text-2xl font-black text-purple-400 mt-2 block">{simResult.probability_of_success}%</span>
                      </div>
                    </div>

                    {/* Chart area */}
                    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                      <h4 className="font-bold text-sm mb-4 opacity-80 uppercase tracking-wider">Growth Projection Timeline</h4>
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={simResult.chart_data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                            <defs>
                              <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                            <XAxis dataKey="year" stroke="var(--text)" opacity={0.8} fontSize={10} />
                            <YAxis stroke="var(--text)" opacity={0.8} fontSize={10} />
                            <Tooltip
                              contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                              formatter={(value) => [`₹${formatMoney(value)}`, "Expected Value"]}
                            />
                            <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#colorSim)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Scenarios and Recommendations */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-3 opacity-80 uppercase tracking-wider">Forecast Scenarios</h4>
                        <div className="space-y-3 text-xs leading-relaxed">
                          <div>
                            <span className="font-bold text-emerald-400 block">Best Case:</span>
                            <p className="opacity-90">{simResult.best_case_scenario}</p>
                          </div>
                          <div>
                            <span className="font-bold text-rose-400 block">Worst Case:</span>
                            <p className="opacity-90">{simResult.worst_case_scenario}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border p-5 flex flex-col justify-between" style={{ borderColor: "var(--border)" }}>
                        <div>
                          <h4 className="font-bold text-sm mb-2 opacity-80 uppercase tracking-wider">Advisor Investment Recommendation</h4>
                          <p className="text-sm leading-relaxed mt-2 italic opacity-95">"{simResult.investment_recommendation}"</p>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                          <span className="text-xs opacity-60">Risk profile assigned:</span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                            simResult.risk_level === "High" ? "bg-rose-500/10 text-rose-500" :
                            (simResult.risk_level === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")
                          }`}>{simResult.risk_level} Risk</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-16 opacity-60">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-30 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ stroke: "var(--accent)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-semibold">Simulate Future Investments</p>
                    <p className="text-xs opacity-75">Provide principal amounts and durations above to plot growth projections.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: STOCK RECOMMENDATIONS */}
            {activeTab === "recommendations" && (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-[450px]">
                
                {/* Recommendations filter buttons */}
                <div className="flex flex-wrap gap-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  {[
                    { id: "long_term", label: "Long-term Investment" },
                    { id: "low_risk", label: "Low Risk Stocks" },
                    { id: "high_growth", label: "High Growth Potential" },
                    { id: "dividend", label: "High Dividend Yield" },
                    { id: "portfolio_based", label: "Matching Portfolio" }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setRecType(type.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer`}
                      style={{
                        borderColor: recType === type.id ? "var(--accent)" : "var(--border)",
                        background: recType === type.id ? "var(--accent)" : "transparent",
                        color: recType === type.id ? "#fff" : "var(--text)"
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {loadingRecs ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                    <span className="ml-3 text-sm opacity-70">Sifting target recommendations...</span>
                  </div>
                ) : recommendations.length === 0 ? (
                  <p className="text-center text-sm opacity-50 py-16">No stock recommendations found for this sector category.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-200">
                    {recommendations.map((r, idx) => (
                      <div key={idx} className="rounded-2xl border p-5 flex flex-col justify-between" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-base text-accent" style={{ color: "var(--accent)" }}>{r.symbol}</h4>
                              <span className="text-xs opacity-60 font-semibold">{r.company_name}</span>
                            </div>
                            <span className="text-[10px] font-extrabold bg-accent/15 px-2 py-0.5 rounded text-accent" style={{ color: "var(--accent)" }}>
                              Confidence {r.confidence}%
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                            <div>
                              <span className="opacity-50 block">Current Price</span>
                              <span className="font-bold">₹{formatMoney(r.price)}</span>
                            </div>
                            <div>
                              <span className="opacity-50 block">Target Outlook</span>
                              <span className="font-bold text-emerald-400">{r.growth}</span>
                            </div>
                            <div>
                              <span className="opacity-50 block">Risk Profile</span>
                              <span className={`font-bold ${
                                r.risk_level === "High" ? "text-rose-500" : (r.risk_level === "Medium" ? "text-amber-500" : "text-emerald-500")
                              }`}>{r.risk_level}</span>
                            </div>
                          </div>

                          <p className="text-xs leading-relaxed mt-4 border-t pt-3 opacity-85" style={{ borderColor: "var(--border)" }}>
                            {r.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: MARKET INSIGHTS */}
            {activeTab === "market" && (
              <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-[450px]">
                {loadingMarket ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                    <span className="ml-3 text-sm opacity-70">Collecting market metrics...</span>
                  </div>
                ) : marketInsights ? (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Insights Summary Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Overall Sentiment</span>
                        <span className={`text-2xl font-black mt-2 block ${
                          marketInsights.market_sentiment === "Bullish" ? "text-emerald-500" : (marketInsights.market_sentiment === "Bearish" ? "text-rose-500" : "text-amber-500")
                        }`}>{marketInsights.market_sentiment}</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Market Risk Level</span>
                        <span className={`text-2xl font-black mt-2 block ${
                          marketInsights.market_risk_level === "High" ? "text-rose-500" : (marketInsights.market_risk_level === "Medium" ? "text-amber-500" : "text-emerald-500")
                        }`}>{marketInsights.market_risk_level}</span>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <span className="text-xs opacity-60 block uppercase font-bold tracking-wider">Trending Sectors</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {marketInsights.trending_sectors.map((sec, idx) => (
                            <span key={idx} className="text-[10px] font-bold bg-accent/15 px-2 py-0.5 rounded text-accent" style={{ color: "var(--accent)" }}>{sec}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Top Movers Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                      
                      {/* Gainers */}
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-extrabold text-sm mb-3 text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          Top Gainers
                        </h4>
                        <div className="space-y-2">
                          {marketInsights.top_gainers.map((g, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                              <div>
                                <span className="font-bold block">{g.symbol}</span>
                                <span className="opacity-50 block text-[10px]">{g.company_name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold block">₹{formatMoney(g.price)}</span>
                                <span className="font-extrabold text-emerald-500 text-[10px]">+{g.change}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Losers */}
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-extrabold text-sm mb-3 text-rose-400 uppercase tracking-wider flex items-center gap-2">
                          Top Losers
                        </h4>
                        <div className="space-y-2">
                          {marketInsights.top_losers.map((l, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                              <div>
                                <span className="font-bold block">{l.symbol}</span>
                                <span className="opacity-50 block text-[10px]">{l.company_name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold block">₹{formatMoney(l.price)}</span>
                                <span className="font-extrabold text-rose-500 text-[10px]">{l.change}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Key opportunities & News summaries */}
                    <div className="grid md:grid-cols-2 gap-4">
                      
                      {/* Opportunities */}
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-3 opacity-80 uppercase tracking-wider">Investment Opportunities</h4>
                        <ul className="space-y-2 text-xs pl-4 list-disc opacity-90 leading-relaxed">
                          {marketInsights.opportunities.map((o, idx) => (
                            <li key={idx}>{o}</li>
                          ))}
                        </ul>
                      </div>

                      {/* News summary */}
                      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)" }}>
                        <h4 className="font-bold text-sm mb-3 opacity-80 uppercase tracking-wider">Market News Highlights</h4>
                        <ul className="space-y-2 text-xs pl-4 list-disc opacity-90 leading-relaxed">
                          {marketInsights.news_summary.map((n, idx) => (
                            <li key={idx}>{n}</li>
                          ))}
                        </ul>
                      </div>

                    </div>

                  </div>
                ) : (
                  <p className="text-center text-sm opacity-50 py-16">No market insights found. Please refresh.</p>
                )}
              </div>
            )}

          </section>

          {/* Conversation History Sidebar */}
          <aside className="rounded-[28px] border p-5 shadow-xl h-fit" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Conversation History</h2>
                <p className="mt-1 text-xs opacity-60">Saved questions and answers from your AI assistant.</p>
              </div>
              <button
                type="button"
                onClick={clearHistory}
                disabled={clearing || history.length === 0}
                className="rounded-xl border border-rose-500/20 px-3 py-2 text-xs font-bold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <p className="text-sm opacity-60">No AI questions yet.</p>
              ) : history.map((item) => (
                <div key={item.id} className="relative rounded-2xl border p-4 pr-11 animate-in fade-in" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    onClick={() => deleteHistoryItem(item.id)}
                    className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-black text-rose-500 transition hover:bg-rose-500/10 cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                    aria-label="Delete chat history item"
                    title="Delete"
                  >
                    X
                  </button>
                  <p className="text-sm font-bold">{item.question}</p>
                  <p className="mt-2 text-xs leading-5 opacity-70 whitespace-pre-wrap">{item.answer}</p>
                </div>
              ))}
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

export default AiAssistant;
