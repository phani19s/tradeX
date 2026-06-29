import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard"; 
import Portfolio from "./pages/Portfolio";
import Trade from "./pages/Trade";
import History from "./pages/History";
import Watchlist from "./pages/Watchlist";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import SessionTimeout from "./components/SessionTimeout";
import LoginHistory from "./pages/LoginHistory";
import ForgotPassword from "./pages/ForgotPassword";
import AiAssistant from "./pages/AiAssistant";
import Alerts from "./pages/Alerts";
import RiskDashboard from "./pages/RiskDashboard";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminAdminsPage from "./pages/AdminAdminsPage";
import AdminSupportPage from "./pages/AdminSupportPage";
import AdminTradingPage from "./pages/AdminTradingPage";
import AdminStocksPage from "./pages/AdminStocksPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminMarketPage from "./pages/AdminMarketPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import MaintenancePage from "./pages/MaintenancePage";
import MaintenanceGuard from "./components/MaintenanceGuard";
import Feedback from "./pages/Feedback";
import AdminFeedbackPage from "./pages/AdminFeedbackPage";

function App() {
  return (
    <BrowserRouter>
      <MaintenanceGuard />
      {/* Global Session Timeout Monitor (15 Minutes) */}
      <SessionTimeout timeoutMinutes={15} />

      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/portfolio"
          element={<Portfolio />}
       />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/trade"
          element={<Trade />}
        />

        <Route
          path="/history"
          element={<History />}
        />

        <Route
          path="/ai-assistant"
          element={<AiAssistant />}
        />

        <Route
          path="/alerts"
          element={<Alerts />}
        />

        <Route
          path="/risk-dashboard"
          element={<RiskDashboard />}
        />

        <Route
          path="/watchlist"
          element={<Watchlist />}
        />

        <Route
          path="/admin"
          element={<AdminPanel />}
        />

        <Route
          path="/admin/users"
          element={<AdminUsersPage />}
        />

        <Route
          path="/admin/administrators"
          element={<AdminAdminsPage />}
        />

        <Route
          path="/admin/trading"
          element={<AdminTradingPage />}
        />

        <Route
          path="/admin/support"
          element={<AdminSupportPage />}
        />

        <Route
          path="/admin/market"
          element={<AdminMarketPage />}
        />

        <Route
          path="/admin/stocks"
          element={<AdminStocksPage />}
        />

        <Route
          path="/admin/reports"
          element={<AdminReportsPage />}
        />

        <Route
          path="/admin/settings"
          element={<AdminSettingsPage />}
        />

        <Route
          path="/admin/feedback"
          element={<AdminFeedbackPage />}
        />

        <Route
          path="/feedback"
          element={<Feedback />}
        />

        <Route
          path="/profile"
          element={<Profile />}
        />
        
        <Route
          path="/profile/tickets"
          element={<Tickets />}
        />
        
        <Route
          path="/profile/tickets/:id"
          element={<TicketDetail />}
        />
        
        <Route
          path="/profile/login-history"
          element={<LoginHistory />}
        />

        <Route
          path="/login-history"
          element={<LoginHistory />}
        />

        <Route
          path="/maintenance"
          element={<MaintenancePage />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;
