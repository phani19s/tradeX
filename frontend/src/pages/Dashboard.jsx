import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { toast } from "react-toastify";

import api from "../api/api";
import { getAuthHeaders, requestWithdrawal, getWithdrawalHistory } from "../api/authApi";
import Navbar from "../components/Navbar";
import PaymentModal from "../components/PaymentModal";
import WithdrawModal from "../components/WithdrawModal";
import RaiseTicketModal from "../components/RaiseTicketModal";
import { useStocks } from "../context/StockContext";

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

function Dashboard() {
  const [data, setData] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [visibleDepositCount, setVisibleDepositCount] = useState(5);
  const [visibleWithdrawalCount, setVisibleWithdrawalCount] = useState(5);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [ticketModal, setTicketModal] = useState({ isOpen: false, type: "", id: null });
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = Boolean(currentUser?.is_admin);
  const { stocks } = useStocks();
  const navigate = useNavigate();
  const location = useLocation();

  async function loadDashboard() {
    const response = await api.get("/dashboard/", getAuthHeaders());
    setData(response.data);
  }

  async function loadDeposits() {
    const response = await api.get("/portfolio/deposits", getAuthHeaders());
    setDeposits(response.data);
  }

  async function loadWithdrawals() {
    try {
      const response = await getWithdrawalHistory();
      setWithdrawals(response.data);
    } catch (error) {
      console.log("Failed to load withdrawals", error);
    }
  }

  async function loadTickets() {
    try {
      const response = await api.get("/support/tickets", getAuthHeaders());
      setTickets(response.data);
    } catch (error) {
      console.error("Failed to load tickets", error);
    }
  }

  async function refreshData() {
    try {
      await Promise.all([loadDashboard(), loadDeposits(), loadWithdrawals(), loadTickets()]);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const sectionId = location.hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [location.hash, deposits.length, withdrawals.length]);

  function getTicketActionLabel(transactionId, transactionType) {
    const ticket = tickets.find(
      (t) => t.transaction_id === transactionId && t.transaction_type === transactionType
    );

    if (!ticket) return "Raise Ticket";
    if (ticket.status === "OPEN") return "Ticket Rised";
    if (ticket.status === "IN_PROGRESS") return "In Progress";
    if (ticket.status === "RESOLVED") return "Raise Ticket";
    if (ticket.status === "CLOSED") return "Raise Ticket";
    return "Raise Ticket";
  }

  function getTicketActionColor(transactionId, transactionType) {
    const ticket = tickets.find(
      (t) => t.transaction_id === transactionId && t.transaction_type === transactionType
    );

    if (!ticket) return "text-accent";
    if (ticket.status === "OPEN") return "text-amber-500";
    if (ticket.status === "IN_PROGRESS") return "text-blue-500";
    return "text-accent";
  }

  async function handleUserDeposit(payload) {
    try {
      const response = await api.post(
        "/portfolio/deposit",
        {
          amount: Number(payload.amount),
          utr_number: payload.utrNumber,
        },
        getAuthHeaders()
      );

      toast.success(
        response.data?.email_sent
          ? "Deposit request submitted and approval mail sent to admin."
          : `Deposit request submitted, but mail failed: ${response.data?.email_error || "unknown error"}`
      );

      setShowPaymentModal(false);
      navigate("/dashboard", { replace: true });
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit deposit request");
    }
  }

  async function handleUserWithdraw(payload) {
    try {
      await requestWithdrawal({
        amount: payload.amount,
        otp: payload.otp
      });
      toast.success("Withdrawal request submitted successfully");
      setShowWithdrawModal(false);
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit withdrawal request");
    }
  }

  const stats = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        label: "Cash Balance",
        value: `₹${formatMoney(data.cash_balance)}`,
        hint: "Available for deposits and trades",
      },
      {
        label: "Invested Amount",
        value: `₹${formatMoney(data.invested_amount)}`,
        hint: "Locked in active positions",
      },
      {
        label: "Total Trades",
        value: String(data.total_trades ?? 0),
        hint: "Completed order count",
      },
      {
        label: "Portfolio Status",
        value: "Active",
        hint: "Account ready",
      },
    ];
  }, [data]);

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main px-4 py-6 md:px-6">
        <div
          className="mb-6 rounded-[28px] border p-6 shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--card) 92%, transparent), color-mix(in srgb, var(--surface) 94%, transparent))",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">
                Overview
              </p>
              <h1 className="mt-3 text-4xl font-black md:text-5xl">
                Welcome to TradeX
              </h1>
              <p className="mt-3 text-sm leading-6 opacity-75 md:text-base">
                Keep an eye on your cash balance, deposits, and portfolio
                activity from one clean dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Deposit Funds
              </button>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                className="rounded-2xl px-5 py-3 text-sm font-semibold border shadow-lg transition hover:bg-black/5"
                style={{ borderColor: "var(--border)" }}
              >
                Withdraw Funds
              </button>
            </div>
          </div>
        </div>

        {data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-[26px] border p-6 shadow-lg"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <p className="text-sm font-medium opacity-70">{item.label}</p>
                <p className="mt-3 text-3xl font-black">{item.value}</p>
                <p className="mt-2 text-sm opacity-60">{item.hint}</p>
              </div>
            ))}
          </div>
        )}

        <div
          className="mt-6 rounded-[28px] border p-6 shadow-xl"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)"
          }}
        >
          <div className="flex justify-between items-center mb-5">
        
            <h2 className="text-2xl font-bold">
              Live Market
            </h2>
        
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)"
              }}
            >
              LIVE
            </span>
        
          </div>
        
          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        
            {stocks.map(stock => {
        
              const up =
                Number(stock.current_price) >
                Number(stock.previous_close);
              
              const change =
                (
                  (
                    Number(stock.current_price) -
                    Number(stock.previous_close)
                  ) /
                  Number(stock.previous_close)
                ) * 100;
              return (
        
                <div
                  key={stock.symbol}
                  className="
                  rounded-2xl
                  p-4
                  border
                  "
                  style={{
                    background:
                      "var(--surface)",
                    borderColor:
                      "var(--border)"
                  }}
                >
        
                  <h3 className="font-bold text-lg">
                    {stock.symbol}
                  </h3>
        
                  <p className="opacity-70 text-sm">
                    {stock.name}
                  </p>
        
                  <p
                    className={`mt-3 text-2xl font-black ${
                      up
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    ₹{stock.current_price}
                  </p>
        
                  <p
                    className={
                      up
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {up
                     ? `▲ ${change.toFixed(2)}%`
                     : `▼ ${Math.abs(change).toFixed(2)}%`}
                  </p>
        
                </div>
        
              );
        
            })}
        
          </div>
        
        </div>

        <div
          className="mt-6 rounded-[28px] border p-6 shadow-xl"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Transaction History</h2>
              <p className="mt-1 text-sm opacity-70">
                View your recent deposits and withdrawals.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div id="deposits">
              <h3 className="text-lg font-bold mb-4">Deposits</h3>
              <div className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      {isAdmin && <th className="px-4 py-4 text-left text-sm">User</th>}
                      <th className="px-4 py-4 text-left text-sm">Amount</th>
                      <th className="px-4 py-4 text-left text-sm">UTR</th>
                      <th className="px-4 py-4 text-left text-sm">Status</th>
                      <th className="px-4 py-4 text-left text-sm text-nowrap">Date</th>
                      <th className="px-4 py-4 text-left text-sm text-nowrap">Support</th>
                    </tr>
                    </thead>
                    <tbody>
                    {deposits.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-sm opacity-70">No deposits yet.</td>
                      </tr>
                    ) : (
                      deposits.slice(0, visibleDepositCount).map((deposit) => (
                        <tr key={deposit.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                          {isAdmin && <td className="px-4 py-4 text-xs">{deposit.target_email}</td>}
                          <td className="px-4 py-4 font-semibold text-green-500">+₹{formatMoney(deposit.amount)}</td>
                          <td className="px-4 py-4 text-xs">{deposit.utr_number || "-"}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold ${getStatusTone(deposit.status)}`}>
                              {deposit.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[10px] opacity-60">{new Date(deposit.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => {
                                const label = getTicketActionLabel(deposit.id, "DEPOSIT");
                                if (label === "Raise Ticket") {
                                  setTicketModal({ isOpen: true, type: "DEPOSIT", id: deposit.id });
                                } else {
                                  navigate("/profile/tickets");
                                }
                              }}
                              className={`text-[10px] font-bold hover:underline ${getTicketActionColor(deposit.id, "DEPOSIT")}`}
                            >
                              {getTicketActionLabel(deposit.id, "DEPOSIT")}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-center gap-4">
                {visibleDepositCount < deposits.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleDepositCount((prev) => prev + 10)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Show More
                  </button>
                )}
                {visibleDepositCount > 5 && (
                  <button
                    type="button"
                    onClick={() => setVisibleDepositCount(5)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Show Less
                  </button>
                )}
              </div>
            </div>

            <div id="withdrawals">
              <h3 className="text-lg font-bold mb-4">Withdrawals</h3>
              <div className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="px-4 py-4 text-left text-sm">Amount</th>
                      <th className="px-4 py-4 text-left text-sm">Bank Details</th>
                      <th className="px-4 py-4 text-left text-sm">Status</th>
                      <th className="px-4 py-4 text-left text-sm text-nowrap">Date</th>
                      <th className="px-4 py-4 text-left text-sm text-nowrap">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm opacity-70">No withdrawals yet.</td>
                      </tr>
                    ) : (
                      withdrawals.slice(0, visibleWithdrawalCount).map((w) => (
                        <tr key={w.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                          <td className="px-4 py-4 font-semibold text-red-500">-₹{formatMoney(w.amount)}</td>
                          <td className="px-4 py-4 text-xs">
                            {w.bank_name ? (
                              <>
                                <div className="font-medium">{w.bank_name}</div>
                                <div className="opacity-60">{w.account_number}</div>
                              </>
                            ) : null}
                            {w.upi_id && (
                              <div className={w.bank_name ? "mt-1 text-accent font-bold" : "text-accent font-bold"}>
                                UPI: {w.upi_id}
                              </div>
                            )}
                            {w.utr_number && <div className="mt-1 text-[10px] font-bold text-accent">UTR: {w.utr_number}</div>}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold ${getStatusTone(w.status)}`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[10px] opacity-60">{new Date(w.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => {
                                const label = getTicketActionLabel(w.id, "WITHDRAWAL");
                                if (label === "Raise Ticket") {
                                  setTicketModal({ isOpen: true, type: "WITHDRAWAL", id: w.id });
                                } else {
                                  navigate("/profile/tickets");
                                }
                              }}
                              className={`text-[10px] font-bold hover:underline ${getTicketActionColor(w.id, "WITHDRAWAL")}`}
                            >
                              {getTicketActionLabel(w.id, "WITHDRAWAL")}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-center gap-4">
                {visibleWithdrawalCount < withdrawals.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleWithdrawalCount((prev) => prev + 10)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Show More
                  </button>
                )}
                {visibleWithdrawalCount > 5 && (
                  <button
                    type="button"
                    onClick={() => setVisibleWithdrawalCount(5)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-black/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Show Less
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          title="Deposit Funds"
          subtitle="Enter amount, scan the QR, then submit the UTR for admin verification"
          onClose={() => setShowPaymentModal(false)}
          onSubmit={handleUserDeposit}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          maxAmount={data?.cash_balance || 0}
          onClose={() => setShowWithdrawModal(false)}
          onSubmit={handleUserWithdraw}
        />
      )}

      <RaiseTicketModal
        isOpen={ticketModal.isOpen}
        onClose={() => setTicketModal({ isOpen: false, type: "", id: null })}
        transactionId={ticketModal.id}
        transactionType={ticketModal.type}
      />
    </div>
  );
}

export default Dashboard;
