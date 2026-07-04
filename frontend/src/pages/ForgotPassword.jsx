import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import api from "../api/api";
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

  // Load cached banners immediately on mount to prevent layout shift and reload flicker
  const getCachedBanners = () => {
    try {
      const cached = localStorage.getItem("tradex_active_banners");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  };

  const getSavedIndex = (listLen) => {
    try {
      const idx = sessionStorage.getItem("tradex_active_banner_index");
      const parsed = idx ? parseInt(idx, 10) : 0;
      return parsed >= 0 && parsed < listLen ? parsed : 0;
    } catch {
      return 0;
    }
  };

  const initialBanners = getCachedBanners();
  const [banners, setBanners] = useState(initialBanners);
  const [currentIndex, setCurrentIndex] = useState(getSavedIndex(initialBanners.length));
  const [hasBanners, setHasBanners] = useState(initialBanners.length > 0);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await api.get("/admin/banners/active");
        const list = res.data || [];
        localStorage.setItem("tradex_active_banners", JSON.stringify(list));
        setBanners(list);
        setHasBanners(list.length > 0);
      } catch (error) {
        console.error("Failed to load active banners:", error);
      }
    };
    fetchBanners();
  }, []);

  // Sync index to sessionStorage when it changes
  useEffect(() => {
    sessionStorage.setItem("tradex_active_banner_index", currentIndex);
  }, [currentIndex]);

  // Auto-play slideshow
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Change slide every 5 seconds
    return () => clearInterval(interval);
  }, [banners]);

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
      className="min-h-screen flex items-center justify-center relative overflow-y-auto py-10 lg:py-0 px-4"
      style={{
        backgroundImage: `url(${tradingBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/80" />

      {/* Animated Trading Chart Background */}
      <svg
        className="
        chart-bg
        absolute
        inset-0
        w-full
        h-full
        opacity-10
        "
        viewBox="0 0 1000 600"
      >
        <path
          d="
            M0 500
            L100 450
            L200 470
            L300 350
            L400 380
            L500 250
            L600 300
            L700 180
            L800 220
            L900 120
            L1000 80
          "
          fill="none"
          stroke="#60a5fa"
          strokeWidth="6"
        />
      </svg>

      <div className={`flex justify-center z-10 max-w-full px-4 ${
        hasBanners ? "flex-col lg:flex-row gap-8 xl:gap-12 items-stretch" : "flex-col items-center gap-4"
      }`}>
        {hasBanners && banners[currentIndex] && (
          <div 
            key={currentIndex}
            className="w-[450px] max-w-full shrink-0 animate-in fade-in slide-in-from-bottom-3 duration-500 flex flex-col justify-center p-6 text-white"
          >
            <span className={`inline-block text-[11px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full w-fit mb-6 backdrop-blur-sm border ${
              banners[currentIndex].banner_type === "Holiday"
                ? "bg-rose-500/20 text-rose-400 border-rose-500/35 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                : "bg-blue-500/20 text-blue-400 border-blue-500/35 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            }`}>
              ✨ {banners[currentIndex].banner_type}
            </span>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight mb-4 text-white">
              {banners[currentIndex].title}
            </h2>
            <p className="text-lg text-blue-100 opacity-90 leading-relaxed font-semibold">
              {banners[currentIndex].description}
            </p>

            {/* Dots Indicator */}
            {banners.length > 1 && (
              <div className="flex gap-1.5 mt-6 z-20">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex ? "bg-white scale-125" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative z-10 w-full max-w-md shrink-0 rounded-3xl border border-blue-400/20 bg-slate-900/70 p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-md">
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
    </div>
  );
}

export default ForgotPassword;
