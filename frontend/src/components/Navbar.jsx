import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import ThemeModal from "./ThemeModal";
import { useTheme } from "../context/ThemeContext";

function Navbar() {
  const location = useLocation();
  const [showTheme, setShowTheme] = useState(false);
  const { accentColor } = useTheme();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const linkStyle = (path) => {
    return location.pathname === path
      ? {
          className: "px-4 py-2 rounded font-semibold text-white",
          style: { backgroundColor: accentColor },
        }
      : {
          className: "transition hover:opacity-80",
          style: {},
        };
  };

  return (
    <div
      className="border-b"
      style={{ background: "var(--card)", color: "var(--text)", borderColor: "var(--border)" }}
    >
      <div className="relative mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        <Link to="/dashboard" {...linkStyle("/dashboard")}>
          Dashboard
        </Link>

        <Link to="/portfolio" {...linkStyle("/portfolio")}>
          Portfolio
        </Link>

        <Link to="/watchlist" {...linkStyle("/watchlist")}>
          Watchlist
        </Link>

        <Link to="/trade" {...linkStyle("/trade")}>
          Trade
        </Link>

        <Link to="/history" {...linkStyle("/history")}>
          History
        </Link>

        <Link to="/profile" {...linkStyle("/profile")}>
          Profile
        </Link>

        {currentUser?.is_admin && (
          <Link to="/admin" {...linkStyle("/admin")}>
            Admin
          </Link>
        )}

        <button
          onClick={logout}
          className="ml-auto rounded bg-red-500 px-4 py-2 hover:bg-red-600"
        >
          Logout
        </button>

        <button
          onClick={() => setShowTheme(true)}
          className="rounded-lg px-4 py-2 text-white transition hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          Theme
        </button>

        <ThemeModal isOpen={showTheme} onClose={() => setShowTheme(false)} />
      </div>
    </div>
  );
}

export default Navbar;
