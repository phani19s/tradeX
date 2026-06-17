import { useState } from "react";
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
  
  const [showPassword,
    setShowPassword] =
      useState(false);

  const navigate =
    useNavigate();

  const handleLogin =
    async () => {

      setLoading(true);
      try {
        const response =
          await api.post(
            "/auth/login",
            {
              email,
              password,
            }
          );

        localStorage.setItem(
          "token",
          response.data.access_token
        );

        localStorage.setItem(
          "user",
          JSON.stringify(response.data.user)
        );

        setLoading(false);

        toast.success(
          "Login Successful"
        );

        navigate("/dashboard");

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
  overflow-hidden
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

    {/* Login Card */}

    <div
  className="
  relative
  z-10
  overflow-hidden
  bg-slate-900/60
  backdrop-blur-md
  border
  border-blue-400/20
  shadow-[0_20px_60px_rgba(0,0,0,0.5)]
  rounded-3xl
  p-10
  w-[450px]
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

        {/* Login Button */}

        <button
          onClick={handleLogin}
          disabled={loading}
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

);
}

export default Login;
