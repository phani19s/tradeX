import { useState, useEffect } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function ModifyAutoBuyModal({ isOpen, onClose, order, onUpdate }) {
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order) {
      setPrice(order.buy_price.toString());
      setQuantity(order.quantity.toString());
    }
  }, [order]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.patch(`/trade/sl-tp/${order.id}?new_price=${parseFloat(price)}&new_quantity=${parseInt(quantity)}`, {}, getAuthHeaders());
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update order");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-md rounded-[32px] border p-8 shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">Modify Auto-Buy</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex justify-between text-sm mb-1">
            <span className="opacity-60">Stock</span>
            <span className="font-bold">{order.symbol}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Target Price
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-2xl border bg-transparent p-4 outline-none focus:border-accent transition"
              style={{ borderColor: "var(--border)" }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              required
              className="w-full rounded-2xl border bg-transparent p-4 outline-none transition focus:border-accent"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {loading ? "Updating..." : "Update Order"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ModifyAutoBuyModal;
