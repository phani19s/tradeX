import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AdminManagement from "../components/AdminManagement";

function AdminAdminsPage() {
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
          <h1 className="text-4xl font-bold">Administrator Management</h1>
          <p className="mt-2 opacity-70">
            Create new administrators using dual-OTP verification, manage permissions, toggle account status, and view detailed audit action logs.
          </p>
        </div>

        <AdminManagement />
      </div>
    </div>
  );
}

export default AdminAdminsPage;
