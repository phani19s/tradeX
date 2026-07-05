import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "react-toastify";

import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import UtrModal from "../components/UtrModal";

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
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [utrModal, setUtrModal] = useState({ isOpen: false, withdrawalId: null });

  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
    }
  }, [navigate]);

  async function fetchDashboardData() {
    try {
      setLoadingDashboard(true);
      const response = await api.get("/admin/dashboard", getAuthHeaders());
      setDashboardData(response.data);
    } catch (error) {
      console.error("Failed to load dashboard statistics", error);
      toast.error(error.response?.data?.detail || "Failed to load dashboard statistics");
    } finally {
      setLoadingDashboard(false);
    }
  }

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
      await Promise.all([fetchDashboardData(), fetchDeposits(), fetchWithdrawals()]);
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

        {/* Dashboard Overview */}
        {loadingDashboard ? (
          <div className="theme-card rounded-2xl p-6 shadow mb-6 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
            <span className="ml-3 font-semibold">Loading dashboard overview...</span>
          </div>
        ) : dashboardData ? (
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Dashboard Overview</h2>
            
            {/* Stats Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
              {/* Total Users */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Users</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.total_users}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Platform registered users</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
              </div>

              {/* Total Traders */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Traders</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.total_traders}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Active trader accounts</p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                  </svg>
                </div>
              </div>

              {/* Total Administrators */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Administrators</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.total_administrators}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Platform administrators</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
              </div>

              {/* Total Deposits */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Deposits</p>
                  <h3 className="text-3xl font-extrabold mt-1">₹{formatMoney(dashboardData.total_deposits_amount)}</h3>
                  <p className="text-[11px] opacity-50 mt-1">{dashboardData.total_deposits_count} transactions (Approved)</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"/>
                  </svg>
                </div>
              </div>

              {/* Total Withdrawals */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Withdrawals</p>
                  <h3 className="text-3xl font-extrabold mt-1">₹{formatMoney(dashboardData.total_withdrawals_amount)}</h3>
                  <p className="text-[11px] opacity-50 mt-1">{dashboardData.total_withdrawals_count} transactions (Approved)</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13l-3 3m0 0l-3-3m3 3V8m0-13a9 9 0 110 18 9 9 0 010-18z"/>
                  </svg>
                </div>
              </div>

              {/* Total Trades */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Trades</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.total_trades}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Executed trades on platform</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                  </svg>
                </div>
              </div>

              {/* Total Watchlists */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Total Watchlists</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.total_watchlists}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Monitored stocks entries</p>
                </div>
                <div className="p-3 rounded-xl bg-violet-500/10 text-violet-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </div>
              </div>

              {/* Open Support Tickets */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Open Support Tickets</p>
                  <h3 className="text-3xl font-extrabold mt-1 text-amber-500">{dashboardData.open_support_tickets}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Pending user queries</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>

              {/* Active Price Alerts */}
              <div className="theme-card rounded-2xl p-5 shadow flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Active Price Alerts</p>
                  <h3 className="text-3xl font-extrabold mt-1">{dashboardData.active_price_alerts}</h3>
                  <p className="text-[11px] opacity-50 mt-1">Set user price alerts</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Activity Summary Section */}
            <div className="theme-card rounded-2xl p-6 shadow mb-6">
              <h3 className="text-xl font-bold mb-4">Activity Summary</h3>
              <div className="grid gap-6 md:grid-cols-3">
                {/* New Users Today */}
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-blue-500/10 text-blue-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold opacity-70">New Users Today</p>
                    <h4 className="text-2xl font-extrabold mt-0.5">{dashboardData.new_users_today}</h4>
                    <p className="text-xs opacity-50">Registered since midnight</p>
                  </div>
                </div>

                {/* Today's Trading Volume */}
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold opacity-70">Today's Trading Volume</p>
                    <h4 className="text-2xl font-extrabold mt-0.5">₹{formatMoney(dashboardData.todays_trading_volume)}</h4>
                    <p className="text-xs opacity-50">Combined trade value today</p>
                  </div>
                </div>

                {/* Active Users Online */}
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-full bg-teal-500/10 text-teal-500 relative">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.07 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"/>
                    </svg>
                    <span className="absolute top-3 right-3 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold opacity-70">Active Users Online</p>
                    <h4 className="text-2xl font-extrabold mt-0.5">{dashboardData.active_users_online}</h4>
                    <p className="text-xs opacity-50">Currently logged-in users</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="theme-card rounded-2xl p-6 shadow mb-6 text-center text-rose-500">
            Failed to load dashboard overview.
          </div>
        )}

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
          <div className="theme-card rounded-2xl p-6 shadow min-w-0 max-w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Pending / Verified Deposits</h2>
              <span className="text-xs opacity-60">{deposits.length} total</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full min-w-[700px]">
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

          <div className="theme-card rounded-2xl p-6 shadow min-w-0 max-w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Withdrawal Requests</h2>
              <span className="text-xs opacity-60">{withdrawals.length} total</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full min-w-[700px]">
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
