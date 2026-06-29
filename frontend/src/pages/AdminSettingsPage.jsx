import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import SystemSettings from "../components/SystemSettings";

function AdminSettingsPage() {
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
          <h1 className="text-4xl font-bold">System Settings</h1>
          <p className="mt-2 opacity-70">
            Configure application-wide parameters including trading hours, limits, API keys, SMTP credentials, and maintenance mode status.
          </p>
        </div>

        <SystemSettings />
      </div>
    </div>
  );
}

export default AdminSettingsPage;
