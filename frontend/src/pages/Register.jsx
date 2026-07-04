import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/api";

import {
  toast
} from "react-toastify";

import tradingBg from "../assets/trading-bg.jpg";

function Register() {

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Trader");

  const [otp, setOtp] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [otpSent, setOtpSent] = useState(false);

  const [otpVerified, setOtpVerified] = useState(false);
  const [adminOtpVerified, setAdminOtpVerified] = useState(false);

  const navigate = useNavigate();
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

  const sendOTP = async () => {

    try {
      const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (
          !emailRegex.test(email)
        ) {
        
          toast.error(
            "Please enter a valid email address"
          );
        
          return;
        }

      await api.post(
        "/auth/send-otp",
        {
          email,
          role
        }
      );

      toast.success(
        role === "Administrator"
          ? "OTPs Sent to your email and Admin email"
          : "OTP Sent Successfully"
      );

      setOtpSent(true);
      setOtp("");
      setAdminOtp("");
      setOtpVerified(false);
      setAdminOtpVerified(false);

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
        "Failed to send OTP"
      );

    }
  };

  const resendOTP = async () => {

    try {
      await api.post(
        "/auth/send-otp",
        {
          email,
          role
        }
      );

      toast.success(
        role === "Administrator"
          ? "OTPs resent to your email and Admin email"
          : "OTP resent successfully"
      );
      setOtp("");
      setAdminOtp("");
      setOtpVerified(false);
      setAdminOtpVerified(false);
      setOtpSent(true);
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
        "Failed to resend OTP"
      );
    }
  };

  const verifyUserOTP = async () => {

    try {

      await api.post(
        "/auth/verify-otp",
        {
          email,
          otp
        }
      );

      toast.success("User OTP Verified Successfully");

      setOtpVerified(true);

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
        "Invalid User OTP"
      );

    }
  };

  const verifyAdminOTP = async () => {

    try {

      await api.post(
        "/auth/verify-otp",
        {
          email,
          otp: adminOtp,
          is_admin_otp: true
        }
      );

      toast.success("Admin OTP Verified Successfully");

      setAdminOtpVerified(true);

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
        "Invalid Admin OTP"
      );

    }
  };

  const handleRegister = async () => {

    try {

      await api.post(
        "/auth/register",
        {
          username,
          email,
          password,
          role
        }
      );

      toast.success("Registration Successful");

      navigate("/");

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
        "Registration Failed"
      );

    }
  };

return (

 <div
  className="
  min-h-screen
  flex
  items-center
  justify-center
  relative
  overflow-y-auto
  overflow-x-hidden
  py-10
  lg:py-0
  "
  style={{
    backgroundImage: `url(${tradingBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center"
  }}
>
    <div className="absolute inset-0 bg-slate-950/80"></div>

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

    <div className="flex justify-center z-10 max-w-full px-4 flex-col lg:flex-row gap-8 xl:gap-12 items-stretch">
      {hasBanners && banners[currentIndex] ? (
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
      ) : (
        <div className="w-[450px] max-w-full shrink-0 hidden lg:block" />
      )}

      {/* Register Card */}

      <div
        className="
        relative
        overflow-hidden
        shrink-0
        bg-slate-900/60
        backdrop-blur-md
        border
        border-blue-400/20
        shadow-[0_20px_60px_rgba(0,0,0,0.5)]
        rounded-3xl
        p-10
        w-[450px]
        max-w-full
        flex
        flex-col
        justify-center
      "
>

      {/* Glow Effects */}

      <div
        className="
        absolute
        -top-10
        -right-10
        w-40
        h-40
        bg-blue-500/30
        rounded-full
        blur-3xl
        animate-pulse
      "
      ></div>

      <div
        className="
        absolute
        -bottom-10
        -left-10
        w-40
        h-40
        bg-purple-500/30
        rounded-full
        blur-3xl
        animate-pulse
      "
      ></div>

      <div className="relative z-10">

        <h1 className="text-5xl font-extrabold text-center mb-2 text-white">
          TradeX
        </h1>

        <p className="text-center text-blue-200 mb-8">
          Create Your Trading Account
        </p>


        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
          className="
          w-full
          bg-white/10
          border
          border-white/20
          text-white
          placeholder-gray-300
          p-4
          rounded-xl
          mb-4
          outline-none
          focus:border-blue-400
        "
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="
          w-full
          bg-white/10
          border
          border-white/20
          text-white
          placeholder-gray-300
          p-4
          rounded-xl
          mb-4
          outline-none
          focus:border-blue-400
        "
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="
          w-full
          bg-white/10
          border
          border-white/20
          text-white
          placeholder-gray-300
          p-4
          rounded-xl
          mb-4
          outline-none
          focus:border-blue-400
        "
        />

        <label className="block text-sm font-semibold text-blue-200 mb-2">
          Select Role
        </label>
        <div className="flex gap-4 mb-4">
          <button
            type="button"
            onClick={() => {
              setRole("Trader");
              setOtpSent(false);
              setOtpVerified(false);
              setAdminOtpVerified(false);
              setOtp("");
              setAdminOtp("");
            }}
            className={`
              flex-1
              p-4
              rounded-xl
              border
              transition-all
              font-semibold
              ${role === "Trader"
                ? "bg-blue-600/30 border-blue-400 text-white shadow-[0_0_15px_rgba(96,165,250,0.3)]"
                : "bg-white/10 border-white/20 text-gray-300 hover:bg-white/20"
              }
            `}
          >
            Trader
          </button>
          <button
            type="button"
            onClick={() => {
              setRole("Administrator");
              setOtpSent(false);
              setOtpVerified(false);
              setAdminOtpVerified(false);
              setOtp("");
              setAdminOtp("");
            }}
            className={`
              flex-1
              p-4
              rounded-xl
              border
              transition-all
              font-semibold
              ${role === "Administrator"
                ? "bg-blue-600/30 border-blue-400 text-white shadow-[0_0_15px_rgba(96,165,250,0.3)]"
                : "bg-white/10 border-white/20 text-gray-300 hover:bg-white/20"
              }
            `}
          >
            Administrator
          </button>
        </div>

        {!otpSent && (

          <button
            onClick={sendOTP}
            className="
            w-full
            bg-blue-600
            text-white
            p-4
            rounded-xl
            hover:bg-blue-700
          "
          >
            Send OTP
          </button>

        )}

        {otpSent && role === "Trader" && (
          <>
            {!otpVerified ? (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value)
                    }
                    className="
                    w-full
                    bg-white/10
                    border
                    border-white/20
                    text-white
                    placeholder-gray-300
                    p-4
                    rounded-xl
                    mt-4
                    outline-none
                    focus:border-green-400
                  "
                  />
                  <div className="text-right mt-1 mb-4">
                    <button
                      type="button"
                      onClick={resendOTP}
                      className="text-xs text-blue-400 hover:text-blue-300 transition focus:outline-none bg-transparent border-0 cursor-pointer"
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>

                <button
                  onClick={verifyUserOTP}
                  className="
                  w-full
                  bg-green-600
                  text-white
                  p-4
                  rounded-xl
                  hover:bg-green-700
                "
                >
                  Verify OTP
                </button>
              </>
            ) : (
              <>
                <div className="text-green-400 text-center font-bold mt-4 mb-4">
                  OTP Verified Successfully
                </div>

                <button
                  onClick={handleRegister}
                  className="
                  w-full
                  bg-purple-600
                  text-white
                  p-4
                  rounded-xl
                  hover:bg-purple-700
                "
                >
                  Create Account
                </button>
              </>
            )}
          </>
        )}

        {otpSent && role === "Administrator" && (
          <>
            {/* User OTP Section */}
            <div className="mt-4 mb-4 p-4 rounded-xl border border-white/10 bg-white/5">
              <label className="block text-sm font-semibold text-blue-200 mb-2">
                User OTP (Sent to your email)
              </label>
              {otpVerified ? (
                <div className="text-green-400 font-bold py-2 flex items-center gap-2">
                  ✓ User OTP Verified
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter User OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="
                      w-full
                      bg-white/10
                      border
                      border-white/20
                      text-white
                      placeholder-gray-300
                      p-3
                      rounded-xl
                      outline-none
                      focus:border-green-400
                    "
                    />
                    <div className="text-right mt-1">
                      <button
                        type="button"
                        onClick={resendOTP}
                        className="text-xs text-blue-400 hover:text-blue-300 transition focus:outline-none bg-transparent border-0 cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={verifyUserOTP}
                    className="
                    w-full
                    bg-green-600
                    text-white
                    p-3
                    rounded-xl
                    hover:bg-green-700
                    text-sm
                    font-semibold
                  "
                  >
                    Verify User OTP
                  </button>
                </div>
              )}
            </div>

            {/* Admin OTP Section */}
            <div className="mb-4 p-4 rounded-xl border border-white/10 bg-white/5">
              <label className="block text-sm font-semibold text-blue-200 mb-2">
                Admin OTP (Sent to tradex.adminn@gmail.com)
              </label>
              {adminOtpVerified ? (
                <div className="text-green-400 font-bold py-2 flex items-center gap-2">
                  ✓ Admin OTP Verified
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter Admin OTP"
                      value={adminOtp}
                      onChange={(e) => setAdminOtp(e.target.value)}
                      className="
                      w-full
                      bg-white/10
                      border
                      border-white/20
                      text-white
                      placeholder-gray-300
                      p-3
                      rounded-xl
                      outline-none
                      focus:border-green-400
                    "
                    />
                    <div className="text-right mt-1">
                      <button
                        type="button"
                        onClick={resendOTP}
                        className="text-xs text-blue-400 hover:text-blue-300 transition focus:outline-none bg-transparent border-0 cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={verifyAdminOTP}
                    className="
                    w-full
                    bg-green-600
                    text-white
                    p-3
                    rounded-xl
                    hover:bg-green-700
                    text-sm
                    font-semibold
                  "
                  >
                    Verify Admin OTP
                  </button>
                </div>
              )}
            </div>

            {/* Register Button */}
            {otpVerified && adminOtpVerified && (
              <>
                <div className="text-green-400 text-center font-bold mb-4">
                  Both OTPs Verified Successfully
                </div>
                <button
                  onClick={handleRegister}
                  className="
                  w-full
                  bg-purple-600
                  text-white
                  p-4
                  rounded-xl
                  hover:bg-purple-700
                  font-bold
                "
                >
                  Create Account
                </button>
              </>
            )}
          </>
        )}



        <p className="mt-6 text-center text-gray-300">

          Already have an account?

          <Link
            to="/"
            className="
            text-blue-400
            font-semibold
            ml-2
          "
          >
            Login
          </Link>

        </p>

      </div>

    </div>

  </div>

</div>

);
}

export default Register;
