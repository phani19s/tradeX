import { useState, useEffect } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function ModifyHoldingModal({ isOpen, onClose, holding, onUpdate }) {
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [existingOrders, setExistingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (holding) {
      setQuantity(holding.quantity.toString());
      fetchExistingSLTP();
    }
  }, [holding]);

  async function fetchExistingSLTP() {
    try {
      const response = await api.get("/trade/sl-tp", getAuthHeaders());
      const filtered = response.data.filter(o => o.symbol === holding.symbol);
      setExistingOrders(filtered);
      
      if (filtered.length > 0) {
        // Set the form with the first one as default if needed, 
        // but maybe better to keep it empty for new targets
      }
    } catch (err) {
      console.error("Failed to fetch existing SL/TP", err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const stocksRes = await api.get("/stocks/", getAuthHeaders());
      const stock = stocksRes.data.find(s => s.symbol === holding.symbol);

      await api.post("/trade/sl-tp", {
        stock_id: stock.id,
        sl_price: slPrice ? parseFloat(slPrice) : null,
        tp_price: tpPrice ? parseFloat(tpPrice) : null,
        quantity: parseInt(quantity)
      }, getAuthHeaders());

      setSlPrice("");
      setTpPrice("");
      fetchExistingSLTP();
      onUpdate();
      // Don't close immediately so they can add more targets if they want
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to set SL/TP");
    } finally {
      setLoading(false);
    }
  }

  const totalAssignedQuantity = existingOrders.reduce((sum, o) => sum + o.quantity, 0);
  const remainingVolume = holding ? holding.quantity - totalAssignedQuantity : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="w-full max-w-md my-8 rounded-[32px] border p-8 shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">Modify Holding</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex justify-between text-sm mb-1">
            <span className="opacity-60">Stock</span>
            <span className="font-bold">{holding.symbol}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="opacity-60">Buy Price</span>
            <span className="font-bold text-accent">₹{holding.buy_price}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="opacity-60">Current Price</span>
            <span className="font-bold">₹{holding.current_price}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="opacity-60">Owned Quantity</span>
            <span className="font-bold">{holding.quantity}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 mt-2 border-t border-white/10">
            <span className="font-bold opacity-80">Remaining Volume</span>
            <span className={`font-black ${remainingVolume > 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {remainingVolume}
            </span>
          </div>
        </div>

        {existingOrders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 ml-1">
              Active Targets
            </h3>
            <div className="space-y-2">
              {existingOrders.map((order, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-accent/10 text-xs">
                  <div>
                    <span className="font-bold">{order.quantity} shares</span>
                    {order.sl_price && <span className="ml-2 text-rose-500">SL: ₹{order.sl_price}</span>}
                    {order.tp_price && <span className="ml-2 text-emerald-500">TP: ₹{order.tp_price}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 ml-1">
            Add New Target
          </h3>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Stop Loss (SL) Price
            </label>
            <input
              type="number"
              step="0.01"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              placeholder="Sell if price drops below..."
              className="w-full rounded-2xl border bg-transparent p-4 outline-none focus:border-red-500/50 transition"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Take Profit (TP) Price
            </label>
            <input
              type="number"
              step="0.01"
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value)}
              placeholder="Sell if price rises above..."
              className="w-full rounded-2xl border bg-transparent p-4 outline-none focus:border-green-500/50 transition"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Quantity to Sell
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              max={holding.quantity}
              min="1"
              required
              className="w-full rounded-2xl border bg-transparent p-4 outline-none transition"
              style={{ borderColor: "var(--border)" }}
            />
            <p className="text-[10px] opacity-40 mt-2 ml-1 italic">
              *SL/TP will execute for this quantity when triggered.
            </p>
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {loading ? "Updating..." : "Save Conditions"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ModifyHoldingModal;
