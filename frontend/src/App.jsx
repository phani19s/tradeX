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

function App() {
  return (
    <BrowserRouter>
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
          path="/watchlist"
          element={<Watchlist />}
        />

        <Route
          path="/admin"
          element={<AdminPanel />}
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
        
      </Routes>

    </BrowserRouter>
  );
}

export default App;
