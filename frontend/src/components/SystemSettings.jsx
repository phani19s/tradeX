import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import ConfirmDialog from "./ConfirmDialog";

function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN");
  } catch (e) {
    return isoString;
  }
}

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    trading_start_time: "",
    trading_end_time: "",
    otp_expiry_seconds: "",
    min_deposit_amount: "",
    min_withdrawal_amount: "",
    maintenance_mode: "false",
    maintenance_title: "",
    maintenance_message: "",
    maintenance_eta: "",
    email_sender: "",
    smtp_server: "",
    smtp_port: "",
    smtp_username: "",
    smtp_password: "",
    gemini_api_key: "",
    openai_api_key: ""
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // History state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Maintenance Confirmation Modal state
  const [confirmMaintenance, setConfirmMaintenance] = useState({
    isOpen: false,
    nextValue: false
  });

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await api.get("/admin/settings", getAuthHeaders());
      setSettings(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load system settings");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      setLoadingHistory(true);
      const res = await api.get("/admin/settings/history", getAuthHeaders());
      setHistory(res.data);
    } catch (error) {
      console.error("Failed to load settings history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, []);

  function handleInputChange(key, val) {
    setSettings(prev => ({
      ...prev,
      [key]: val
    }));
  }

  // Handle Maintenance Mode Click specifically (triggers confirmation dialog)
  function handleMaintenanceClick() {
    const nextVal = settings.maintenance_mode !== "true";
    setConfirmMaintenance({
      isOpen: true,
      nextValue: nextVal
    });
  }

  async function handleMaintenanceConfirm() {
    const nextVal = confirmMaintenance.nextValue ? "true" : "false";
    const updatedSettings = {
      ...settings,
      maintenance_mode: nextVal
    };
    
    setSettings(updatedSettings);
    setConfirmMaintenance(prev => ({ ...prev, isOpen: false }));

    try {
      setSaving(true);
      await api.post("/admin/settings", updatedSettings, getAuthHeaders());
      toast.success(`Maintenance Mode turned ${nextVal === "true" ? "ON" : "OFF"} successfully`);
      fetchSettings();
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update Maintenance Mode");
    } finally {
      setSaving(false);
    }
  }

  // Form Submit Action
  async function handleSubmit(e) {
    e.preventDefault();

    // 1. Validations
    const startRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
    if (settings.trading_start_time && !startRegex.test(settings.trading_start_time)) {
      toast.error("Trading Start Time must match HH:MM (e.g. 09:15)");
      return;
    }
    if (settings.trading_end_time && !startRegex.test(settings.trading_end_time)) {
      toast.error("Trading End Time must match HH:MM (e.g. 15:30)");
      return;
    }

    const otpExp = Number(settings.otp_expiry_seconds);
    if (isNaN(otpExp) || otpExp <= 0) {
      toast.error("OTP Expiry must be a positive integer");
      return;
    }

    const minDep = Number(settings.min_deposit_amount);
    if (isNaN(minDep) || minDep < 0) {
      toast.error("Minimum Deposit must be a positive number");
      return;
    }

    const minWith = Number(settings.min_withdrawal_amount);
    if (isNaN(minWith) || minWith < 0) {
      toast.error("Minimum Withdrawal must be a positive number");
      return;
    }

    const smtpP = Number(settings.smtp_port);
    if (isNaN(smtpP) || smtpP <= 0) {
      toast.error("SMTP Port must be a positive integer");
      return;
    }

    try {
      setSaving(true);
      await api.post("/admin/settings", settings, getAuthHeaders());
      toast.success("System configurations saved successfully");
      fetchSettings(); // Refresh (re-masks keys)
      fetchHistory(); // Refresh history log
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="theme-card rounded-2xl p-12 text-center shadow flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
          <span className="font-semibold text-sm opacity-70">Loading system settings...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: General Configuration */}
            <div className="space-y-6">
              {/* Trading & Limits Card */}
              <div className="theme-card rounded-2xl p-6 shadow space-y-4 text-sm">
                <h3 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  Trading & Parameters
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Trading Start (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="e.g. 09:00"
                      required
                      value={settings.trading_start_time}
                      onChange={(e) => handleInputChange("trading_start_time", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none placeholder:opacity-50"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Trading End (HH:MM)</label>
                    <input
                      type="text"
                      placeholder="e.g. 17:00"
                      required
                      value={settings.trading_end_time}
                      onChange={(e) => handleInputChange("trading_end_time", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none placeholder:opacity-50"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold opacity-85">OTP Expiry Duration (Seconds)</label>
                  <input
                    type="number"
                    required
                    value={settings.otp_expiry_seconds}
                    onChange={(e) => handleInputChange("otp_expiry_seconds", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Min Deposit (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={settings.min_deposit_amount}
                      onChange={(e) => handleInputChange("min_deposit_amount", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Min Withdrawal (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={settings.min_withdrawal_amount}
                      onChange={(e) => handleInputChange("min_withdrawal_amount", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Maintenance Mode Card */}
              <div className="theme-card rounded-2xl p-6 shadow space-y-4 text-sm">
                <h3 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  Application Status
                </h3>
                
                <div className="flex items-center justify-between p-4 rounded-xl border bg-surface/10" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <h4 className="font-bold text-sm">Maintenance Mode</h4>
                    <p className="text-xs opacity-75 mt-0.5">Locks system access for standard users.</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleMaintenanceClick}
                    className={`relative h-6 w-12 rounded-full transition-colors cursor-pointer ${
                      settings.maintenance_mode === "true" ? "bg-green-600" : "bg-slate-400"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
                        settings.maintenance_mode === "true" ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Maintenance Page Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. System Under Maintenance"
                      value={settings.maintenance_title || ""}
                      onChange={(e) => handleInputChange("maintenance_title", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Maintenance Message</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. We are performing scheduled updates..."
                      value={settings.maintenance_message || ""}
                      onChange={(e) => handleInputChange("maintenance_message", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none resize-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Estimated Completion Time (ETA)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2 Hours, 05:00 PM UTC"
                      value={settings.maintenance_eta || ""}
                      onChange={(e) => handleInputChange("maintenance_eta", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Server Credentials & Integration Keys */}
            <div className="space-y-6">
              {/* SMTP Credentials Card */}
              <div className="theme-card rounded-2xl p-6 shadow space-y-4 text-sm">
                <h3 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  SMTP Mail Configurations
                </h3>
                
                <div className="space-y-1">
                  <label className="font-semibold opacity-85">Sender Address</label>
                  <input
                    type="email"
                    required
                    value={settings.email_sender}
                    onChange={(e) => handleInputChange("email_sender", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold opacity-85">SMTP Server</label>
                    <input
                      type="text"
                      required
                      value={settings.smtp_server}
                      onChange={(e) => handleInputChange("smtp_server", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold opacity-85">Port</label>
                    <input
                      type="number"
                      required
                      value={settings.smtp_port}
                      onChange={(e) => handleInputChange("smtp_port", e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold opacity-85">SMTP Username</label>
                  <input
                    type="text"
                    required
                    value={settings.smtp_username}
                    onChange={(e) => handleInputChange("smtp_username", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold opacity-85">SMTP Password (Masked)</label>
                  <input
                    type="password"
                    required
                    value={settings.smtp_password}
                    onChange={(e) => handleInputChange("smtp_password", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>

              {/* API Integration Keys */}
              <div className="theme-card rounded-2xl p-6 shadow space-y-4 text-sm">
                <h3 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--border)" }}>
                  AI Integration Credentials
                </h3>
                
                <div className="space-y-1">
                  <label className="font-semibold opacity-85">Gemini API Key (Masked)</label>
                  <input
                    type="password"
                    required
                    value={settings.gemini_api_key}
                    onChange={(e) => handleInputChange("gemini_api_key", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold opacity-85">OpenAI API Key (Masked)</label>
                  <input
                    type="password"
                    required
                    value={settings.openai_api_key}
                    onChange={(e) => handleInputChange("openai_api_key", e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border focus:outline-none"
                    style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg font-bold text-xs text-white transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Configuration Changes History Card */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <h3 className="text-xl font-bold mb-4">Configuration Audit Trail</h3>
        
        {loadingHistory ? (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
            <span className="ml-2 text-xs opacity-75">Loading audit trail...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-xs opacity-60">
            No configuration adjustments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-surface/50 text-left text-xs font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Parameter Key</th>
                  <th className="px-4 py-3">Old Value</th>
                  <th className="px-4 py-3">New Value</th>
                  <th className="px-4 py-3">Modified By</th>
                  <th className="px-4 py-3">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs" style={{ color: "var(--text)" }}>
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-accent">{h.setting_key}</td>
                    <td className="px-4 py-3 opacity-80 max-w-[150px] truncate" title={h.old_value || ""}>
                      {h.old_value || "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400 max-w-[150px] truncate" title={h.new_value}>
                      {h.new_value}
                    </td>
                    <td className="px-4 py-3 opacity-75">{h.changed_by}</td>
                    <td className="px-4 py-3 opacity-75 whitespace-nowrap">{formatDateTime(h.changed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maintenance Toggle Confirmation */}
      <ConfirmDialog
        isOpen={confirmMaintenance.isOpen}
        title={confirmMaintenance.nextValue ? "Enable Maintenance Mode?" : "Disable Maintenance Mode?"}
        message={
          confirmMaintenance.nextValue
            ? "Are you absolutely sure you want to enable Maintenance Mode? This will restrict database write operations and lock all trader user accounts out of the application."
            : "Are you sure you want to disable Maintenance Mode? This will restore standard user trading operations and unlock client login access."
        }
        confirmText={confirmMaintenance.nextValue ? "Enable Mode" : "Disable Mode"}
        onCancel={() => setConfirmMaintenance(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleMaintenanceConfirm}
      />
    </div>
  );
}
