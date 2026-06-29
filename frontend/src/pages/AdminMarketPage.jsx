import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import MarketOverview from "../components/MarketOverview";

function AdminMarketPage() {
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
          <h1 className="text-4xl font-bold">Market Overview Dashboard</h1>
          <p className="mt-2 opacity-70">
            Real-time analytics on trading metrics, volume flow distributions, asset P&L metrics, and top gainer/loser trends.
          </p>
        </div>

        <MarketOverview />
      </div>
    </div>
  );
}

export default AdminMarketPage;
