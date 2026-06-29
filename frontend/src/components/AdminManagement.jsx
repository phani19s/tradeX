import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";

const PREDEFINED_PERMISSIONS = [
  "Dashboard Access",
  "User Management",
  "Trading Management",
  "Support Management",
  "Reports",
  "System Settings"
];

function getStatusTone(isActive) {
  return isActive
    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
    : "bg-rose-500/15 text-rose-500 border-rose-500/25";
}

export default function AdminManagement() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  // List of Admins
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Modals state
  const [addModal, setAddModal] = useState({
    isOpen: false,
    username: "",
    email: "",
    password: "",
    otp: "",
    adminOtp: "",
    otpSent: false,
    otpVerified: false,
    adminOtpVerified: false,
    loading: false
  });

  const [permissionsModal, setPermissionsModal] = useState({
    isOpen: false,
    admin: null,
    selectedPermissions: [],
    loading: false
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    adminId: null,
    email: "",
    loading: false
  });

  const [auditModal, setAuditModal] = useState({
    isOpen: false,
    logs: [],
    searchQuery: "",
    filterAction: "",
    loading: false
  });

  // Fetch Admins
  async function fetchAdmins() {
    try {
      setLoading(true);
      const response = await api.get("/admin/administrators", getAuthHeaders());
      setAdmins(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load administrators");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdmins();
  }, []);

  const isCurrentUserSuperAdmin = currentUser?.role === "Super Administrator" || currentUser?.email === "admin@tradex.com";

  // Enable/Disable Admin
  async function handleToggleStatus(adminId, currentStatus) {
    const target = admins.find(a => a.id === adminId);
    if (adminId === currentUser?.id) {
      toast.error("You cannot deactivate your own Super Administrator account");
      return;
    }
    if (target?.role === "Super Administrator" && !isCurrentUserSuperAdmin) {
      toast.error("Only Super Administrators can modify Super Administrator accounts");
      return;
    }

    try {
      const nextStatus = !currentStatus;
      await api.post(`/admin/administrators/${adminId}/status`, { is_active: nextStatus }, getAuthHeaders());
      toast.success(`Account ${nextStatus ? "enabled" : "disabled"} successfully`);
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to toggle status");
    }
  }

  // Delete Admin
  function openDeleteModal(adminId, email) {
    const target = admins.find(a => a.id === adminId);
    if (adminId === currentUser?.id) {
      toast.error("You cannot delete your own Super Administrator account");
      return;
    }
    if (target?.role === "Super Administrator" && !isCurrentUserSuperAdmin) {
      toast.error("Only Super Administrators can delete Super Administrator accounts");
      return;
    }
    setDeleteModal({ isOpen: true, adminId, email, loading: false });
  }

  async function handleDeleteAdmin() {
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await api.delete(`/admin/administrators/${deleteModal.adminId}`, getAuthHeaders());
      toast.success("Administrator account and all related data deleted successfully");
      setDeleteModal({ isOpen: false, adminId: null, email: "", loading: false });
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete administrator");
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Permissions Modal Logic
  function openPermissionsModal(admin) {
    if (admin.id === currentUser?.id) {
      toast.error("You cannot modify your own Super Administrator permissions");
      return;
    }
    if (admin.role === "Super Administrator" && !isCurrentUserSuperAdmin) {
      toast.error("Only Super Administrators can modify Super Administrator permissions");
      return;
    }

    // Parse existing permissions
    const list = admin.permissions
      ? admin.permissions.split(",").map(p => p.trim())
      : [];

    setPermissionsModal({
      isOpen: true,
      admin,
      selectedPermissions: list,
      loading: false
    });
  }

  function handlePermissionCheckboxChange(permission) {
    setPermissionsModal(prev => {
      const isSelected = prev.selectedPermissions.includes(permission);
      const nextList = isSelected
        ? prev.selectedPermissions.filter(p => p !== permission)
        : [...prev.selectedPermissions, permission];

      return {
        ...prev,
        selectedPermissions: nextList
      };
    });
  }

  async function handleSavePermissions() {
    setPermissionsModal(prev => ({ ...prev, loading: true }));
    try {
      const permissionsStr = permissionsModal.selectedPermissions.join(",");
      await api.put(
        `/admin/administrators/${permissionsModal.admin.id}/permissions`,
        { permissions: permissionsStr },
        getAuthHeaders()
      );
      toast.success("Permissions updated successfully");
      setPermissionsModal({ isOpen: false, admin: null, selectedPermissions: [], loading: false });
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update permissions");
      setPermissionsModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Audit Logs Logic
  async function openAuditModal() {
    setAuditModal({ isOpen: true, logs: [], searchQuery: "", filterAction: "", loading: true });
    try {
      const response = await api.get("/admin/audit-logs", getAuthHeaders());
      setAuditModal(prev => ({ ...prev, logs: response.data, loading: false }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to fetch audit logs");
      setAuditModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Add Admin - Dual OTP Flow
  async function handleSendOtps() {
    if (!addModal.username || !addModal.email || !addModal.password) {
      toast.error("Username, email, and password are required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addModal.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setAddModal(prev => ({ ...prev, loading: true }));
    try {
      await api.post("/auth/send-otp", { email: addModal.email, role: "Administrator" });
      toast.success("Verification OTPs sent to new admin email and Super Admin email");
      setAddModal(prev => ({
        ...prev,
        otpSent: true,
        loading: false,
        otp: "",
        adminOtp: "",
        otpVerified: false,
        adminOtpVerified: false
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send verification OTPs");
      setAddModal(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleVerifyUserOtp() {
    if (!addModal.otp) {
      toast.error("User OTP is required");
      return;
    }
    setAddModal(prev => ({ ...prev, loading: true }));
    try {
      await api.post("/auth/verify-otp", { email: addModal.email, otp: addModal.otp });
      toast.success("User OTP verified successfully");
      setAddModal(prev => ({ ...prev, otpVerified: true, loading: false }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid User OTP");
      setAddModal(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleVerifyAdminOtp() {
    if (!addModal.adminOtp) {
      toast.error("Admin OTP is required");
      return;
    }
    setAddModal(prev => ({ ...prev, loading: true }));
    try {
      await api.post("/auth/verify-otp", { email: addModal.email, otp: addModal.adminOtp, is_admin_otp: true });
      toast.success("Admin OTP verified successfully");
      setAddModal(prev => ({ ...prev, adminOtpVerified: true, loading: false }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid Admin OTP");
      setAddModal(prev => ({ ...prev, loading: false }));
    }
  }

  async function handleRegisterAdmin() {
    setAddModal(prev => ({ ...prev, loading: true }));
    try {
      await api.post("/auth/register", {
        username: addModal.username,
        email: addModal.email,
        password: addModal.password,
        role: "Administrator"
      });
      toast.success("Administrator account registered successfully!");
      setAddModal({
        isOpen: false,
        username: "",
        email: "",
        password: "",
        otp: "",
        adminOtp: "",
        otpSent: false,
        otpVerified: false,
        adminOtpVerified: false,
        loading: false
      });
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
      setAddModal(prev => ({ ...prev, loading: false }));
    }
  }

  // Filtered Admins
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch =
      admin.username.toLowerCase().includes(search.toLowerCase()) ||
      admin.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      status === "" ||
      (status === "active" && admin.is_active) ||
      (status === "inactive" && !admin.is_active);

    return matchesSearch && matchesStatus;
  });

  // Filter logs
  const filteredLogs = auditModal.logs.filter(log => {
    const searchString = `${log.admin_username} ${log.admin_email} ${log.action} ${log.details}`.toLowerCase();
    const matchesSearch = searchString.includes(auditModal.searchQuery.toLowerCase());
    const matchesAction = auditModal.filterAction === "" || log.action === auditModal.filterAction;
    return matchesSearch && matchesAction;
  });

  // Unique actions for logs filtering
  const logActions = Array.from(new Set(auditModal.logs.map(log => log.action)));

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar - styled identically to UserManagement.jsx */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          {/* Search bar */}
          <div>
            <label className="mb-2 block text-sm font-semibold opacity-80">
              Search Administrators
            </label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none appearance-none cursor-pointer"
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

      {/* Main Table Card - styled identically to UserManagement.jsx */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Registered Administrators</h2>
            <span className="text-xs opacity-60 bg-surface/50 border px-3 py-1 rounded-full mt-1.5 inline-block">
              {filteredAdmins.length} total admins
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openAuditModal}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 flex items-center gap-2 cursor-pointer"
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              📋 View Audit Logs
            </button>
            <button
              onClick={() => setAddModal({ isOpen: true, username: "", email: "", password: "", otp: "", adminOtp: "", otpSent: false, otpVerified: false, adminOtpVerified: false, loading: false })}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 flex items-center gap-2 cursor-pointer"
              style={{ backgroundColor: "var(--accent)" }}
            >
              ➕ Add Admin
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-accent" style={{ borderColor: "var(--accent)" }}></div>
            <span className="ml-3 font-semibold">Loading administrators...</span>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-16 opacity-60">
            <p className="text-lg font-semibold">No administrators found</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Administrator</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Role</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Created Date</th>
                  <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    <div>Actions</div>
                    <div className="flex justify-center items-center gap-3 mt-1 text-[9px] font-semibold opacity-65" style={{ textTransform: "none" }}>
                      <span className="w-[30px] text-center" title="Change Permissions">Perms</span>
                      <span className="w-[30px] text-center" title="Delete Admin">Delete</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {filteredAdmins.map(admin => {
                  const isSelf = admin.id === currentUser?.id;
                  const isSuperAdmin = admin.role === "Super Administrator";
                  const cannotModify = isSelf || (isSuperAdmin && !isCurrentUserSuperAdmin);

                  return (
                    <tr key={admin.id} className="hover:bg-surface/10 transition">
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{admin.username}</span>
                          <span className="text-xs opacity-60">{admin.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          admin.role === "Super Administrator" ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                        }`}>
                          {admin.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleToggleStatus(admin.id, admin.is_active)}
                          disabled={cannotModify}
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition hover:opacity-80 ${
                            cannotModify ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                          } ${getStatusTone(admin.is_active)}`}
                          title={
                            isSelf
                              ? "You cannot disable your own account"
                              : isSuperAdmin && !isCurrentUserSuperAdmin
                              ? "Only Super Administrators can disable Super Administrator accounts"
                              : "Click to toggle status"
                          }
                        >
                          {admin.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-xs opacity-75">
                        {new Date(admin.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </td>
                      <td className="px-4 py-4 text-xs opacity-75">
                        {admin.last_login ? (
                          new Date(admin.last_login).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center items-center gap-3">
                          {/* Change Permissions - styled as premium SVGs */}
                          <button
                            onClick={() => openPermissionsModal(admin)}
                            disabled={cannotModify}
                            className={`p-1.5 rounded-lg border transition flex items-center justify-center ${
                              cannotModify
                                ? "opacity-30 cursor-not-allowed border-transparent text-gray-500"
                                : "hover:bg-surface border-transparent text-indigo-400 cursor-pointer"
                            }`}
                            style={!cannotModify ? { borderColor: "var(--border)" } : {}}
                            title={
                              isSelf
                                ? "You cannot modify your own permissions"
                                : isSuperAdmin && !isCurrentUserSuperAdmin
                                ? "Only Super Administrators can modify Super Administrator permissions"
                                : "Change Permissions"
                            }
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                          </button>

                          {/* Delete Admin - styled as premium SVGs */}
                          <button
                            onClick={() => openDeleteModal(admin.id, admin.email)}
                            disabled={cannotModify}
                            className={`p-1.5 rounded-lg border transition flex items-center justify-center ${
                              cannotModify
                                ? "opacity-30 cursor-not-allowed border-transparent text-gray-500"
                                : "hover:bg-rose-500/10 border-transparent text-rose-500 cursor-pointer"
                            }`}
                            style={!cannotModify ? { borderColor: "var(--border)" } : {}}
                            title={
                              isSelf
                                ? "You cannot delete your own account"
                                : isSuperAdmin && !isCurrentUserSuperAdmin
                                ? "Only Super Administrators can delete Super Administrator accounts"
                                : "Delete Administrator"
                            }
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD ADMIN MODAL (DUAL OTP FLOW) --- */}
      {addModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">Register New Administrator</h3>
              <button
                onClick={() => setAddModal({ isOpen: false, username: "", email: "", password: "", otp: "", adminOtp: "", otpSent: false, otpVerified: false, adminOtpVerified: false, loading: false })}
                className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!addModal.otpSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 opacity-80">Username</label>
                  <input
                    value={addModal.username}
                    onChange={(e) => setAddModal(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter name"
                    className="w-full rounded-xl border px-4 py-2.5 outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 opacity-80">Email</label>
                  <input
                    type="email"
                    value={addModal.email}
                    onChange={(e) => setAddModal(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    className="w-full rounded-xl border px-4 py-2.5 outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 opacity-80">Password</label>
                  <input
                    type="password"
                    value={addModal.password}
                    onChange={(e) => setAddModal(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter secure password"
                    className="w-full rounded-xl border px-4 py-2.5 outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={addModal.loading}
                    onClick={handleSendOtps}
                    className="w-full rounded-xl py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center cursor-pointer"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {addModal.loading ? "Sending OTPs..." : "Send Verification OTPs"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-xl p-3 text-xs leading-relaxed">
                  Dual OTPs triggered: One sent to the new administrator's email, and another to the system approval inbox (tradex.adminn@gmail.com).
                </div>

                {/* User OTP */}
                <div className="border p-4 rounded-xl" style={{ borderColor: "var(--border)" }}>
                  <label className="block text-sm font-semibold mb-1 opacity-85">User OTP (Sent to new admin)</label>
                  {addModal.otpVerified ? (
                    <span className="text-emerald-500 font-bold text-sm block py-1.5">✓ User OTP Verified</span>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <input
                        value={addModal.otp}
                        onChange={(e) => setAddModal(prev => ({ ...prev, otp: e.target.value }))}
                        placeholder="6-digit OTP"
                        maxLength={6}
                        className="rounded-xl border px-3 py-2 outline-none flex-1"
                        style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                      />
                      <button
                        onClick={handleVerifyUserOtp}
                        disabled={addModal.loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-4 py-2 text-sm cursor-pointer"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                </div>

                {/* Admin OTP */}
                <div className="border p-4 rounded-xl" style={{ borderColor: "var(--border)" }}>
                  <label className="block text-sm font-semibold mb-1 opacity-85">Admin OTP (Sent to Super Admin)</label>
                  {addModal.adminOtpVerified ? (
                    <span className="text-emerald-500 font-bold text-sm block py-1.5">✓ Super Admin OTP Verified</span>
                  ) : (
                    <div className="flex gap-2 mt-1">
                      <input
                        value={addModal.adminOtp}
                        onChange={(e) => setAddModal(prev => ({ ...prev, adminOtp: e.target.value }))}
                        placeholder="6-digit Admin OTP"
                        maxLength={6}
                        className="rounded-xl border px-3 py-2 outline-none flex-1"
                        style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                      />
                      <button
                        onClick={handleVerifyAdminOtp}
                        disabled={addModal.loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-4 py-2 text-sm cursor-pointer"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                </div>

                {addModal.otpVerified && addModal.adminOtpVerified && (
                  <div className="pt-3">
                    <button
                      onClick={handleRegisterAdmin}
                      disabled={addModal.loading}
                      className="w-full rounded-xl py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center cursor-pointer"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      {addModal.loading ? "Registering..." : "Complete Administrator Registration"}
                    </button>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setAddModal(prev => ({ ...prev, otpSent: false }))}
                    className="text-sm underline opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ← Edit Details / Resend OTPs
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PERMISSIONS MODAL --- */}
      {permissionsModal.isOpen && permissionsModal.admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">Manage Admin Permissions</h3>
              <button
                onClick={() => setPermissionsModal({ isOpen: false, admin: null, selectedPermissions: [], loading: false })}
                className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm opacity-85 mb-4">
              Update roles and feature modules accessible for <strong>{permissionsModal.admin.username}</strong> ({permissionsModal.admin.email}).
            </p>

            <div className="space-y-3 mb-6">
              {PREDEFINED_PERMISSIONS.map(permission => {
                const isChecked = permissionsModal.selectedPermissions.includes(permission);
                return (
                  <label
                    key={permission}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-surface/10 transition"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handlePermissionCheckboxChange(permission)}
                      className="w-5 h-5 rounded accent-accent cursor-pointer"
                    />
                    <span className="text-sm font-semibold">{permission}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={permissionsModal.loading}
                onClick={handleSavePermissions}
                className="flex-1 rounded-xl py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50 flex justify-center items-center cursor-pointer"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {permissionsModal.loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setPermissionsModal({ isOpen: false, admin: null, selectedPermissions: [], loading: false })}
                className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-surface transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
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
              <h3 className="text-xl font-bold">Remove Administrator</h3>
            </div>

            <p className="text-sm opacity-80 leading-relaxed mb-6">
              Are you absolutely sure you want to delete administrator account <strong>{deleteModal.email}</strong>?
              <br />
              <span className="text-rose-500 font-bold block mt-2">
                WARNING: This is irreversible. The account, including all logs and session histories associated with this administrator, will be deleted.
              </span>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleteModal.loading}
                onClick={handleDeleteAdmin}
                className="flex-1 rounded-xl py-3 font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 flex justify-center items-center bg-rose-600 cursor-pointer"
              >
                {deleteModal.loading ? "Deleting..." : "Delete Account"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, adminId: null, email: "", loading: false })}
                className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-surface transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- AUDIT LOGS MODAL --- */}
      {auditModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl p-6 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <div className="flex justify-between items-center border-b pb-4 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">Administrative Audit & Action Logs</h3>
              <button
                onClick={() => setAuditModal({ isOpen: false, logs: [], searchQuery: "", filterAction: "", loading: false })}
                className="p-1 rounded-lg hover:bg-surface opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 mb-4">
              <input
                value={auditModal.searchQuery}
                onChange={(e) => setAuditModal(prev => ({ ...prev, searchQuery: e.target.value }))}
                placeholder="Search audit trail..."
                className="rounded-xl border px-4 py-2 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
              />

              <select
                value={auditModal.filterAction}
                onChange={(e) => setAuditModal(prev => ({ ...prev, filterAction: e.target.value }))}
                className="rounded-xl border px-4 py-2 text-sm outline-none appearance-none cursor-pointer"
                style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
              >
                <option value="">All Actions</option>
                {logActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto flex-1 rounded-xl border mb-4" style={{ borderColor: "var(--border)" }}>
              {auditModal.loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                  <span className="ml-3 font-semibold">Loading audit logs...</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-16 opacity-60">
                  <p className="text-base font-semibold">No audit logs matching selection</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10" style={{ background: "var(--card)" }}>
                    <tr className="border-b text-left font-bold opacity-75 uppercase" style={{ borderColor: "var(--border)" }}>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Administrator</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-surface/10">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold">{log.admin_username}</div>
                          <div className="opacity-60">{log.admin_email}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-accent">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 max-w-sm break-words">
                          {log.details || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono">
                          {log.ip_address || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setAuditModal({ isOpen: false, logs: [], searchQuery: "", filterAction: "", loading: false })}
                className="rounded-xl border px-5 py-2 text-sm font-semibold hover:bg-surface transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
