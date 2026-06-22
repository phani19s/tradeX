import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import {
  resetForgotPassword,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
} from "../api/authApi";
import tradingBg from "../assets/trading-bg.jpg";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState("email");
  const [loading, setLoading] = useState(false);
  const autoVerifyRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get("email") || "";
    const otpParam = searchParams.get("otp") || "";

    if (!emailParam || !otpParam || autoVerifyRef.current) {
      return;
    }

    autoVerifyRef.current = true;
    setEmail(emailParam);
    setOtp(otpParam);
    setStep("otp");
    verifyResetLink(emailParam, otpParam);
  }, [searchParams]);

  async function verifyResetLink(emailValue, otpValue) {
    setLoading(true);
    try {
      const response = await verifyForgotPasswordOtp(emailValue.trim(), otpValue.trim());
      toast.success(response.data.message);
      setStep("password");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid or expired reset link");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!email.trim()) {
      toast.error("Enter your registered email");
      return;
    }

    setLoading(true);
    try {
      const response = await sendForgotPasswordOtp(email.trim());
      toast.success(response.data.message);
      setStep("otp");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reset OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      toast.error("Enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await verifyForgotPasswordOtp(email.trim(), otp.trim());
      toast.success(response.data.message);
      setStep("password");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("Enter and confirm your new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await resetForgotPassword({
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast.success(response.data.message);
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{
        backgroundImage: `url(${tradingBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/80" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-blue-400/20 bg-slate-900/70 p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h1 className="text-center text-4xl font-extrabold">TradeX</h1>
        <p className="mt-2 text-center text-sm text-blue-200">Reset account password</p>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Registered email"
            value={email}
            disabled={step !== "email"}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-gray-300 outline-none focus:border-blue-400 disabled:opacity-70"
          />

          {step !== "email" && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="OTP"
              value={otp}
              disabled={step === "password"}
              onChange={(event) => setOtp(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-gray-300 outline-none focus:border-blue-400 disabled:opacity-70"
            />
          )}

          {step === "password" && (
            <>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-gray-300 outline-none focus:border-blue-400"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/10 p-4 text-white placeholder-gray-300 outline-none focus:border-blue-400"
              />
            </>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={
              step === "email"
                ? handleSendOtp
                : step === "otp"
                ? handleVerifyOtp
                : handleResetPassword
            }
            className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-500"
          >
            {loading
              ? "Please wait..."
              : step === "email"
              ? "Send OTP"
              : step === "otp"
              ? "Verify OTP"
              : "Update Password"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-300">
          Remembered your password?
          <Link to="/" className="ml-2 font-semibold text-blue-400">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
