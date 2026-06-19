import { useState, useEffect } from "react";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import { toast } from "react-toastify";

function RaiseTicketModal({ isOpen, onClose, transactionId, transactionType }) {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (transactionType === "DEPOSIT") setIssueType("Deposit Issue");
      else if (transactionType === "WITHDRAWAL") setIssueType("Withdrawal Issue");
      else setIssueType("");
      setDescription("");
    }
  }, [isOpen, transactionType]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/support/tickets", {
        transaction_id: transactionId || null,
        transaction_type: transactionType || null,
        issue_type: issueType,
        description: description
      }, getAuthHeaders());
      
      toast.success("Support ticket raised successfully");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to raise ticket");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="w-full max-w-md my-8 rounded-[32px] border p-8 shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">Raise a Ticket</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
        </div>

        {transactionId && (
          <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-60">Related To</span>
              <span className="font-bold">{transactionType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">Transaction ID</span>
              <span className="font-bold">#{transactionId}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Issue Type
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full rounded-2xl border bg-transparent p-4 outline-none focus:border-accent transition"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              required
            >
              <option value="">Select an issue...</option>
              <option value="Deposit Issue">Deposit Issue</option>
              <option value="Withdrawal Issue">Withdrawal Issue</option>
              <option value="Payment Delay">Payment Delay</option>
              <option value="Incorrect Amount">Incorrect Amount</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2 ml-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail..."
              rows="4"
              required
              className="w-full rounded-2xl border bg-transparent p-4 outline-none transition focus:border-accent resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !issueType || !description}
            className="w-full rounded-2xl py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 mt-2"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {loading ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default RaiseTicketModal;
