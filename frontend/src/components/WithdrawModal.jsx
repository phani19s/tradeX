import { useState } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";

function WithdrawModal({
  isOpen,
  onClose,
  onSubmit,
  maxAmount = 0
}) {
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      await api.post("/withdrawal/send-otp", {}, getAuthHeaders());
      setOtpSent(true);
      toast.success("OTP sent to your email");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const val = Number(amount);
    if (!val || val <= 0 || val > maxAmount) {
      return;
    }
    if (!otp) {
      toast.error("Please enter OTP");
      return;
    }
    onSubmit({ amount: val, otp });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div
        className="w-full max-w-md rounded-[28px] border p-6 shadow-2xl"
        style={{
          background: "var(--card)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold">Withdraw Funds</h3>
            <p className="mt-1 text-sm opacity-70">Verify your request with Email OTP.</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border p-4 bg-opacity-5" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
            <p className="text-sm opacity-70">Available for Withdrawal</p>
            <p className="text-2xl font-black" style={{ color: "var(--accent)" }}>₹{maxAmount.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 opacity-70">Amount to Withdraw</label>
            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={otpSent}
              className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {otpSent ? (
            <div>
              <label className="block text-sm font-medium mb-1 opacity-70">Enter OTP</label>
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none"
                style={{ borderColor: "var(--border)" }}
              />
              <button 
                onClick={handleSendOtp} 
                className="mt-2 text-xs font-bold opacity-60 hover:opacity-100"
              >
                Resend OTP
              </button>
            </div>
          ) : (
            <button
              onClick={handleSendOtp}
              disabled={loading || !amount || Number(amount) <= 0 || Number(amount) > maxAmount}
              className="w-full rounded-xl py-3 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {loading ? "Sending..." : "Send Verification OTP"}
            </button>
          )}

          <div className="flex gap-3 pt-2">
            {otpSent && (
              <button
                onClick={handleApply}
                className="flex-1 rounded-xl py-3 font-bold text-white shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Confirm Withdrawal
              </button>
            )}
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
    </div>
  );
}

export default WithdrawModal;
