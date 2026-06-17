import { useState } from "react";

function UtrModal({ isOpen, onClose, onSubmit, title = "Enter UTR", subtitle }) {
  const [utr, setUtr] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4">
      <div
        className="w-full max-w-sm rounded-[28px] border p-6 shadow-2xl"
        style={{
          background: "var(--card)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
      >
        <h3 className="text-xl font-bold">{title}</h3>
        {subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}

        <div className="mt-6">
          <input
            type="text"
            placeholder="GPay/PhonePe/Bank UTR ID"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            autoFocus
            className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              if (utr.trim()) {
                onSubmit(utr.trim());
                setUtr("");
              }
            }}
            disabled={!utr.trim()}
            className="flex-1 rounded-xl py-3 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Approve
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border py-3 font-bold transition hover:bg-black/5"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default UtrModal;
