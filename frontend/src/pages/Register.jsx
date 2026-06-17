import { useState } from "react";
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

  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);

  const [otpVerified, setOtpVerified] = useState(false);

  const navigate = useNavigate();

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
          email
        }
      );

      toast.success("OTP Sent Successfully");

      setOtpSent(true);
      setOtp("");

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
          email
        }
      );

      toast.success("OTP resent successfully");
      setOtp("");
      setOtpVerified(false);
      setOtpSent(true);
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
        "Failed to resend OTP"
      );
    }
  };

  const verifyOTP = async () => {

    try {

      await api.post(
        "/auth/verify-otp",
        {
          email,
          otp
        }
      );

      toast.success("OTP Verified Successfully");

      setOtpVerified(true);

    } catch (error) {

      toast.error(
        error.response?.data?.detail ||
        "Invalid OTP"
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
          password
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
          Create Your Trading Account
        </p>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100">
          {/* <p className="mb-2 font-semibold text-white">Workflow</p> */}
          <ol className="space-y-1">
            <li>1. Enter your details.</li>
            <li>2. Send or resend OTP to your email.</li>
            <li>3. Verify OTP, then create the account.</li>
          </ol>
        </div>

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

        {otpSent && !otpVerified && (

          <>

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
              mb-4
              outline-none
              focus:border-green-400
            "
            />

            <button
              onClick={verifyOTP}
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

            <button
              type="button"
              onClick={resendOTP}
              className="
              mt-3
              w-full
              rounded-xl
              border
              border-white/20
              px-4
              py-3
              text-white
              transition
              hover:bg-white/10
            "
            >
              Resend OTP
            </button>

          </>

        )}

        {otpVerified && (

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

);
}

export default Register;
