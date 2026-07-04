import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/api";

import {
  toast
} from "react-toastify";

import tradingBg from "../assets/trading-bg.jpg";

function Login() {

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [requiresTwoFactor, setRequiresTwoFactor] =
    useState(false);

  const [twoFactorMethod, setTwoFactorMethod] =
    useState("");

  const [twoFactorOtp, setTwoFactorOtp] =
    useState("");
  
  const [showPassword,
    setShowPassword] =
      useState(false);

  const navigate =
    useNavigate();

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

  const getDeviceLocation = async () => {
    const cachedLocation = localStorage.getItem("tradex_device_location");
    if (cachedLocation) {
      return cachedLocation;
    }

    if (!navigator.geolocation) {
      return "";
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 5000,
        });
      });

      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      const data = await response.json();
      const location = [
        data.city || data.locality,
        data.principalSubdivision,
        data.countryName,
      ].filter(Boolean).join(", ");

      if (location) {
        localStorage.setItem("tradex_device_location", location);
      }

      return location;
    } catch {
      return "";
    }
  };

  const completeLogin = (data) => {
    localStorage.setItem(
      "token",
      data.access_token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    const now = Date.now().toString();
    localStorage.setItem(
      "tradex_stay_login_timestamp",
      now
    );
    localStorage.setItem(
      "tradex_last_activity",
      now
    );
    localStorage.setItem(
      "tradex_session_status",
      `stay_${now}`
    );

    toast.success(
      "Login Successful"
    );

    navigate("/dashboard");
  };

  const handleLogin =
    async () => {

      setLoading(true);
      try {
        const loginUrl =
          requiresTwoFactor
            ? "/auth/login/2fa"
            : "/auth/login";

        const payload =
          requiresTwoFactor
            ? {
                email,
                password,
                otp: twoFactorOtp,
              }
            : {
                email,
                password,
              };

        const response =
          await api.post(
            loginUrl,
            payload,
            {
              headers: {
                "X-TradeX-Location": await getDeviceLocation(),
              },
            }
          );

        if (response.data.requires_2fa) {
          setRequiresTwoFactor(true);
          setTwoFactorMethod(response.data.method);
          setTwoFactorOtp("");
          toast.info(
            response.data.method === "email"
              ? "Enter the OTP sent to your email"
              : "Enter your Google Authenticator code"
          );
          return;
        }

        completeLogin(response.data);

      } catch (error) {
        const message =
          error?.response?.data?.detail ||
          (error?.response
            ? "Invalid email or password"
            : "Backend is not reachable right now");

        toast.error(message);

      } finally {

        setLoading(false);

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

      {/* Login Card */}

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
            Smart Trading Simulator
          </p>

          {/* Email */}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
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

          {/* Password */}

          <div className="relative mb-4">

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
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
              outline-none
              focus:border-blue-400
            "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              className="
              absolute
              right-4
              top-4
              text-gray-300
            "
            >
              {showPassword
                ? "🙈"
                : "👁️"}
            </button>

          </div>

          <div className="mb-4 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-blue-300 hover:text-blue-200"
            >
              Forgot password?
            </Link>
          </div>

          {requiresTwoFactor && (
            <div className="mb-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder={
                  twoFactorMethod === "email"
                    ? "Email OTP"
                    : "Google Authenticator Code"
                }
                value={twoFactorOtp}
                onChange={(e) =>
                  setTwoFactorOtp(
                    e.target.value
                  )
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
                outline-none
                focus:border-blue-400
              "
              />
              <p className="mt-2 text-sm text-blue-200">
                {twoFactorMethod === "email"
                  ? "A one-time code was sent to your email."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
            </div>
          )}

          {/* Login Button */}

          <button
            onClick={handleLogin}
            disabled={loading || (requiresTwoFactor && !twoFactorOtp.trim())}
            className="
            w-full
            bg-blue-600
            text-white
            p-4
            rounded-xl
            hover:bg-blue-700
            disabled:bg-gray-500
          "
          >
            {
              loading
                ? "Logging In..."
                : requiresTwoFactor
                  ? "Verify & Login"
                  : "Login"
            }
          </button>

          {/* Register Link */}

          <p className="mt-6 text-center text-gray-300">

            Don't have an account?

            <Link
              to="/register"
              className="
              text-blue-400
              font-semibold
              ml-2
            "
            >
              Register
            </Link>

          </p>

        </div>

      </div>
    </div>

  </div>

);
}

export default Login;
