import { useMemo, useState } from "react";

function PaymentModal({
  isOpen,
  title,
  subtitle,
  onClose,
  onSubmit,
}) {
  const [amount, setAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [stage, setStage] = useState("details");

  const upiId = "6303143509@axl";

  const upiLink = useMemo(() => {
    const note = encodeURIComponent("TradeX Wallet Deposit");
    const pa = encodeURIComponent(upiId);
    const pn = encodeURIComponent("TradeX");
    const am = encodeURIComponent(amount || "1");
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${note}`;
  }, [amount]);

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiLink)}`;
  }, [upiLink]);

  if (!isOpen) {
    return null;
  }

  const proceed = () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      return;
    }
    setStage("qr");
  };

  const submitRequest = () => {
    const value = Number(amount);
    const utr = utrNumber.trim();

    if (!value || value <= 0) {
      return;
    }

    if (!utr) {
      return;
    }

    onSubmit({
      amount: value,
      utrNumber: utr,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        style={{
          background: "var(--card)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold">{title}</h3>
            {subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>

        {stage === "details" && (
          <div className="mt-5 grid gap-3">
            <input
              type="number"
              min="1"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl border px-4 py-3 outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                borderColor: "var(--border)",
              }}
            />

            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={proceed}
                className="rounded-xl px-4 py-3 font-semibold text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-3 font-semibold"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === "qr" && (
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-sm opacity-70">Generated for this amount</p>
              <p className="mt-2 text-3xl font-bold" style={{ color: "var(--accent)" }}>
                ₹{amount}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
              <img
                src={qrUrl}
                alt={`UPI QR for ₹${amount}`}
                className="mx-auto w-full max-w-[280px] rounded-xl object-contain"
              />
            </div>

            <div className="rounded-2xl border border-dashed px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm opacity-70 text-center">
                Scan the QR in your phone’s UPI app, complete payment, then enter the UTR below.
              </p>
            </div>

            <input
              type="text"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              placeholder="Enter UTR number after payment"
              className="rounded-xl border px-4 py-3 outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                borderColor: "var(--border)",
              }}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={submitRequest}
                className="rounded-xl px-4 py-3 font-semibold text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Submit UTR
              </button>
              <button
                type="button"
                onClick={() => setStage("details")}
                className="rounded-xl border px-4 py-3 font-semibold"
                style={{ borderColor: "var(--border)" }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;
