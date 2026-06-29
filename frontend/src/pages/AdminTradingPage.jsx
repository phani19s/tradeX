import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import TradingMonitor from "../components/TradingMonitor";

function AdminTradingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5">
        <div className="theme-card rounded-2xl p-6 shadow mb-6">
          <h1 className="text-4xl font-bold">Trading Management</h1>
          <p className="mt-2 opacity-70">
            Monitor real-time trades, search and filter transactions, and inspect complete execution audit receipts.
          </p>
        </div>

        <TradingMonitor />
      </div>
    </div>
  );
}

export default AdminTradingPage;
