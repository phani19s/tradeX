import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";

export default function MaintenanceGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function checkMaintenance() {
      // Exclude public auth pages and admin pages from maintenance redirection
      if (
        location.pathname === "/" ||
        location.pathname === "/register" ||
        location.pathname === "/forgot-password" ||
        location.pathname.startsWith("/admin")
      ) {
        return;
      }
      
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (user?.is_admin) {
        return; // Admins bypass maintenance mode
      }

      try {
        const res = await api.get("/auth/maintenance-status");
        if (res.data.maintenance_mode === "true") {
          if (location.pathname !== "/maintenance") {
            navigate("/maintenance");
          }
        } else {
          // If maintenance mode is OFF, and we are on the maintenance page, redirect to dashboard or login
          if (location.pathname === "/maintenance") {
            navigate(user ? "/dashboard" : "/");
          }
        }
      } catch (error) {
        console.error("Failed to check maintenance status:", error);
      }
    }

    checkMaintenance();
    
    // Poll every 10 seconds to check if maintenance mode changes
    const timer = setInterval(checkMaintenance, 10000);
    return () => clearInterval(timer);
  }, [location.pathname, navigate]);

  return null;
}
