/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import { useStocks } from "../context/StockContext";

const conditionLabels = {
  GREATER_THAN: ">",
  LESS_THAN: "<",
  GREATER_EQUAL: ">=",
  LESS_EQUAL: "<=",
};

const conditionText = {
  GREATER_THAN: "moves above",
  LESS_THAN: "moves below",
  GREATER_EQUAL: "reaches or moves above",
  LESS_EQUAL: "reaches or moves below",
};

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function Alerts() {
  const { stocks } = useStocks();
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ symbol: "", condition_type: "GREATER_THAN", target_price: "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.symbol === form.symbol),
    [form.symbol, stocks]
  );

  async function fetchAlerts() {
    try {
      const response = await api.get("/alerts/", getAuthHeaders());
      setAlerts(response.data);
    } catch (error) {
      console.error("Failed to load alerts", error);
    }
  }

  useEffect(() => {
    fetchAlerts();
  }, []);

  const activeAlerts = useMemo(() => alerts.filter((alert) => !alert.triggered), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter((alert) => alert.triggered), [alerts]);

  async function saveAlert(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = {
        symbol: form.symbol,
        condition_type: form.condition_type,
        target_price: Number(form.target_price),
      };

      if (editingId) {
        await api.put(`/alerts/${editingId}`, payload, getAuthHeaders());
      } else {
        await api.post("/alerts/", payload, getAuthHeaders());
      }

      setForm({ symbol: "", condition_type: "GREATER_THAN", target_price: "" });
      setEditingId(null);
      fetchAlerts();
    } finally {
      setLoading(false);
    }
  }

  async function deleteAlert(id) {
    await api.delete(`/alerts/${id}`, getAuthHeaders());
    fetchAlerts();
  }

  function editAlert(alert) {
    setEditingId(alert.id);
    setForm({
      symbol: alert.symbol,
      condition_type: alert.condition_type,
      target_price: String(alert.target_price),
    });
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[28px] border p-6 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Price Monitoring</p>
            <h1 className="mt-2 text-4xl font-black">Alerts</h1>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Create a rule once, and TradeX will notify you when the live stock price crosses it.
            </p>
          </div>

          <form onSubmit={saveAlert} className="grid gap-3 rounded-[28px] border p-5 shadow-xl md:grid-cols-[1fr_180px_180px_140px]" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <select
              value={form.symbol}
              onChange={(event) => setForm({ ...form, symbol: event.target.value })}
              required
              className="rounded-2xl border px-4 py-3 outline-none"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            >
              <option value="">Select Stock</option>
              {stocks.map((stock) => (
                <option key={stock.id} value={stock.symbol}>{stock.symbol} - {stock.company_name}</option>
              ))}
            </select>
            <select
              value={form.condition_type}
              onChange={(event) => setForm({ ...form, condition_type: event.target.value })}
              className="rounded-2xl border px-4 py-3 outline-none"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            >
              {Object.entries(conditionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={form.target_price}
              onChange={(event) => setForm({ ...form, target_price: event.target.value })}
              placeholder="Target price"
              required
              className="rounded-2xl border px-4 py-3 outline-none"
              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
            />
            <button type="submit" disabled={loading} className="rounded-2xl px-4 py-3 font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {editingId ? "Update" : "Create"}
            </button>
            <div className="rounded-2xl border px-4 py-3 text-sm opacity-75 md:col-span-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              {selectedStock ? (
                <>
                  Current {selectedStock.symbol} price is <span className="font-bold">Rs. {formatMoney(selectedStock.current_price)}</span>. Alert will fire when it {conditionText[form.condition_type]} Rs. {formatMoney(form.target_price)}.
                </>
              ) : (
                "Choose a stock to see its live price and alert explanation."
              )}
            </div>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ["Active Alerts", activeAlerts],
              ["Triggered Alerts", triggeredAlerts],
            ].map(([title, rows]) => (
              <section key={title} className="rounded-[28px] border p-5 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-2xl font-black">{title}</h2>
                <div className="mt-4 space-y-3">
                  {rows.length === 0 ? (
                    <p className="text-sm opacity-60">No alerts here.</p>
                  ) : rows.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <div>
                        <p className="font-black">{alert.symbol} {conditionLabels[alert.condition_type]} Rs. {formatMoney(alert.target_price)}</p>
                        <p className="mt-1 text-xs opacity-60">
                          {alert.triggered
                            ? `Triggered ${alert.triggered_at || ""}`
                            : `Watching until ${alert.symbol} ${conditionText[alert.condition_type]} Rs. ${formatMoney(alert.target_price)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!alert.triggered && (
                          <button type="button" onClick={() => editAlert(alert)} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--border)" }}>Edit</button>
                        )}
                        <button type="button" onClick={() => deleteAlert(alert.id)} className="rounded-xl border border-rose-500/20 px-3 py-2 text-xs font-bold text-rose-500">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Alerts;
