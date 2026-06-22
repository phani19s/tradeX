import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "react-toastify";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import UtrModal from "../components/UtrModal";
import SupportManagementAdmin from "../components/SupportManagementAdmin";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getStatusTone(status) {
  const normalized = String(status || "Pending").toLowerCase();

  if (normalized === "approved") {
    return "bg-emerald-500/15 text-emerald-500 border-emerald-500/25";
  }

  if (normalized === "rejected") {
    return "bg-rose-500/15 text-rose-500 border-rose-500/25";
  }

  return "bg-amber-500/15 text-amber-500 border-amber-500/25";
}

function AdminPanel() {
  const [targetEmail, setTargetEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [visibleWithdrawalCount, setVisibleWithdrawalCount] = useState(5);

  const [utrModal, setUtrModal] = useState({ isOpen: false, withdrawalId: null });

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?.is_admin) {
      navigate("/dashboard");
    }
  }, [currentUser, navigate]);

  async function fetchDeposits() {
    try {
      const response = await api.get("/admin/deposits", getAuthHeaders());
      setDeposits(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load deposit requests");
    }
  }

  async function fetchWithdrawals() {
    try {
      const response = await api.get("/admin/withdrawals", getAuthHeaders());
      setWithdrawals(response.data);
    } catch (error) {
      console.log("Failed to load withdrawals", error);
    }
  }

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchDeposits(), fetchWithdrawals()]);
    })();
  }, []);

  async function handleAdminCredit() {
    const email = targetEmail.trim();
    const value = Number(amount);

    if (!email) {
      toast.error("Enter a target email");
      return;
    }

    if (!value || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      await api.post(
        "/portfolio/deposit",
        {
          amount: value,
          target_email: email,
        },
        getAuthHeaders()
      );

      toast.success("Money added successfully");
      setTargetEmail("");
      setAmount("");
      fetchDeposits();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add money");
    }
  }

  async function approveDeposit(depositId) {
    try {
      await api.post(`/admin/deposits/${depositId}/approve`, {}, getAuthHeaders());
      toast.success("Deposit approved");
      fetchDeposits();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve deposit");
    }
  }

  async function rejectDeposit(depositId) {
    try {
      await api.post(`/admin/deposits/${depositId}/reject`, {}, getAuthHeaders());
      toast.success("Deposit rejected");
      fetchDeposits();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject deposit");
    }
  }

  async function approveWithdrawal(id) {
    setUtrModal({ isOpen: true, withdrawalId: id });
  }

  async function handleUtrSubmit(utr) {
    const id = utrModal.withdrawalId;
    try {
      await api.post(`/admin/withdrawals/${id}/approve`, { utr_number: utr }, getAuthHeaders());
      toast.success("Withdrawal approved and UTR recorded");
      setUtrModal({ isOpen: false, withdrawalId: null });
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve withdrawal");
    }
  }

  async function rejectWithdrawal(id) {
    try {
      await api.post(`/admin/withdrawals/${id}/reject`, {}, getAuthHeaders());
      toast.success("Withdrawal rejected");
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject withdrawal");
    }
  }

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5">
        <div className="theme-card rounded-2xl p-6 shadow mb-6">
          <h1 className="text-4xl font-bold">Admin Panel</h1>
          <p className="mt-2 opacity-70">
            Admin can credit any account directly and verify pending deposit requests.
          </p>
        </div>

        <div className="theme-card rounded-2xl p-6 shadow">
          <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-semibold opacity-80">
                Target email
              </label>
              <input
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold opacity-80">
                Amount
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleAdminCredit}
              className="rounded-xl px-5 py-3 font-semibold hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Add Money
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6 items-start">
          <div className="theme-card rounded-2xl p-6 shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Pending / Verified Deposits</h2>
              <span className="text-xs opacity-60">{deposits.length} total</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Account</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Amount</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">UTR</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Status</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Action</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, visibleCount).map((deposit) => (
                    <tr key={deposit.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-4 text-xs break-all" title={deposit.target_email}>{deposit.target_email}</td>
                      <td className="px-3 py-4 text-xs font-semibold text-emerald-600 whitespace-nowrap">₹{formatMoney(deposit.amount)}</td>
                      <td className="px-3 py-4 text-xs">{deposit.utr_number || "-"}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusTone(deposit.status)}`}>
                          {deposit.status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {deposit.status === "Pending" ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => approveDeposit(deposit.id)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectDeposit(deposit.id)}
                              className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-60">Done</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-[10px] opacity-60 whitespace-nowrap">{new Date(deposit.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              {visibleCount < deposits.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="rounded-xl border px-6 py-2 text-sm font-semibold transition hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  Show More
                </button>
              )}
              {visibleCount > 8 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(8)}
                  className="rounded-xl border px-6 py-2 text-sm font-semibold transition hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  Show Less
                </button>
              )}
            </div>
          </div>

          <div className="theme-card rounded-2xl p-6 shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Withdrawal Requests</h2>
              <span className="text-xs opacity-60">{withdrawals.length} total</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Account</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Amount</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Bank / UPI</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Status</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Action</th>
                    <th className="px-3 py-4 text-left text-xs whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.slice(0, visibleWithdrawalCount).map((w) => (
                    <tr key={w.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-4 text-xs break-all" title={w.user_email}>{w.user_email || "User"}</td>
                      <td className="px-3 py-4 text-xs font-semibold text-rose-500 whitespace-nowrap">-₹{formatMoney(w.amount)}</td>
                      <td className="px-3 py-4 text-[10px] leading-tight min-w-[120px]">
                        <div className="font-bold mb-1 break-words">{w.account_holder_name || "User"}</div>
                        {w.account_number ? (
                          <div className="mb-1">
                            <div className="opacity-80 break-words">{w.bank_name}</div>
                            <div className="opacity-60 whitespace-nowrap">A/c: {w.account_number}</div>
                            <div className="opacity-60 whitespace-nowrap">IFSC: {w.ifsc_code}</div>
                          </div>
                        ) : null}
                        {w.upi_id && (
                          <div className="text-accent font-bold border-t pt-1 break-all" style={{ borderColor: "var(--border)" }}>
                            UPI: {w.upi_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusTone(w.status)}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {w.status === "Pending" ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => approveWithdrawal(w.id)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectWithdrawal(w.id)}
                              className="rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-60">Done</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-[10px] opacity-60 whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-center gap-4">
              {visibleWithdrawalCount < withdrawals.length && (
                <button
                  type="button"
                  onClick={() => setVisibleWithdrawalCount((prev) => prev + 10)}
                  className="rounded-xl border px-6 py-2 text-sm font-semibold transition hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  Show More
                </button>
              )}
              {visibleWithdrawalCount > 5 && (
                <button
                  type="button"
                  onClick={() => setVisibleWithdrawalCount(5)}
                  className="rounded-xl border px-6 py-2 text-sm font-semibold transition hover:bg-black/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  Show Less
                </button>
              )}
            </div>
          </div>
        </div>

        <SupportManagementAdmin />

      </div>

      <UtrModal
        isOpen={utrModal.isOpen}
        onClose={() => setUtrModal({ isOpen: false, withdrawalId: null })}
        onSubmit={handleUtrSubmit}
        title="Approve Withdrawal"
        subtitle="Please enter the Transaction UTR/ID after making the payment."
      />
    </div>
  );
}

export default AdminPanel;
