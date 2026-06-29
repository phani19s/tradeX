import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import { useTheme } from "../context/ThemeContext";

function Feedback() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { accentColor } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      navigate("/");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/feedback", {
        subject: subject.trim(),
        message: message.trim(),
      }, getAuthHeaders());
      
      setSubmitted(true);
      toast.success("Feedback submitted successfully!");
    } catch (error) {
      console.error("Failed to submit feedback", error);
      toast.error(error.response?.data?.detail || "Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main px-4 py-8 md:px-6">
        <div className="mx-auto max-w-2xl">
          
          {submitted ? (
            <div 
              className="rounded-[28px] border p-8 shadow-xl text-center space-y-6" 
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 text-3xl font-bold">
                ✓
              </div>
              <h2 className="text-3xl font-black">Thank You!</h2>
              <p className="text-lg leading-relaxed opacity-90">
                Thank you for sharing your feedback. We appreciate your valuable suggestions!
              </p>
              <div className="pt-4">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="rounded-2xl px-6 py-3 font-bold text-white transition hover:opacity-90 shadow-md"
                  style={{ background: accentColor || "var(--accent)" }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="rounded-[28px] border p-8 shadow-xl space-y-6" 
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">Help Us Improve</p>
                <h1 className="mt-2 text-4xl font-black">Submit Feedback</h1>
                <p className="mt-2 text-sm leading-6 opacity-75">
                  Your feedback helps us make TradeX better. Share your thoughts, suggestions, or report user experience issues.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold opacity-85">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of your feedback"
                    required
                    maxLength={100}
                    className="w-full rounded-2xl border px-4 py-3 outline-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold opacity-85">Feedback Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think or how we can improve..."
                    required
                    rows={6}
                    maxLength={1000}
                    className="w-full rounded-2xl border px-4 py-3 outline-none resize-none"
                    style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl py-3.5 font-bold text-white transition hover:opacity-90 disabled:opacity-50 shadow-md"
                    style={{ background: accentColor || "var(--accent)" }}
                  >
                    {loading ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Feedback;
