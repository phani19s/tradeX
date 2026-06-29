import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getStatusTone(isActive) {
  return isActive
    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
    : "bg-rose-500/15 text-rose-500 border-rose-500/25";
}

export default function UserManagement() {
  // State for Listing
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [pages, setPages] = useState(1);

  // Modals state
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, user: null });
  const [historyModal, setHistoryModal] = useState({ isOpen: false, userId: null, history: [], loading: false });
  const [resetModal, setResetModal] = useState({ isOpen: false, userId: null, email: "", otp: "", newPassword: "", step: 1, loading: false });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null, username: "", loading: false });

  // Fetch Users
  async function fetchUsers() {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) queryParams.append("search", search);
      if (role) queryParams.append("role", role);
      if (status) queryParams.append("status", status);

      const response = await api.get(`/admin/users?${queryParams.toString()}`, getAuthHeaders());
      setUsers(response.data.users);
      setTotal(response.data.total);
      setPages(response.data.pages);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [page, search, role, status]);

  // Handle Search Change with Reset Page
  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  // Handle Role Filter
  function handleRoleChange(e) {
    setRole(e.target.value);
    setPage(1);
  }

  // Handle Status Filter
  function handleStatusChange(e) {
    setStatus(e.target.value);
    setPage(1);
  }

  // Action: View Details
  async function handleViewDetails(userId) {
    try {
      const response = await api.get(`/admin/users/${userId}`, getAuthHeaders());
      setDetailsModal({ isOpen: true, user: response.data });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load user details");
    }
  }



  // Action: Toggle Status Quickly
  async function handleToggleStatus(userId, currentStatus) {
    try {
      const nextStatus = !currentStatus;
      await api.post(`/admin/users/${userId}/status`, { is_active: nextStatus }, getAuthHeaders());
      toast.success(`User account ${nextStatus ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to toggle status");
    }
  }

  // Action: Force Logout Sessions
  async function handleForceLogout(userId) {
    if (!window.confirm("Are you sure you want to force logout this user from all devices?")) {
      return;
    }
    try {
      const response = await api.post(`/admin/users/${userId}/force-logout`, {}, getAuthHeaders());
      toast.success(response.data.message || "User logged out from all active sessions");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to force logout user");
    }
  }

  // Action: Delete User Confirm
  function handleOpenDelete(userId, username) {
    setDeleteModal({ isOpen: true, userId, username, loading: false });
  }

  async function handleDeleteUser() {
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await api.delete(`/admin/users/${deleteModal.userId}`, getAuthHeaders());
      toast.success("User account and all related data deleted successfully");
      setDeleteModal({ isOpen: false, userId: null, username: "", loading: false });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user account");
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Action: Reset Password OTP Flow
  function handleOpenReset(userId, email) {
    setResetModal({
      isOpen: true,
      userId,
      email,
      otp: "",
      newPassword: "",
      step: 1,
      loading: false
    });
  }

  async function handleSendResetOtp() {
    setResetModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await api.post(`/admin/users/${resetModal.userId}/reset-password/send-otp`, {}, getAuthHeaders());
      toast.success(response.data.message || "OTP sent to user's registered email");
      setResetModal(prev => ({ ...prev, step: 2, loading: false }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send verification OTP");
      setResetModal(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleVerifyAndReset() {
    if (!resetModal.otp || !resetModal.newPassword) {
      toast.error("OTP and New Password are required");
      return;
    }
    if (resetModal.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    setResetModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await api.post(`/admin/users/${resetModal.userId}/reset-password/verify-and-reset`, {
        otp: resetModal.otp,
        new_password: resetModal.newPassword,
      }, getAuthHeaders());
      toast.success(response.data.message || "Password reset successfully");
      setResetModal({ isOpen: false, userId: null, email: "", otp: "", newPassword: "", step: 1, loading: false });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset password");
      setResetModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Action: View Login History
  async function handleViewHistory(userId) {
    setHistoryModal({ isOpen: true, userId, history: [], loading: true });
    try {
      const response = await api.get(`/admin/users/${userId}/login-history`, getAuthHeaders());
      setHistoryModal({ isOpen: true, userId, history: response.data, loading: false });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load login history");
      setHistoryModal({ isOpen: false, userId: null, history: [], loading: false });
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          {/* Search bar */}
          <div>
            <label className="mb-2 block text-sm font-semibold opacity-80">
              Search Users
            </label>
            <div className="relative">
              <input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border pl-10 pr-4 py-3 outline-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: "var(--border)",
                }}
              />
              <svg className="w-5 h-5 absolute left-3 top-3.5 opacity-50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filter by Status */}
          <div>
            <label className="mb-2 block text-sm font-semibold opacity-80">
              Filter by Status
            </label>
            <select
              value={status}
              onChange={handleStatusChange}
              className="w-full rounded-xl border px-4 py-3 outline-none appearance-none"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                borderColor: "var(--border)",
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Registered Users</h2>
          <span className="text-xs opacity-60 bg-surface/50 border px-3 py-1 rounded-full">{total} total users</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-accent" style={{ borderColor: "var(--accent)" }}></div>
            <span className="ml-3 font-semibold">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0112.75 21.5h-1.5a2.25 2.25 0 01-2.25-2.263V19.13m-2.625.372A9.336 9.336 0 012.25 18.552a4.125 4.125 0 017.533-2.493c.501.91.786 1.957.786 3.07v.003m-2.902-.372a9.38 9.38 0 00-2.625.372m8.618-11.602A4.126 4.126 0 009 5.5a4.126 4.126 0 00-3.75 2.5m8.618 0A4.126 4.126 0 0118 8.5a4.126 4.126 0 01-3.75 2.5m-9 0A3.75 3.75 0 100 8.5c0 1.295.656 2.438 1.656 3.125m14.688 0A3.75 3.75 0 1124 8.5c0 1.295-.656 2.438-1.656 3.125m-15.375 0a3.748 3.748 0 003.75-2.5m6 0a3.748 3.748 0 013.75-2.5M12 13.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
            </svg>
            <p className="text-lg font-semibold">No users found</p>
            <p className="text-sm">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">User</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Registration Date</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    <div>Actions</div>
                    <div className="flex justify-center items-center gap-1.5 mt-1 text-[9px] font-semibold opacity-65" style={{ textTransform: "none" }}>
                      <span className="w-[30px] text-center" title="View Details">View</span>
                      <span className="w-[30px] text-center" title="Login History">History</span>
                      <span className="w-[30px] text-center" title="Reset Password">Reset</span>
                      <span className="w-[30px] text-center" title="Force Logout">Logout</span>
                      <span className="w-[30px] text-center" title="Delete User">Delete</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-surface/10 transition">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{u.username}</span>
                        <span className="text-xs opacity-60">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition hover:opacity-80 ${getStatusTone(u.is_active)}`}
                        title="Click to toggle status"
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-4 font-semibold text-sm">
                      ₹{formatMoney(u.balance)}
                    </td>
                    <td className="px-4 py-4 text-xs opacity-75">
                      {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-4 py-4 text-xs opacity-75">
                      {u.last_login ? (
                        new Date(u.last_login).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                      ) : (
                        <span className="opacity-40">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-center items-center gap-1.5">
                        {/* View Details */}
                        <button
                          onClick={() => handleViewDetails(u.id)}
                          className="p-1.5 rounded-lg hover:bg-surface border border-transparent transition"
                          title="View Details"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        {/* Login History */}
                        <button
                          onClick={() => handleViewHistory(u.id)}
                          className="p-1.5 rounded-lg hover:bg-surface border border-transparent transition"
                          title="Login History"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Password Reset */}
                        <button
                          onClick={() => handleOpenReset(u.id, u.email)}
                          className="p-1.5 rounded-lg hover:bg-surface border border-transparent transition"
                          title="Reset Password via OTP"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </button>

                        {/* Force Logout */}
                        <button
                          onClick={() => handleForceLogout(u.id)}
                          className="p-1.5 rounded-lg hover:bg-surface border border-transparent transition"
                          title="Force Logout"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleOpenDelete(u.id, u.username)}
                          className="p-1.5 rounded-lg hover:bg-surface border border-transparent transition text-rose-500"
                          title="Delete User"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && pages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm opacity-65">
              Page <strong>{page}</strong> of {pages} ({total} users)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: "var(--border)" }}
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: "var(--border)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- DETAILS MODAL --- */}
      {detailsModal.isOpen && detailsModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">User Profile Details</h3>
              <button onClick={() => setDetailsModal({ isOpen: false, user: null })} className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm mb-6">
              <div className="space-y-3">
                <h4 className="font-bold text-base border-b pb-1 opacity-70" style={{ borderColor: "var(--border)" }}>Account Info</h4>
                <p><strong>User ID:</strong> {detailsModal.user.id}</p>
                <p><strong>Name:</strong> {detailsModal.user.username}</p>
                <p><strong>Email:</strong> {detailsModal.user.email}</p>
                <p><strong>Phone:</strong> {detailsModal.user.phone_number || "-"}</p>
                <p><strong>Role:</strong> {detailsModal.user.role}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusTone(detailsModal.user.is_active)}`}>
                    {detailsModal.user.is_active ? "Active" : "Inactive"}
                  </span>
                </p>
                <p><strong>Registered:</strong> {new Date(detailsModal.user.created_at).toLocaleString()}</p>
                <p><strong>Last Login:</strong> {detailsModal.user.last_login ? new Date(detailsModal.user.last_login).toLocaleString() : "-"}</p>
                <p><strong>Portfolio Balance:</strong> ₹{formatMoney(detailsModal.user.balance)}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-base border-b pb-1 opacity-70" style={{ borderColor: "var(--border)" }}>Bank Details</h4>
                <p><strong>Bank Name:</strong> {detailsModal.user.bank_name || "-"}</p>
                <p><strong>Account Holder:</strong> {detailsModal.user.account_holder_name || "-"}</p>
                <p><strong>Account Number:</strong> {detailsModal.user.account_number || "-"}</p>
                <p><strong>IFSC Code:</strong> {detailsModal.user.ifsc_code || "-"}</p>
                <p className="text-accent font-semibold"><strong>UPI ID:</strong> {detailsModal.user.upi_id || "-"}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setDetailsModal({ isOpen: false, user: null })}
                className="rounded-xl border px-5 py-2 text-sm font-semibold hover:bg-surface transition"
                style={{ borderColor: "var(--border)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}


      {/* --- LOGIN HISTORY MODAL --- */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">User Login History</h3>
              <button onClick={() => setHistoryModal({ isOpen: false, userId: null, history: [], loading: false })} className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 rounded-xl border mb-4" style={{ borderColor: "var(--border)" }}>
              {historyModal.loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                  <span className="ml-3 font-semibold">Loading history...</span>
                </div>
              ) : historyModal.history.length === 0 ? (
                <div className="text-center py-16 opacity-60">
                  <p className="text-base font-semibold">No login history recorded</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10" style={{ background: "var(--card)" }}>
                    <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">IP Address</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Device / Browser</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Logout</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {historyModal.history.map(item => (
                      <tr key={item.id} className="hover:bg-surface/10">
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {new Date(item.login_time).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs">{item.ip_address || "-"}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-semibold">{item.device || "-"}</div>
                          <div className="opacity-60">{item.browser || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{item.location || "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {item.logout_time ? new Date(item.logout_time).toLocaleString() : <span className="opacity-40">-</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.session_duration ? (
                            <span>
                              {Math.floor(item.session_duration / 60)}m {item.session_duration % 60}s
                            </span>
                          ) : (
                            <span className="opacity-40">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.status === "Success" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setHistoryModal({ isOpen: false, userId: null, history: [], loading: false })}
                className="rounded-xl border px-5 py-2 text-sm font-semibold hover:bg-surface transition"
                style={{ borderColor: "var(--border)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PASSWORD OTP RESET MODAL --- */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">Reset Password</h3>
              <button onClick={() => setResetModal({ isOpen: false, userId: null, email: "", otp: "", newPassword: "", step: 1, loading: false })} className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {resetModal.step === 1 ? (
              <div className="space-y-4">
                <p className="text-sm opacity-80 leading-relaxed">
                  To reset the password for <strong>{resetModal.email}</strong>, we need to perform an OTP verification first.
                  Click the button below to generate and send a 6-digit OTP to the user's registered email address.
                </p>

                <button
                  type="button"
                  disabled={resetModal.loading}
                  onClick={handleSendResetOtp}
                  className="w-full rounded-xl py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {resetModal.loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating OTP...
                    </>
                  ) : "Send Verification OTP"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-500/15 text-amber-500 border border-amber-500/25 rounded-xl p-3 text-xs leading-relaxed">
                  Verification OTP has been sent successfully to the user's email. Please request the user for the OTP to authorize this password reset.
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 opacity-80">Verification OTP</label>
                  <input
                    value={resetModal.otp}
                    onChange={(e) => setResetModal(prev => ({ ...prev, otp: e.target.value.trim() }))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="w-full rounded-xl border px-4 py-2.5 outline-none tracking-widest text-center font-bold text-lg"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 opacity-80">New Password</label>
                  <input
                    type="password"
                    value={resetModal.newPassword}
                    onChange={(e) => setResetModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border px-4 py-2.5 outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={resetModal.loading}
                    onClick={handleVerifyAndReset}
                    className="flex-1 rounded-xl py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {resetModal.loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Resetting...
                      </>
                    ) : "Verify & Reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetModal(prev => ({ ...prev, step: 1 }))}
                    className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-surface transition"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-rose-500/25 animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", color: "var(--text)" }}>
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold">Delete User Account</h3>
            </div>

            <p className="text-sm opacity-80 leading-relaxed mb-6">
              Are you absolutely sure you want to delete user <strong>{deleteModal.username}</strong>?
              <br />
              <span className="text-rose-500 font-bold block mt-2">
                WARNING: This action is irreversible. It will immediately terminate all active sessions and permanently delete this user account along with their entire portfolio, trade logs, support messages, deposits, and withdrawal records.
              </span>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteModal.loading}
                onClick={handleDeleteUser}
                className="flex-1 rounded-xl py-3 font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 flex justify-center items-center bg-rose-600"
              >
                {deleteModal.loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : "Delete Account"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, userId: null, username: "", loading: false })}
                className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-surface transition"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
