/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

const suggestedQuestions = [
  "Should I buy Infosys?",
  "Analyze my portfolio.",
  "What is the riskiest stock?",
  "Show market sentiment.",
];

function AiAssistant() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef(null);

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

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px]">
          <section className="flex min-h-[72vh] flex-col rounded-[28px] border shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">TradeX AI</p>
              <h1 className="mt-2 text-3xl font-black">AI Trading Assistant</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-70">
                Answers combine live prices, your holdings, portfolio risk, AI prediction signals, and market sentiment.
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="rounded-2xl border p-5 text-sm leading-6 opacity-75" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  Ask about a stock, your portfolio risk, live prices, predictions, or sentiment.
                </div>
              )}

              {messages.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      item.role === "user" ? "text-white" : "border"
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
                <div className="inline-flex rounded-2xl border px-4 py-3 text-sm opacity-70" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  Thinking...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-5" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="rounded-full border px-3 py-1 text-xs font-bold transition hover:opacity-80"
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
                  placeholder="Ask TradeX AI..."
                  className="flex-1 rounded-2xl border px-4 py-3 outline-none"
                  style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl px-5 py-3 font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  Send
                </button>
              </form>
            </div>
          </section>

          <aside className="rounded-[28px] border p-5 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Conversation History</h2>
                <p className="mt-1 text-xs opacity-60">Saved questions and answers from your AI assistant.</p>
              </div>
              <button
                type="button"
                onClick={clearHistory}
                disabled={clearing || history.length === 0}
                className="rounded-xl border border-rose-500/20 px-3 py-2 text-xs font-bold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-40"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm opacity-60">No AI questions yet.</p>
              ) : history.map((item) => (
                <div key={item.id} className="relative rounded-2xl border p-4 pr-11" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    onClick={() => deleteHistoryItem(item.id)}
                    className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-black text-rose-500 transition hover:bg-rose-500/10"
                    style={{ borderColor: "var(--border)" }}
                    aria-label="Delete chat history item"
                    title="Delete"
                  >
                    X
                  </button>
                  <p className="text-sm font-bold">{item.question}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 opacity-70">{item.answer}</p>
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
