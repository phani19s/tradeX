import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StockManagement from "../components/StockManagement";

function AdminStocksPage() {
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
          <h1 className="text-4xl font-bold">Stock Management</h1>
          <p className="mt-2 opacity-70">
            Manage the stock catalog, add new assets, edit company descriptions, configure enabled trading statuses, and execute manual price overrides.
          </p>
        </div>

        <StockManagement />
      </div>
    </div>
  );
}

export default AdminStocksPage;
