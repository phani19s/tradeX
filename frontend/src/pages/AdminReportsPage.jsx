import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Reports from "../components/Reports";

function AdminReportsPage() {
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
          <h1 className="text-4xl font-bold">System Reports</h1>
          <p className="mt-2 opacity-70">
            Generate, preview, and export daily, weekly, monthly, or custom period system audits. Review all historical generated reports from the audit database.
          </p>
        </div>

        <Reports />
      </div>
    </div>
  );
}

export default AdminReportsPage;
