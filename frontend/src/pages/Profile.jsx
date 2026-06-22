import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import ConfirmDialog from "../components/ConfirmDialog";
import SupportChatModal from "../components/SupportChatModal";
import {
  changePassword,
  disableTwoFactor,
  enableEmailTwoFactor,
  getActiveSessions,
  getProfile,
  logoutOtherSessions,
  logoutSession,
  setupGoogleTwoFactor,
  updateProfile,
  verifyEmailTwoFactor,
  verifyGoogleTwoFactor,
} from "../api/authApi";
import {
  formatBrowser,
  formatDevice,
  formatDuration,
  formatSecurityDate,
  getStatusClass,
} from "../utils/device";

function Profile() {
  const [profile, setProfile] = useState(() => {
    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error("Failed to parse cached user", error);
      }
    }

    return {
      username: "",
      email: "",
      phone_number: "",
      account_holder_name: "",
      account_number: "",
      ifsc_code: "",
      bank_name: "",
      upi_id: "",
      two_factor_enabled: false,
      two_factor_method: null,
    };
  });

  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(!localStorage.getItem("user"));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [googleSetup, setGoogleSetup] = useState(null);
  const [twoFactorDialog, setTwoFactorDialog] = useState(null);
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [sessions, setSessions] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    loadProfile();

    const handleOpenChat = () => {
      setIsChatOpen(true);
    };

    const handleStorageChange = (event) => {
      if (
        event.key === "tradex_session_status" &&
        event.newValue &&
        event.newValue.startsWith("stay_")
      ) {
        loadProfile();
      }
    };

    window.addEventListener("tradex_open_chat", handleOpenChat);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("tradex_open_chat", handleOpenChat);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const loadProfile = async () => {
    try {
      const response = await getProfile();
      setProfile(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error("Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await getActiveSessions();
      setSessions(response.data);
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load active sessions");
      return [];
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleProfileUpdate = async (event) => {
    event.preventDefault();

    const hasBank = profile.account_number?.trim() && profile.ifsc_code?.trim();
    const hasUpi = profile.upi_id?.trim();

    if (!hasBank && !hasUpi) {
      toast.error("Please provide either Bank details (A/c + IFSC) or a UPI ID for withdrawals");
      return;
    }

    try {
      await updateProfile(profile);
      toast.success("Profile updated successfully");
      loadProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      await changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      });
      toast.success("Password changed successfully");
      setPasswordData({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    }
  };

  const handleToggleSessions = async () => {
    if (showSessions) {
      setShowSessions(false);
      return;
    }

    setShowSessions(true);
    await fetchActiveSessions();
  };

  const handleLogoutOtherDevices = async () => {
    setLoggingOutOthers(true);
    try {
      const response = await logoutOtherSessions();
      const revokedCount = response.data.count || 0;

      if (revokedCount > 0) {
        toast.success(`Logged out ${revokedCount} other session${revokedCount > 1 ? "s" : ""}`);
      } else {
        toast.info("No other active sessions found");
      }

      setShowSessions(true);
      await fetchActiveSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to logout other devices");
    } finally {
      setLoggingOutOthers(false);
    }
  };

  const handleLogoutSession = async (sessionId) => {
    try {
      await logoutSession(sessionId);
      toast.success("Session logged out successfully");
      await fetchActiveSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to logout session");
    }
  };

  const updateCachedProfile = (nextProfile) => {
    setProfile(nextProfile);
    localStorage.setItem("user", JSON.stringify(nextProfile));
  };

  const closeTwoFactorDialog = () => {
    setTwoFactorDialog(null);
    setTwoFactorOtp("");
  };

  const getGoogleQrUrl = () => {
    if (!googleSetup?.provisioning_uri) {
      return "";
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(googleSetup.provisioning_uri)}`;
  };

  const handleEnableEmailOtp = async () => {
    setTwoFactorLoading(true);

    try {
      await enableEmailTwoFactor();
      setTwoFactorOtp("");
      setTwoFactorDialog("email");
      toast.info("Enter the OTP sent to your email");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to enable Email OTP");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleEnableGoogleAuthenticator = async () => {
    setTwoFactorLoading(true);

    try {
      const setupResponse = await setupGoogleTwoFactor();
      setGoogleSetup(setupResponse.data);
      setTwoFactorOtp("");
      setTwoFactorDialog("google");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to enable Google Authenticator");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!profile.two_factor_enabled) {
      toast.info("Two-factor authentication is already disabled");
      return;
    }

    setTwoFactorDialog("disable");
  };

  const handleVerifyTwoFactor = async (event) => {
    event.preventDefault();
    setTwoFactorLoading(true);

    try {
      const response =
        twoFactorDialog === "email"
          ? await verifyEmailTwoFactor(twoFactorOtp.trim())
          : await verifyGoogleTwoFactor(twoFactorOtp.trim());

      updateCachedProfile(response.data);
      closeTwoFactorDialog();
      toast.success(
        twoFactorDialog === "email"
          ? "Email OTP enabled"
          : "Google Authenticator enabled"
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to verify 2FA code");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirmDisableTwoFactor = async () => {
    setTwoFactorLoading(true);

    try {
      const response = await disableTwoFactor();
      updateCachedProfile(response.data);
      setGoogleSetup(null);
      closeTwoFactorDialog();
      toast.success("Two-factor authentication disabled");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to disable 2FA");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const requestConfirm = (dialog) => {
    setConfirmDialog(dialog);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const confirmAndRun = async () => {
    const action = confirmDialog?.action;
    closeConfirmDialog();
    if (action) {
      await action();
    }
  };

  const formatDateTime = (value) => {
    return new Date(value).toLocaleString();
  };

  if (loading) {
    return (
      <div className="page-bg min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-xl font-semibold">Loading Profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg min-h-screen">
      <Navbar />
      <div className="theme-main px-4 py-8 md:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="mb-8">
            <h1 className="text-4xl font-black">User Profile</h1>
            <p className="mt-2 text-sm opacity-70">Manage your personal information and bank details for withdrawals.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-8">
              <div className="rounded-[28px] border p-6 shadow-xl space-y-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-2xl font-bold">Profile Details</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Full Name</label>
                    <input
                      type="text"
                      value={profile.username}
                      onChange={(event) => setProfile({ ...profile, username: event.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full rounded-xl border p-3 bg-transparent opacity-50 cursor-not-allowed"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Phone Number</label>
                    <input
                      type="text"
                      value={profile.phone_number || ""}
                      onChange={(event) => setProfile({ ...profile, phone_number: event.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                    <h3 className="text-lg font-bold mb-4">Bank Details (for Withdrawals)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 opacity-70">Account Holder Name</label>
                        <input
                          type="text"
                          value={profile.account_holder_name || ""}
                          onChange={(event) => setProfile({ ...profile, account_holder_name: event.target.value })}
                          className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                          style={{ borderColor: "var(--border)" }}
                          placeholder="Name as per bank"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 opacity-70">Account Number</label>
                        <input
                          type="text"
                          value={profile.account_number || ""}
                          onChange={(event) => setProfile({ ...profile, account_number: event.target.value })}
                          className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                          style={{ borderColor: "var(--border)" }}
                          placeholder="Bank account number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 opacity-70">IFSC Code</label>
                        <input
                          type="text"
                          value={profile.ifsc_code || ""}
                          onChange={(event) => setProfile({ ...profile, ifsc_code: event.target.value })}
                          className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                          style={{ borderColor: "var(--border)" }}
                          placeholder="Bank IFSC code"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 opacity-70">Bank Name</label>
                        <input
                          type="text"
                          value={profile.bank_name || ""}
                          onChange={(event) => setProfile({ ...profile, bank_name: event.target.value })}
                          className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                          style={{ borderColor: "var(--border)" }}
                          placeholder="Enter bank name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 opacity-70">UPI ID</label>
                        <input
                          type="text"
                          value={profile.upi_id || ""}
                          onChange={(event) => setProfile({ ...profile, upi_id: event.target.value })}
                          className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                          style={{ borderColor: "var(--border)" }}
                          placeholder="example@upi"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl py-3 font-bold shadow-lg transition hover:opacity-90"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    Save Profile Changes
                  </button>
                </form>
              </div>

              <div className="rounded-[28px] border p-6 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-2xl font-bold mb-4">Session Management</h2>
                <p className="text-sm opacity-70 mb-6">Manage active sessions and secure your account.</p>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleToggleSessions}
                    className="flex-1 rounded-xl py-3 font-bold transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    {showSessions ? "Hide Active Sessions" : "View Active Sessions"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      requestConfirm({
                        title: "Logout other devices?",
                        message: "This will immediately terminate every active session except this one.",
                        confirmText: "Logout Devices",
                        action: handleLogoutOtherDevices,
                      })
                    }
                    disabled={loggingOutOthers}
                    className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white transition disabled:opacity-60"
                  >
                    {loggingOutOthers ? "Logging Out..." : "Logout Other Devices"}
                  </button>
                </div>

                {showSessions && (
                  <div className="mt-6 border-t pt-6" style={{ borderColor: "var(--border)" }}>
                    {sessionsLoading ? (
                      <div className="rounded-2xl border p-4 text-sm opacity-70" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
                        Loading active sessions...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="rounded-2xl border p-4 text-sm opacity-70" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
                        No active sessions found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                        <table className="w-full text-left">
                          <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                            <tr>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Device</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Browser/App</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">IP Address</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Location</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Login Time</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Last Activity</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Session Status</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Current</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Duration</th>
                              <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider opacity-60">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessions.map((session) => (
                              <tr key={session.id} className="border-b last:border-0 hover:bg-white/5" style={{ borderColor: "var(--border)" }}>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{formatDevice(session.device, session.browser)}</td>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{formatBrowser(session.device, session.browser)}</td>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{session.ip_address || "Unknown"}</td>
                                <td className="min-w-[180px] px-4 py-4 text-sm">{session.location || "Unknown Location"}</td>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{formatSecurityDate(session.created_at)}</td>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{formatSecurityDate(session.last_activity)}</td>
                                <td className="px-4 py-4">
                                  <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusClass(session.status || "Active")}`}>
                                    {session.status || "Active"}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  {session.is_current ? (
                                    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                                      Current Session
                                    </span>
                                  ) : (
                                    <span className="text-xs opacity-50">-</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-4 text-sm">{formatDuration(session.session_duration)}</td>
                                <td className="px-4 py-4">
                                  <button
                                    type="button"
                                    disabled={session.is_current}
                                    onClick={() =>
                                      requestConfirm({
                                        title: "Logout this session?",
                                        message: "This device will be signed out immediately and will need to login again.",
                                        confirmText: "Logout Session",
                                        action: () => handleLogoutSession(session.id),
                                      })
                                    }
                                    className="rounded-xl border px-3 py-2 text-xs font-bold text-rose-500 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    style={{ borderColor: "var(--border)" }}
                                  >
                                    Logout
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border p-6 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Login History</h2>

                  <Link
                    to="/profile/login-history"
                    className="px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    View All
                  </Link>
                </div>

                <p className="text-sm opacity-70 mb-4">View all your recent account login activities.</p>

                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--accent-soft)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.25em] opacity-50">Logs</span>

                    <div>
                      <p className="font-bold">Secure Login Monitoring</p>
                      <p className="text-sm opacity-70">Check IP address, device, location and login time.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="rounded-[28px] border p-6 shadow-xl space-y-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-2xl font-bold">Security</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Old Password</label>
                    <input
                      type="password"
                      value={passwordData.old_password}
                      onChange={(event) => setPasswordData({ ...passwordData, old_password: event.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">New Password</label>
                    <input
                      type="password"
                      value={passwordData.new_password}
                      onChange={(event) => setPasswordData({ ...passwordData, new_password: event.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(event) => setPasswordData({ ...passwordData, confirm_password: event.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl py-3 font-bold shadow-lg transition hover:opacity-90"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    Update Password
                  </button>
                </form>

                <div className="border-t pt-6 space-y-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold">Two-Factor Authentication</h3>
                      <p className="mt-1 text-sm opacity-70">Status: {profile.two_factor_enabled ? "Enabled" : "Disabled"}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                        profile.two_factor_enabled
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-slate-500/15 text-slate-500"
                      }`}
                    >
                      {profile.two_factor_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
                    <p className="text-sm font-bold">Authentication Methods:</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                        <p className="font-bold">Email OTP</p>
                        <p className="text-xs opacity-70">
                          {profile.two_factor_method === "email" ? "Active method" : "Use codes sent to your email"}
                        </p>
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                        <p className="font-bold">Google Authenticator</p>
                        <p className="text-xs opacity-70">
                          {profile.two_factor_method === "google" ? "Active method" : "Use a 6-digit authenticator code"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleEnableEmailOtp}
                      disabled={twoFactorLoading}
                      className="w-full rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-wider transition hover:scale-[1.01] disabled:opacity-60"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--card)" }}
                    >
                      Email OTP
                    </button>

                    <button
                      type="button"
                      onClick={handleEnableGoogleAuthenticator}
                      disabled={twoFactorLoading}
                      className="w-full rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-wider transition hover:scale-[1.01] disabled:opacity-60"
                      style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--card)" }}
                    >
                      Authenticator
                    </button>

                    <button
                      type="button"
                      onClick={handleDisableTwoFactor}
                      disabled={twoFactorLoading || !profile.two_factor_enabled}
                      className="w-full rounded-xl border border-red-400 bg-red-500/10 px-4 py-3 text-sm font-black uppercase tracking-wider text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-60 sm:col-span-2"
                    >
                      Disable 2FA
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border p-6 shadow-xl" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", borderWidth: "1px" }}>
                <h3 className="text-xl font-bold" style={{ color: "var(--accent)" }}>Account Status</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="opacity-70">Account Type:</span>
                    <span className="font-bold">{profile.is_admin ? "Administrator" : "Trader"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Member Since:</span>
                    <span className="font-bold">{new Date().getFullYear()}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border p-6 shadow-xl space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-2xl font-bold">Help & Support</h2>
                  <Link
                    to="/profile/tickets"
                    className="px-4 py-2 rounded-xl text-sm font-bold transition hover:opacity-90 shadow-lg"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    My Tickets
                  </Link>
                </div>
                <p className="text-sm opacity-70">Having issues? Reach out to our team for assistance.</p>

                <div className="space-y-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="w-full rounded-2xl p-4 border border-dashed flex justify-center items-center gap-2 font-bold text-lg transition hover:bg-white/5"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  >
                    <span>Chat</span> Chat With Us
                  </button>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-50 mb-1">Account Issues</p>
                    <a href="mailto:tradex.support@gmail.com" className="text-sm md:text-lg font-bold hover:text-accent transition">
                      tradex.support@gmail.com
                    </a>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-50 mb-1">Payment Related</p>
                    <a href="mailto:tradex.adminn@gmail.com" className="text-sm md:text-lg font-bold hover:text-accent transition">
                      tradex.adminn@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {twoFactorDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            {twoFactorDialog === "disable" ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-2xl font-bold">Disable 2FA</h3>
                  <p className="mt-2 text-sm opacity-70">This will remove the extra verification step from your account.</p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeTwoFactorDialog}
                    className="flex-1 rounded-xl border px-4 py-3 font-bold transition hover:opacity-80"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisableTwoFactor}
                    disabled={twoFactorLoading}
                    className="flex-1 rounded-xl bg-red-500 px-4 py-3 font-bold text-white transition disabled:opacity-60"
                  >
                    {twoFactorLoading ? "Disabling..." : "Disable"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyTwoFactor} className="space-y-5">
                <div>
                  <h3 className="text-2xl font-bold">
                    {twoFactorDialog === "email" ? "Enable Email OTP" : "Enable Google Authenticator"}
                  </h3>
                  <p className="mt-2 text-sm opacity-70">
                    {twoFactorDialog === "email"
                      ? "Enter the OTP sent to your registered email address."
                      : "Scan the QR code with Google Authenticator, then enter the 6-digit code."}
                  </p>
                </div>

                {twoFactorDialog === "google" && googleSetup && (
                  <div className="space-y-4">
                    <div className="flex justify-center rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
                      <img
                        src={getGoogleQrUrl()}
                        alt="Google Authenticator QR code"
                        className="h-[220px] w-[220px]"
                      />
                    </div>

                    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--accent-soft)" }}>
                      <p className="font-bold">Manual Secret</p>
                      <p className="mt-1 break-all font-mono">{googleSetup.secret}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1 opacity-70">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorOtp}
                    onChange={(event) => setTwoFactorOtp(event.target.value)}
                    className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                    style={{ borderColor: "var(--border)" }}
                    placeholder="Enter 6-digit code"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeTwoFactorDialog}
                    className="flex-1 rounded-xl border px-4 py-3 font-bold transition hover:opacity-80"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={twoFactorLoading || !twoFactorOtp.trim()}
                    className="flex-1 rounded-xl px-4 py-3 font-bold transition disabled:opacity-60"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    {twoFactorLoading ? "Verifying..." : "Verify"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <SupportChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ConfirmDialog
        isOpen={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmText={confirmDialog?.confirmText}
        onCancel={closeConfirmDialog}
        onConfirm={confirmAndRun}
      />
    </div>
  );
}

export default Profile;
