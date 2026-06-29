import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import UserManagement from "../components/UserManagement";

function AdminUsersPage() {
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
          <h1 className="text-4xl font-bold">User Management</h1>
          <p className="mt-2 opacity-70">
            Securely review user records, manage bank settings, view login histories, force logouts, and handle password resets.
          </p>
        </div>

        <UserManagement />
      </div>
    </div>
  );
}

export default AdminUsersPage;
