import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

export default function TraderHolidaysPage() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUpcomingHolidays();
  }, []);

  const fetchUpcomingHolidays = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/holidays/upcoming", getAuthHeaders());
      setHolidays(res.data || []);
    } catch (error) {
      toast.error("Failed to load upcoming market holidays");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main p-5 max-w-4xl mx-auto space-y-6">
        
        {/* Header Hero Card */}
        <div className="theme-card rounded-2xl p-6 shadow border" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            📅 Upcoming Market Holidays
          </h1>
          <p className="mt-2 opacity-70 leading-relaxed">
            Stay informed about scheduled market closures and special Muhurat Trading sessions. Order placements are disabled on Closed status days.
          </p>
        </div>

        {/* Informative Banner / Alert */}
        {holidays.some(h => h.market_status === "Muhurat Trading") && (
          <div className="border border-amber-500/20 bg-amber-500/10 rounded-2xl p-4 flex gap-3 text-amber-500 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-xl">🪔</span>
            <div>
              <h4 className="font-bold text-sm">Special Muhurat Trading Scheduled</h4>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                Muhurat trading is a special, auspicious session conducted on Diwali. Standard buying/selling will only be permitted during the configured hours shown below.
              </p>
            </div>
          </div>
        )}

        {/* Holidays List */}
        <div className="theme-card rounded-2xl p-6 shadow border space-y-4" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
          {loading ? (
            <div className="py-16 flex flex-col justify-center items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
              <span className="font-semibold text-sm opacity-70">Fetching market calendar...</span>
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-16 text-center opacity-65 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
              No upcoming market holidays found. Trading is fully open!
            </div>
          ) : (
            <div className="grid gap-4">
              {holidays.map((h) => (
                <div 
                  key={h.id} 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl border bg-black/5 hover:bg-black/10 transition gap-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold opacity-60 uppercase tracking-wider">{h.holiday_type}</span>
                    <h3 className="text-xl font-bold">{h.name}</h3>
                    {h.description && <p className="text-xs opacity-75 max-w-xl">{h.description}</p>}
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end gap-3 sm:gap-1 whitespace-nowrap">
                    {/* Date */}
                    <div className="font-mono text-sm font-bold">
                      {new Date(h.date).toLocaleDateString("en-IN", {
                        weekday: "short", year: "numeric", month: "short", day: "numeric"
                      })}
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      h.market_status === 'Closed'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : h.market_status === 'Open'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {h.market_status === "Muhurat Trading" 
                        ? `Muhurat: ${h.start_time} - ${h.end_time}` 
                        : h.market_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
