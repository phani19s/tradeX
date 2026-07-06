/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import ConfirmDialog from "./ConfirmDialog";

function ModifyHoldingModal({ isOpen, onClose, holding, onUpdate }) {
  const [slPrice, setSlPrice] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [existingOrders, setExistingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetToDelete, setTargetToDelete] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);

  const fetchExistingSLTP = useCallback(async () => {
    if (!holding) return;

    try {
      const response = await api.get("/trade/sl-tp", getAuthHeaders());
      const filtered = response.data.filter((o) => o.symbol === holding.symbol);
      setExistingOrders(filtered);

      const assignedQuantity = filtered.reduce((sum, order) => sum + order.quantity, 0);
      const availableQuantity = Math.max((holding?.quantity || 0) - assignedQuantity, 0);
      if (!editingTarget) {
        setQuantity(availableQuantity > 0 ? availableQuantity.toString() : "");
      }
    } catch (err) {
      console.error("Failed to fetch existing SL/TP", err);
    }
  }, [editingTarget, holding]);

  useEffect(() => {
    fetchExistingSLTP();
  }, [fetchExistingSLTP]);

  useEffect(() => {
    if (isOpen) {
      setSlPrice("");
      setTpPrice("");
      setQuantity("");
      setError("");
      setEditingTarget(null);
    }
  }, [isOpen, holding]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const requestedQuantity = parseInt(quantity);

      if (!requestedQuantity || requestedQuantity > maxSellQuantity) {
        setError("Not available stocks");
        setLoading(false);
        return;
      }

      if (slPrice && Number(slPrice) >= Number(holding.current_price)) {
        setError("Stop Loss price must be less than current price");
        setLoading(false);
        return;
      }

      if (tpPrice && Number(tpPrice) <= Number(holding.current_price)) {
        setError("Take Profit price must be greater than current price");
        setLoading(false);
        return;
      }

      if (!slPrice && !tpPrice) {
        setError("Please set at least one target (Stop Loss or Take Profit)");
        setLoading(false);
        return;
      }

      if (editingTarget) {
        await api.patch(
          `/trade/sl-tp/${editingTarget.id}`,
          null,
          {
            ...getAuthHeaders(),
            params: {
              sl_price: slPrice ? parseFloat(slPrice) : undefined,
              tp_price: tpPrice ? parseFloat(tpPrice) : undefined,
              new_quantity: requestedQuantity,
            },
          }
        );
      } else {
        const stocksRes = await api.get("/stocks/", getAuthHeaders());
        const stock = stocksRes.data.find((s) => s.symbol === holding.symbol);

        await api.post(
          "/trade/sl-tp",
          {
            stock_id: stock.id,
            sl_price: slPrice ? parseFloat(slPrice) : null,
            tp_price: tpPrice ? parseFloat(tpPrice) : null,
            quantity: requestedQuantity,
          },
          getAuthHeaders()
        );
      }

      setSlPrice("");
      setTpPrice("");
      setEditingTarget(null);
      fetchExistingSLTP();
      onUpdate();
      // Don't close immediately so they can add more targets if they want.
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to set SL/TP");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTarget(orderId) {
    setLoading(true);
    setError("");

    try {
      await api.delete(`/trade/sl-tp/${orderId}`, getAuthHeaders());
      fetchExistingSLTP();
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete target");
    } finally {
      setLoading(false);
    }
  }

  function handleEditTarget(order) {
    setEditingTarget(order);
    setSlPrice(order.sl_price ? String(order.sl_price) : "");
    setTpPrice(order.tp_price ? String(order.tp_price) : "");
    setQuantity(String(order.quantity));
    setError("");
  }

  function cancelEditTarget() {
    setEditingTarget(null);
    setSlPrice("");
    setTpPrice("");
    const availableQuantity = Math.max((holding?.quantity || 0) - totalAssignedQuantity, 0);
    setQuantity(availableQuantity > 0 ? availableQuantity.toString() : "");
  }

  const totalAssignedQuantity = existingOrders.reduce((sum, o) => sum + o.quantity, 0);
  const remainingVolume = holding ? Math.max(holding.quantity - totalAssignedQuantity, 0) : 0;
  const maxSellQuantity = editingTarget ? remainingVolume + editingTarget.quantity : remainingVolume;

  const isSlValid = !slPrice || Number(slPrice) < Number(holding?.current_price || 0);
  const isTpValid = !tpPrice || Number(tpPrice) > Number(holding?.current_price || 0);
  const hasAtLeastOneTarget = Boolean(slPrice) || Boolean(tpPrice);
  const isFormValid = isSlValid && isTpValid && hasAtLeastOneTarget && Number(quantity) > 0 && Number(quantity) <= maxSellQuantity;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border shadow-2xl sm:my-8"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b p-5"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <h2 className="text-2xl font-black">Modify Holding</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg font-black opacity-70 transition hover:opacity-100"
            style={{ borderColor: "var(--border)" }}
            aria-label="Close modify holding"
          >
            x
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="opacity-60">Stock</span>
              <span className="font-bold">{holding.symbol}</span>
            </div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="opacity-60">Buy Price</span>
              <span className="font-bold text-accent">Rs. {holding.buy_price}</span>
            </div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="opacity-60">Current Price</span>
              <span className="font-bold">Rs. {holding.current_price}</span>
            </div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="opacity-60">Owned Quantity</span>
              <span className="font-bold">{holding.quantity}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm">
              <span className="font-bold opacity-80">Remaining Volume</span>
              <span className={`font-black ${remainingVolume > 0 ? "text-emerald-500" : "text-slate-500"}`}>
                {remainingVolume}
              </span>
            </div>
          </div>

          {existingOrders.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider opacity-60">
                Active Targets
              </h3>
              <div className="space-y-2">
                {existingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-accent/10 bg-accent/5 p-3 text-xs"
                  >
                    <div>
                      <span className="font-bold">{order.quantity} shares</span>
                      {order.sl_price && <span className="ml-2 text-rose-500">SL: Rs. {order.sl_price}</span>}
                      {order.tp_price && <span className="ml-2 text-emerald-500">TP: Rs. {order.tp_price}</span>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditTarget(order)}
                        disabled={loading}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400 text-emerald-500 transition hover:bg-emerald-500 hover:text-white disabled:opacity-50"
                        title="Edit target"
                        aria-label="Edit target"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetToDelete(order.id)}
                        disabled={loading}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                        title="Delete target"
                        aria-label="Delete target"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center ml-1">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">
                {editingTarget ? "Edit Target" : "Add New Target"}
              </h3>
              {holding && (
                <span className="text-[10px] font-bold opacity-55">
                  Current Price: Rs. {holding.current_price}
                </span>
              )}
            </div>

            <div>
              <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider opacity-60">
                Stop Loss (SL) Price {holding && `(Current: Rs. ${holding.current_price})`}
              </label>
              <div className="relative group flex items-center w-full">
                <button
                  type="button"
                  onClick={() => {
                    const currentVal = parseFloat(slPrice) || parseFloat(holding?.current_price) || 0;
                    setSlPrice((Math.max(0, currentVal - 1)).toFixed(2));
                  }}
                  className="absolute left-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-black transition-all duration-200 select-none opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.01"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  onFocus={() => {
                    if (!slPrice && holding) setSlPrice(String(holding.current_price));
                  }}
                  placeholder="Sell if price drops below..."
                  className="w-full text-center rounded-2xl border bg-transparent p-4 pl-12 pr-12 outline-none transition focus:border-red-500/50 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const currentVal = parseFloat(slPrice) || parseFloat(holding?.current_price) || 0;
                    setSlPrice((currentVal + 1).toFixed(2));
                  }}
                  className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-black transition-all duration-200 select-none opacity-0 group-hover:opacity-100 hover:text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                >
                  +
                </button>
              </div>
              {slPrice && Number(slPrice) >= Number(holding?.current_price) && (
                <p className="text-[10px] font-semibold text-rose-500 mt-1.5 ml-1">
                  *Stop Loss price must be less than current price (Rs. {holding.current_price})
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider opacity-60">
                Take Profit (TP) Price {holding && `(Current: Rs. ${holding.current_price})`}
              </label>
              <div className="relative group flex items-center w-full">
                <button
                  type="button"
                  onClick={() => {
                    const currentVal = parseFloat(tpPrice) || parseFloat(holding?.current_price) || 0;
                    setTpPrice((Math.max(0, currentVal - 1)).toFixed(2));
                  }}
                  className="absolute left-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-black transition-all duration-200 select-none opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.01"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  onFocus={() => {
                    if (!tpPrice && holding) setTpPrice(String(holding.current_price));
                  }}
                  placeholder="Sell if price rises above..."
                  className="w-full text-center rounded-2xl border bg-transparent p-4 pl-12 pr-12 outline-none transition focus:border-green-500/50 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const currentVal = parseFloat(tpPrice) || parseFloat(holding?.current_price) || 0;
                    setTpPrice((currentVal + 1).toFixed(2));
                  }}
                  className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-black transition-all duration-200 select-none opacity-0 group-hover:opacity-100 hover:text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                >
                  +
                </button>
              </div>
              {tpPrice && Number(tpPrice) <= Number(holding?.current_price) && (
                <p className="text-[10px] font-semibold text-rose-500 mt-1.5 ml-1">
                  *Take Profit price must be greater than current price (Rs. {holding.current_price})
                </p>
              )}
              {!slPrice && !tpPrice && (
                <p className="text-[10px] font-semibold text-amber-500 mt-1.5 ml-1">
                  *Please set at least one target (Stop Loss or Take Profit)
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider opacity-60">
                Quantity to Sell
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                max={maxSellQuantity}
                min="1"
                required
                className="w-full rounded-2xl border bg-transparent p-4 outline-none transition"
                style={{ borderColor: "var(--border)" }}
              />
              <p className="ml-1 mt-2 text-[10px] italic opacity-40">
                *SL/TP will execute for this quantity when triggered.
              </p>
            </div>

            {error && <p className="text-center text-sm font-medium text-red-500">{error}</p>}

            <div className="flex gap-3">
              {editingTarget && (
                <button
                  type="button"
                  onClick={cancelEditTarget}
                  className="flex-1 rounded-2xl border py-4 font-bold transition hover:opacity-80"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading || maxSellQuantity <= 0 || !isFormValid}
                className="flex-1 rounded-2xl py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {loading ? "Updating..." : editingTarget ? "Update Target" : "Save Conditions"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(targetToDelete)}
        title="Delete target?"
        message="This SL/TP target will be removed and will no longer execute automatically."
        confirmText="Delete Target"
        onCancel={() => setTargetToDelete(null)}
        onConfirm={() => {
          const orderId = targetToDelete;
          setTargetToDelete(null);
          handleDeleteTarget(orderId);
        }}
      />
    </div>
  );
}

export default ModifyHoldingModal;
