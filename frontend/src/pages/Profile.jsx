import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import SupportChatModal from "../components/SupportChatModal";
import { getProfile, updateProfile, changePassword } from "../api/authApi";

function Profile() {
  const [profile, setProfile] = useState(() => {
    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached user", e);
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
    };
  });

  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(!localStorage.getItem("user"));
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    loadProfile();

    const handleOpenChat = () => {
      setIsChatOpen(true);
    };

    const handleStorageChange = (e) => {
      if (e.key === "tradex_session_status" && e.newValue && e.newValue.startsWith("stay_")) {
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
      // Update cache
      localStorage.setItem("user", JSON.stringify(response.data));
      setLoading(false);
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error("Failed to load profile");
      }
      // Stop loading even on 401 so cached data (if any) is visible
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

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

  const handlePasswordChange = async (e) => {
    e.preventDefault();
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-black">User Profile</h1>
            <p className="mt-2 text-sm opacity-70">Manage your personal information and bank details for withdrawals.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Personal & Bank Details Form */}
            <div className="rounded-[28px] border p-6 shadow-xl space-y-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <h2 className="text-2xl font-bold">Profile Details</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-70">Full Name</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
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
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, account_holder_name: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, account_number: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, ifsc_code: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
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
                        onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                        className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                        style={{ borderColor: "var(--border)" }}
                        placeholder="example@upi"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl py-3 font-bold text-white shadow-lg transition hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  Save Profile Changes
                </button>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="space-y-8">
              <div className="rounded-[28px] border p-6 shadow-xl space-y-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <h2 className="text-2xl font-bold">Security</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-70">Old Password</label>
                    <input
                      type="password"
                      value={passwordData.old_password}
                      onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
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
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
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
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="w-full rounded-xl border p-3 bg-transparent focus:ring-2 focus:ring-accent outline-none transition"
                      style={{ borderColor: "var(--border)" }}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl py-3 font-bold text-white shadow-lg transition hover:opacity-90"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    Update Password
                  </button>
                </form>
              </div>

              {/* Account Info Box */}
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

              {/* Help & Support Box */}
              <div className="rounded-[28px] border p-6 shadow-xl space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-2xl font-bold">Help & Support</h2>
                  <Link 
                    to="/profile/tickets" 
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 shadow-lg"
                    style={{ background: "var(--accent)" }}
                  >
                    My Tickets
                  </Link>
                </div>
                <p className="text-sm opacity-70">Having issues? Reach out to our team for assistance.</p>
                
                <div className="space-y-4 pt-2">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="w-full rounded-2xl p-4 border border-dashed flex justify-center items-center gap-2 font-bold text-lg transition hover:bg-white/5"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  >
                    <span>💬</span> Chat With Us
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
      
      <SupportChatModal 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
}

export default Profile;
