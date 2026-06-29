import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [details, setDetails] = useState({
    title: "System Under Maintenance",
    message: "We are currently performing scheduled maintenance. Please check back later.",
    eta: "Shortly"
  });
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    setChecking(true);
    try {
      const res = await api.get("/auth/maintenance-status");
      setDetails({
        title: res.data.title,
        message: res.data.message,
        eta: res.data.eta
      });
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (res.data.maintenance_mode !== "true") {
        navigate(user ? "/dashboard" : "/");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkStatus();
    // Poll every 10 seconds to auto-redirect if mode gets disabled
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="max-w-md w-full text-center space-y-8 relative z-10">
        {/* Animated Construction/Gear Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-xl animate-pulse">
              <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-[#0f172a] shadow-md">
              !
            </div>
          </div>
        </div>

        {/* Text Section */}
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
            {details.title}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            {details.message}
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
            <span className="text-slate-400">Estimated Duration:</span>
            <span className="font-semibold text-emerald-400">{details.eta}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Trading Status:</span>
            <span className="font-semibold text-rose-400">Paused</span>
          </div>
        </div>

        {/* Manual Refresh Button */}
        <div>
          <button
            onClick={checkStatus}
            disabled={checking}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-[#0f172a] font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition duration-150 cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {checking ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#0f172a]"></div>
                Checking Status...
              </>
            ) : (
              "Check Status Again"
            )}
          </button>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-slate-500">
          Administrator bypass is active. Thank you for your patience.
        </p>
      </div>
    </div>
  );
}
