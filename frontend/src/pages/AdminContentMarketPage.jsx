import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";
import ConfirmDialog from "../components/ConfirmDialog";
import { useTheme } from "../context/ThemeContext";

export default function AdminContentMarketPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("banners"); // "banners" or "holidays"
  const { resolvedThemeClass, backgroundImage, updateAppBackground, loginBackgroundImage, updateLoginBackground } = useTheme();
  const isLightTheme = resolvedThemeClass !== "theme-dark";

  const getFullImageUrl = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `${api.defaults.baseURL}${url}`;
  };

  // ----------------------------------------
  // BANNERS STATE
  // ----------------------------------------
  const [banners, setBanners] = useState([]);
  const [loadingBanners, setLoadingBanners] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  
  // Banner Form states
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerFormData, setBannerFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    button_text: "",
    button_url: "",
    banner_type: "Announcement",
    start_date: "",
    end_date: "",
    priority: 0,
    is_active: true
  });
  
  const [showBannerPreview, setShowBannerPreview] = useState(false);
  const [bannerPreviewData, setBannerPreviewData] = useState(null);
  const [deleteBannerId, setDeleteBannerId] = useState(null);

  // ----------------------------------------
  // HOLIDAYS STATE
  // ----------------------------------------
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  
  // Holiday filters
  const [holidaySearch, setHolidaySearch] = useState("");
  const [selectedHolidayYear, setSelectedHolidayYear] = useState(new Date().getFullYear());
  const holidayYearOptions = [2024, 2025, 2026, 2027, 2028];

  // Holiday Form states
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayPreview, setHolidayPreview] = useState(null);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayFormData, setHolidayFormData] = useState({
    name: "",
    date: "",
    holiday_type: "National Holiday",
    market_status: "Closed",
    start_time: "17:30",
    end_time: "18:30",
    description: "",
    image_url: "",
    is_active: true
  });
  
  const [deleteHolidayId, setDeleteHolidayId] = useState(null);

  // Background state variables
  const [bgInputUrl, setBgInputUrl] = useState("");
  const [loginBgInputUrl, setLoginBgInputUrl] = useState("");
  const [savingBg, setSavingBg] = useState(false);

  useEffect(() => {
    if (backgroundImage) {
      setBgInputUrl(backgroundImage);
    }
  }, [backgroundImage]);

  useEffect(() => {
    if (loginBackgroundImage) {
      setLoginBgInputUrl(loginBackgroundImage);
    }
  }, [loginBackgroundImage]);

  // ----------------------------------------
  // ACTIONS & FETCHERS
  // ----------------------------------------
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
      return;
    }
    
    if (activeTab === "banners") {
      fetchBanners();
    } else if (activeTab === "holidays") {
      fetchHolidays();
    }
  }, [navigate, activeTab, selectedHolidayYear]);

  // Debounced search for holidays
  useEffect(() => {
    if (activeTab !== "holidays") return;
    const delayDebounce = setTimeout(() => {
      fetchHolidays();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [holidaySearch]);

  const fetchBanners = async () => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!token || !user?.is_admin) return;

    try {
      setLoadingBanners(true);
      const res = await api.get("/admin/banners", getAuthHeaders());
      setBanners(res.data || []);
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error(error.response?.data?.detail || "Failed to load banners");
      }
    } finally {
      setLoadingBanners(false);
    }
  };

  const fetchHolidays = async () => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!token || !user?.is_admin) return;

    try {
      setLoadingHolidays(true);
      const params = {};
      if (holidaySearch) params.search = holidaySearch;
      if (selectedHolidayYear) params.year = selectedHolidayYear;

      const res = await api.get("/admin/holidays", {
        ...getAuthHeaders(),
        params
      });
      setHolidays(res.data || []);
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error("Failed to load market holidays");
      }
    } finally {
      setLoadingHolidays(false);
    }
  };

  // --- Banner Actions ---
  const handleOpenAddBanner = () => {
    setEditingBanner(null);
    setBannerFormData({
      title: "",
      description: "",
      image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=60",
      button_text: "",
      button_url: "",
      banner_type: "Announcement",
      start_date: new Date().toISOString().split("T")[0] + "T09:00",
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + "T18:00",
      priority: 0,
      is_active: true
    });
    setShowBannerModal(true);
  };

  const handleOpenEditBanner = (b) => {
    setEditingBanner(b);
    setBannerFormData({
      title: b.title,
      description: b.description,
      image_url: b.image_url,
      button_text: b.button_text || "",
      button_url: b.button_url || "",
      banner_type: b.banner_type,
      start_date: b.start_date.substring(0, 16),
      end_date: b.end_date.substring(0, 16),
      priority: b.priority,
      is_active: b.is_active
    });
    setShowBannerModal(true);
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!bannerFormData.title || !bannerFormData.description || !bannerFormData.image_url) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setSavingBanner(true);
      const payload = {
        ...bannerFormData,
        start_date: new Date(bannerFormData.start_date).toISOString(),
        end_date: new Date(bannerFormData.end_date).toISOString(),
        priority: Number(bannerFormData.priority)
      };

      if (editingBanner) {
        await api.put(`/admin/banners/${editingBanner.id}`, payload, getAuthHeaders());
        toast.success("Banner updated successfully");
      } else {
        await api.post("/admin/banners", payload, getAuthHeaders());
        toast.success("Banner created successfully");
      }
      setShowBannerModal(false);
      fetchBanners();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save banner");
    } finally {
      setSavingBanner(false);
    }
  };

  const handleToggleBanner = async (id) => {
    try {
      await api.patch(`/admin/banners/${id}/toggle`, {}, getAuthHeaders());
      toast.success("Banner status updated");
      fetchBanners();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteBannerConfirm = async () => {
    if (!deleteBannerId) return;
    try {
      await api.delete(`/admin/banners/${deleteBannerId}`, getAuthHeaders());
      toast.success("Banner deleted successfully");
      fetchBanners();
    } catch (error) {
      toast.error("Failed to delete banner");
    } finally {
      setDeleteBannerId(null);
    }
  };

  // --- Holiday Actions ---
  const handleOpenAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayFormData({
      name: "",
      date: new Date().toISOString().split("T")[0],
      holiday_type: "National Holiday",
      market_status: "Closed",
      start_time: "17:30",
      end_time: "18:30",
      description: "",
      image_url: "",
      is_active: true
    });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (h) => {
    setEditingHoliday(h);
    setHolidayFormData({
      name: h.name,
      date: h.date.split("T")[0],
      holiday_type: h.holiday_type,
      market_status: h.market_status,
      start_time: h.start_time || "17:30",
      end_time: h.end_time || "18:30",
      description: h.description || "",
      image_url: h.image_url || "",
      is_active: h.is_active
    });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holidayFormData.name || !holidayFormData.date) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setSavingHoliday(true);
      const payload = {
        ...holidayFormData,
        date: new Date(holidayFormData.date).toISOString()
      };
      if (holidayFormData.market_status !== "Muhurat Trading") {
        payload.start_time = null;
        payload.end_time = null;
      }

      if (editingHoliday) {
        await api.put(`/admin/holidays/${editingHoliday.id}`, payload, getAuthHeaders());
        toast.success("Market Holiday updated successfully");
      } else {
        await api.post("/admin/holidays", payload, getAuthHeaders());
        toast.success("Market Holiday created successfully");
      }
      setShowHolidayModal(false);
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save holiday");
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleToggleHoliday = async (id) => {
    try {
      await api.patch(`/admin/holidays/${id}/toggle`, {}, getAuthHeaders());
      toast.success("Holiday status updated");
      fetchHolidays();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteHolidayConfirm = async () => {
    if (!deleteHolidayId) return;
    try {
      await api.delete(`/admin/holidays/${deleteHolidayId}`, getAuthHeaders());
      toast.success("Holiday deleted successfully");
      fetchHolidays();
    } catch (error) {
      toast.error("Failed to delete holiday");
    } finally {
      setDeleteHolidayId(null);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      const res = await api.post("/admin/upload", formData, {
        headers: {
          ...getAuthHeaders().headers,
          "Content-Type": "multipart/form-data"
        }
      });
      const url = res.data.image_url;
      if (type === "banner") {
        setBannerFormData((prev) => ({ ...prev, image_url: url }));
      } else if (type === "holiday") {
        setHolidayFormData((prev) => ({ ...prev, image_url: url }));
      }
      toast.success("Image uploaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveBackground = async (e) => {
    e.preventDefault();
    setSavingBg(true);
    try {
      await api.post("/admin/settings/background", { app_background_image: bgInputUrl }, getAuthHeaders());
      updateAppBackground(bgInputUrl);
      toast.success("Main background image updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to update background image.");
    } finally {
      setSavingBg(false);
    }
  };

  const handleClearBackground = async () => {
    setSavingBg(true);
    try {
      await api.post("/admin/settings/background", { app_background_image: "" }, getAuthHeaders());
      updateAppBackground("");
      setBgInputUrl("");
      toast.success("Background image cleared. Restored default theme background.");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to clear background image.");
    } finally {
      setSavingBg(false);
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      const res = await api.post("/admin/upload", formData, {
        headers: {
          ...getAuthHeaders().headers,
          "Content-Type": "multipart/form-data"
        }
      });
      const url = res.data.image_url;
      setBgInputUrl(url);
      toast.success("Background image uploaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveLoginBackground = async (e) => {
    e.preventDefault();
    setSavingBg(true);
    try {
      await api.post("/admin/settings/background", { login_background_image: loginBgInputUrl }, getAuthHeaders());
      updateLoginBackground(loginBgInputUrl);
      toast.success("Login background image updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to update login background image.");
    } finally {
      setSavingBg(false);
    }
  };

  const handleClearLoginBackground = async () => {
    setSavingBg(true);
    try {
      await api.post("/admin/settings/background", { login_background_image: "" }, getAuthHeaders());
      updateLoginBackground("");
      setLoginBgInputUrl("");
      toast.success("Login background image cleared. Restored default starting background.");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to clear login background image.");
    } finally {
      setSavingBg(false);
    }
  };

  const handleLoginBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      const res = await api.post("/admin/upload", formData, {
        headers: {
          ...getAuthHeaders().headers,
          "Content-Type": "multipart/form-data"
        }
      });
      const url = res.data.image_url;
      setLoginBgInputUrl(url);
      toast.success("Login background image uploaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="page-bg min-h-screen">
      <Navbar />

      <div className="theme-main p-5 max-w-7xl mx-auto space-y-6">
        
        {/* Header Title Card */}
        <div className="theme-card rounded-2xl p-6 shadow border" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold">
                📢 Market & Content
              </h1>
              <p className="mt-2 opacity-70">
                Configure promotional banners, event announcements, stock market closures, and custom trading schedules.
              </p>
            </div>
            <div>
              {activeTab === "banners" && (
                <button
                  onClick={handleOpenAddBanner}
                  className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold shadow hover:bg-accent/90 cursor-pointer transition flex items-center gap-1"
                  style={{ background: "var(--accent)" }}
                >
                  ➕ Add Banner
                </button>
              )}
              {activeTab === "holidays" && (
                <button
                  onClick={handleOpenAddHoliday}
                  className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold shadow hover:bg-accent/90 cursor-pointer transition flex items-center gap-1"
                  style={{ background: "var(--accent)" }}
                >
                  ➕ Add Holiday
                </button>
              )}
            </div>
          </div>

          {/* Combined Tabs */}
          <div className="flex border-b mt-6" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setActiveTab("banners")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer ${
                activeTab === "banners"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "banners" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Banner Management
            </button>
            <button
              onClick={() => setActiveTab("holidays")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer ${
                activeTab === "holidays"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "holidays" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Market Holidays
            </button>
            <button
              onClick={() => setActiveTab("background")}
              className={`px-6 py-2.5 font-bold text-sm transition border-b-2 cursor-pointer ${
                activeTab === "background"
                  ? "border-accent text-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "background" ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            >
              Application Background
            </button>
          </div>
        </div>

        {/* BANNERS TAB CONTAINER */}
        {activeTab === "banners" && (
          <div className="theme-card rounded-2xl p-6 shadow border animate-in fade-in duration-200" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <h2 className="text-2xl font-bold mb-4">Active & Scheduled Banners</h2>
            
            {loadingBanners ? (
              <div className="py-12 flex flex-col justify-center items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                <span className="font-semibold text-sm opacity-70">Loading banners...</span>
              </div>
            ) : banners.length === 0 ? (
              <div className="py-16 text-center opacity-65 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
                No banners generated. Click "Add Banner" to publish your first announcement.
              </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-black/5 border-b" style={{ borderColor: "var(--border)" }}>
                      <th className="py-3.5 px-4 font-bold">Image</th>
                      <th className="py-3.5 px-4 font-bold">Details</th>
                      <th className="py-3.5 px-4 font-bold">Type</th>
                      <th className="py-3.5 px-4 font-bold">Schedule</th>
                      <th className="py-3.5 px-4 font-bold">Priority</th>
                      <th className="py-3.5 px-4 font-bold">Status</th>
                      <th className="py-3.5 px-4 font-bold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: "var(--border)" }}>
                    {banners.map((b) => (
                      <tr key={b.id} className="hover:bg-black/5 transition animate-in fade-in duration-150">
                        <td className="py-3.5 px-4">
                          <img 
                            src={getFullImageUrl(b.image_url)} 
                            alt={b.title} 
                            className="w-16 h-12 object-cover rounded-lg border shadow-sm bg-black/10 shrink-0"
                            style={{ borderColor: "var(--border)" }}
                            onError={(e) => { e.target.src = "https://placehold.co/100x60?text=No+Image"; }}
                          />
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <div className="font-bold truncate">{b.title}</div>
                          {b.description && <div className="text-xs opacity-60 truncate">{b.description}</div>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border bg-black/5" style={{ borderColor: "var(--border)" }}>
                            {b.banner_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div>Start: {new Date(b.start_date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div>
                          <div className="opacity-60">End: {new Date(b.end_date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">{b.priority}</td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleBanner(b.id)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold border transition cursor-pointer ${
                              b.is_active 
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            }`}
                          >
                            {b.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => { setBannerPreviewData(b); setShowBannerPreview(true); }}
                            className="rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditBanner(b)}
                            className="rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteBannerId(b.id)}
                            className="rounded-lg border border-red-500/20 text-red-500 px-2.5 py-1 text-xs font-bold transition hover:bg-red-500/10 cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          )}
          </div>
        )}

        {/* HOLIDAYS TAB CONTAINER */}
        {activeTab === "holidays" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Filters panel */}
            <div className="theme-card rounded-2xl p-5 shadow border flex flex-col sm:flex-row gap-4 items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
              <div className="w-full sm:max-w-md">
                <input
                  type="text"
                  value={holidaySearch}
                  onChange={(e) => setHolidaySearch(e.target.value)}
                  placeholder="Search by holiday name or description..."
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />
              </div>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <label className="text-xs font-bold opacity-75 whitespace-nowrap">Filter Year</label>
                <select
                  value={selectedHolidayYear}
                  onChange={(e) => setSelectedHolidayYear(Number(e.target.value))}
                  className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {holidayYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List Table */}
            <div className="theme-card rounded-2xl p-6 shadow border" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
              {loadingHolidays ? (
                <div className="py-12 flex flex-col justify-center items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
                  <span className="font-semibold text-sm opacity-70">Loading holiday logs...</span>
                </div>
              ) : holidays.length === 0 ? (
                <div className="py-16 text-center opacity-65 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
                  No holidays registered for {selectedHolidayYear}. Click "Add Holiday" to register your first date.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-black/5 border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="py-3.5 px-4 font-bold">Holiday Name</th>
                        <th className="py-3.5 px-4 font-bold">Date</th>
                        <th className="py-3.5 px-4 font-bold">Type</th>
                        <th className="py-3.5 px-4 font-bold">Market Status</th>
                        <th className="py-3.5 px-4 font-bold">Trading Hours</th>
                        <th className="py-3.5 px-4 font-bold">Status</th>
                        <th className="py-3.5 px-4 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ divideColor: "var(--border)" }}>
                      {holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-black/5 transition animate-in fade-in duration-150">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm">{h.name}</div>
                            {h.description && <div className="text-xs opacity-60 truncate max-w-xs">{h.description}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            {new Date(h.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-black/5" style={{ borderColor: "var(--border)" }}>
                              {h.holiday_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              h.market_status === 'Closed'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : h.market_status === 'Open'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {h.market_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs">
                            {h.market_status === "Muhurat Trading" 
                              ? `${h.start_time} - ${h.end_time}` 
                              : "-"}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleHoliday(h.id)}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold border transition cursor-pointer ${
                                h.is_active 
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                              }`}
                            >
                              {h.is_active ? "Enabled" : "Disabled"}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setHolidayPreview(h)}
                              className="rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                              style={{ borderColor: "var(--border)" }}
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditHoliday(h)}
                              className="rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                              style={{ borderColor: "var(--border)" }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteHolidayId(h.id)}
                              className="rounded-lg border border-red-500/20 text-red-500 px-2.5 py-1 text-xs font-bold transition hover:bg-red-500/10 cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BACKGROUND TAB CONTAINER */}
        {activeTab === "background" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Main Application Background Form */}
            <div className="theme-card rounded-2xl p-6 shadow border space-y-6" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
              <div>
                <h2 className="text-xl font-bold">🖥️ Main Application Background</h2>
                <p className="text-xs opacity-70 mt-1">
                  Set the background image of the dashboard, trading, and portal pages globally.
                </p>
              </div>

              <form onSubmit={handleSaveBackground} className="space-y-4">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Background Image (URL or Local File)</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={bgInputUrl}
                      onChange={(e) => setBgInputUrl(e.target.value)}
                      className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      placeholder="e.g., https://images.unsplash.com/... or upload below"
                    />
                    <label 
                      className="rounded-xl border px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-black/5 cursor-pointer shrink-0 text-center"
                      style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                    >
                      {uploadingImage ? "Uploading..." : "📂 Choose File"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBgUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>

                {bgInputUrl && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold opacity-60 uppercase block">Background Image Preview</span>
                    <div className="relative rounded-2xl overflow-hidden border bg-black/10 h-40 max-w-md" style={{ borderColor: "var(--border)" }}>
                      <img 
                        src={getFullImageUrl(bgInputUrl)} 
                        alt="Background Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = "https://placehold.co/600x400?text=Invalid+Image+URL"; }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingBg}
                    className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold shadow hover:bg-accent/90 cursor-pointer transition disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {savingBg ? "Saving..." : "Save Background"}
                  </button>
                  {backgroundImage && (
                    <button
                      type="button"
                      onClick={handleClearBackground}
                      disabled={savingBg}
                      className="rounded-xl border border-red-500/20 text-red-500 px-5 py-2.5 text-sm font-bold transition hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    >
                      Clear Background
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Login & Portal Background Form */}
            <div className="theme-card rounded-2xl p-6 shadow border space-y-6" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
              <div>
                <h2 className="text-xl font-bold">🔒 Login Page Background</h2>
                <p className="text-xs opacity-70 mt-1">
                  Set the background image of the Login, Register, and Password Reset screens globally.
                </p>
              </div>

              <form onSubmit={handleSaveLoginBackground} className="space-y-4">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Background Image (URL or Local File)</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={loginBgInputUrl}
                      onChange={(e) => setLoginBgInputUrl(e.target.value)}
                      className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      placeholder="e.g., https://images.unsplash.com/... or upload below"
                    />
                    <label 
                      className="rounded-xl border px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-black/5 cursor-pointer shrink-0 text-center"
                      style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                    >
                      {uploadingImage ? "Uploading..." : "📂 Choose File"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLoginBgUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>

                {loginBgInputUrl && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold opacity-60 uppercase block">Background Image Preview</span>
                    <div className="relative rounded-2xl overflow-hidden border bg-black/10 h-40 max-w-md" style={{ borderColor: "var(--border)" }}>
                      <img 
                        src={getFullImageUrl(loginBgInputUrl)} 
                        alt="Login Background Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = "https://placehold.co/600x400?text=Invalid+Image+URL"; }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingBg}
                    className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold shadow hover:bg-accent/90 cursor-pointer transition disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {savingBg ? "Saving..." : "Save Background"}
                  </button>
                  {loginBackgroundImage && (
                    <button
                      type="button"
                      onClick={handleClearLoginBackground}
                      disabled={savingBg}
                      className="rounded-xl border border-red-500/20 text-red-500 px-5 py-2.5 text-sm font-bold transition hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                    >
                      Clear Background
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* ----------------------------------------
          BANNERS EDITING MODAL
         ---------------------------------------- */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="theme-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl border space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">
                {editingBanner ? "✏️ Edit Banner" : "➕ Add New Banner"}
              </h3>
              <button onClick={() => setShowBannerModal(false)} className="text-lg font-bold opacity-60 hover:opacity-100 p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveBanner} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Banner Title *</label>
                  <input
                    type="text"
                    required
                    value={bannerFormData.title}
                    onChange={(e) => setBannerFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    placeholder="e.g., Happy Diwali Announcement"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={bannerFormData.description}
                    onChange={(e) => setBannerFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    placeholder="e.g., Celebrate Diwali with special zero transaction fees."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Banner Type</label>
                  <select
                    value={bannerFormData.banner_type}
                    onChange={(e) => setBannerFormData(prev => ({ ...prev, banner_type: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <option value="Announcement">Announcement</option>
                    <option value="Event">Event</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Priority</label>
                    <input
                      type="number"
                      value={bannerFormData.priority}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Status</label>
                    <select
                      value={bannerFormData.is_active}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, is_active: e.target.value === "true" }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Image Selection (URL or File) *</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      value={bannerFormData.image_url}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      placeholder="Enter Image URL"
                    />
                    <label 
                      className="rounded-xl border px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-black/5 cursor-pointer shrink-0 text-center"
                      style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                    >
                      {uploadingImage ? "Uploading..." : "📂 Choose File"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "banner")}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Start Date</label>
                    <input
                      type="datetime-local"
                      required
                      value={bannerFormData.start_date}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">End Date</label>
                    <input
                      type="datetime-local"
                      required
                      value={bannerFormData.end_date}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Button Text (Opt)</label>
                    <input
                      type="text"
                      value={bannerFormData.button_text}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, button_text: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      placeholder="e.g., View Details"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Button URL (Opt)</label>
                    <input
                      type="text"
                      value={bannerFormData.button_url}
                      onChange={(e) => setBannerFormData(prev => ({ ...prev, button_url: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                      placeholder="e.g., /dashboard"
                    />
                  </div>
                </div>

                <div className="border rounded-xl p-3 bg-black/5" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-bold opacity-60 uppercase block mb-1">Live Image Preview</span>
                  {bannerFormData.image_url ? (
                    <img 
                      src={getFullImageUrl(bannerFormData.image_url)} 
                      alt="Live Preview" 
                      className="w-full h-24 object-cover rounded-lg border bg-white"
                      style={{ borderColor: "var(--border)" }}
                      onError={(e) => { e.target.src = "https://placehold.co/600x200?text=Invalid+Image+URL"; }}
                    />
                  ) : (
                    <div className="h-24 bg-white/20 rounded-lg flex items-center justify-center text-xs opacity-50">No Image Specified</div>
                  )}
                </div>

              </div>

              <div className="col-span-1 md:col-span-2 flex gap-3 justify-end pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setBannerPreviewData(bannerFormData);
                    setShowBannerPreview(true);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  🔍 Preview Card
                </button>
                <button
                  type="button"
                  onClick={() => setShowBannerModal(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBanner}
                  className="rounded-xl bg-accent text-white px-6 py-2 text-sm font-bold hover:bg-accent/90 cursor-pointer disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {savingBanner ? "Saving..." : "Save Banner"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Dynamic Banner Preview Modal */}
      {showBannerPreview && bannerPreviewData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            <div className="relative h-48 sm:h-56 bg-black/10">
              <img 
                src={getFullImageUrl(bannerPreviewData.image_url)} 
                alt={bannerPreviewData.title} 
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = "https://placehold.co/800x300?text=Preview+Image+Failed"; }}
              />
              <span className="absolute top-4 left-4 rounded-full bg-accent/90 backdrop-blur text-white px-3 py-1 text-xs font-bold uppercase" style={{ background: "var(--accent)" }}>
                {bannerPreviewData.banner_type}
              </span>
              <button 
                onClick={() => setShowBannerPreview(false)}
                className="absolute top-4 right-4 rounded-full bg-black/60 text-white w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left" style={{ color: "var(--text)" }}>
              <h4 className="text-2xl font-black">{bannerPreviewData.title}</h4>
              <p className="text-sm opacity-80 leading-relaxed whitespace-pre-wrap">{bannerPreviewData.description}</p>
              
              {bannerPreviewData.button_text && (
                <div className="pt-2">
                  <a 
                    href={bannerPreviewData.button_url || "#"} 
                    onClick={(e) => e.preventDefault()}
                    className="inline-block rounded-xl bg-accent text-white px-5 py-2.5 text-xs font-bold hover:bg-accent/90 shadow transition"
                    style={{ background: "var(--accent)" }}
                  >
                    {bannerPreviewData.button_text}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------
          HOLIDAYS EDITING MODAL
         ---------------------------------------- */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="theme-card rounded-2xl max-w-lg w-full p-6 shadow-2xl border space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">
                {editingHoliday ? "✏️ Edit Market Holiday" : "➕ Add Market Holiday"}
              </h3>
              <button onClick={() => setShowHolidayModal(false)} className="text-lg font-bold opacity-60 hover:opacity-100 p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4">
              
              <div>
                <label className="text-xs font-bold opacity-75 mb-1 block">Holiday Name *</label>
                <input
                  type="text"
                  required
                  value={holidayFormData.name}
                  onChange={(e) => setHolidayFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  placeholder="e.g., Diwali / Independence Day"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Date *</label>
                  <input
                    type="date"
                    required
                    value={holidayFormData.date}
                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Holiday Type</label>
                  <select
                    value={holidayFormData.holiday_type}
                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, holiday_type: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <option value="National Holiday">National Holiday</option>
                    <option value="Festival">Festival</option>
                    <option value="Special Trading Day">Special Trading Day</option>
                    <option value="Special Day">Special Day</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Market Status</label>
                  <select
                    value={holidayFormData.market_status}
                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, market_status: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <option value="Closed">Closed (Disabled order placement)</option>
                    <option value="Open">Open (Standard trading)</option>
                    <option value="Muhurat Trading">Muhurat Trading (Hour restricted)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold opacity-75 mb-1 block">Status</label>
                  <select
                    value={holidayFormData.is_active}
                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, is_active: e.target.value === "true" }))}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              {holidayFormData.market_status === "Muhurat Trading" && (
                <div className="grid grid-cols-2 gap-3 border p-3.5 rounded-xl bg-amber-500/5 animate-in slide-in-from-top-2 duration-150" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Muhurat Start Time</label>
                    <input
                      type="time"
                      required
                      value={holidayFormData.start_time}
                      onChange={(e) => setHolidayFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold opacity-75 mb-1 block">Muhurat End Time</label>
                    <input
                      type="time"
                      required
                      value={holidayFormData.end_time}
                      onChange={(e) => setHolidayFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold opacity-75 mb-1 block">Description</label>
                <textarea
                  rows={3}
                  value={holidayFormData.description}
                  onChange={(e) => setHolidayFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  placeholder="e.g., Laxmi Puja trading session schedule details."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold opacity-75 block">Banner Background (URL or File) (Optional)</label>
                  {holidayFormData.image_url && (
                    <button
                      type="button"
                      onClick={() => setHolidayPreview({
                        name: holidayFormData.name || "Holiday Name",
                        description: holidayFormData.description || "Holiday Description",
                        market_status: holidayFormData.market_status,
                        holiday_type: holidayFormData.holiday_type,
                        image_url: holidayFormData.image_url
                      })}
                      className="text-xs font-bold text-accent hover:underline cursor-pointer"
                      style={{ color: "var(--accent)" }}
                    >
                      Preview Banner
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={holidayFormData.image_url}
                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    placeholder="Enter Image URL (or upload below)"
                  />
                  <label 
                    className="rounded-xl border px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition hover:bg-black/5 cursor-pointer shrink-0 text-center"
                    style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                  >
                    {uploadingImage ? "Uploading..." : "📂 Choose File"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "holiday")}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="rounded-xl bg-accent text-white px-6 py-2 text-sm font-bold hover:bg-accent/90 cursor-pointer disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {savingHoliday ? "Saving..." : "Save Holiday"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Banner Confirmation */}
      <ConfirmDialog
        isOpen={deleteBannerId !== null}
        title="Delete Banner"
        message="Are you sure you want to permanently delete this banner? It will stop displaying to users immediately."
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleDeleteBannerConfirm}
        onCancel={() => setDeleteBannerId(null)}
      />

      {/* Delete Holiday Confirmation */}
      <ConfirmDialog
        isOpen={deleteHolidayId !== null}
        title="Delete Holiday"
        message="Are you sure you want to permanently delete this holiday? Trading rules and notifications associated with it will revert to standard parameters immediately."
        confirmText="Delete"
        cancelText="Cancel"
        tone="danger"
        onConfirm={handleDeleteHolidayConfirm}
        onCancel={() => setDeleteHolidayId(null)}
      />

      {/* Holiday Banner Preview Modal */}
      {holidayPreview && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="theme-card rounded-3xl max-w-2xl w-full p-6 shadow-2xl border space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xl font-bold">🗺️ Holiday Banner Preview</h3>
              <button onClick={() => setHolidayPreview(null)} className="text-lg font-bold opacity-60 hover:opacity-100 p-1 cursor-pointer">✕</button>
            </div>
            
            <p className="text-xs opacity-60">This is how the holiday banner will render in user accounts (dashboard view):</p>
            
            {/* The Holiday Banner Card - exactly like ActiveBanners */}
            <div 
              className="w-full relative overflow-hidden rounded-3xl border transition duration-300 flex group mb-2 shadow-lg" 
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="relative w-full bg-black/10 flex flex-col justify-stretch h-44 sm:h-52">
                <img
                  src={getFullImageUrl(holidayPreview.image_url) || "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60"}
                  alt={holidayPreview.name}
                  className={`w-full h-full object-cover select-none absolute inset-0 transition-all duration-300 ${
                    isLightTheme ? "opacity-90 contrast-[0.95] brightness-[1.02]" : "opacity-50 brightness-[0.75] contrast-[1.05]"
                  }`}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                
                {/* Overlay gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r p-8 flex flex-col justify-center space-y-3 transition-colors duration-300 ${
                  isLightTheme 
                    ? "from-[var(--card)] via-[var(--card)]/80 to-[var(--card)]/10 text-[var(--text)]" 
                    : "from-black/85 via-black/55 to-transparent text-white"
                }`}>
                  <span className="rounded-full bg-accent/90 backdrop-blur w-fit px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
                    Holiday
                  </span>
                  <h3 className={`font-black max-w-lg truncate ${isLightTheme ? "text-[var(--text)]" : "text-white"} text-xl sm:text-2xl`}>
                    {holidayPreview.market_status === "Muhurat Trading" ? `Muhurat Trading Active: ${holidayPreview.name}` : `Market Closed: ${holidayPreview.name}`}
                  </h3>
                  <p className="max-w-md opacity-85 leading-relaxed text-xs line-clamp-2">
                    {holidayPreview.description 
                      ? (holidayPreview.market_status === "Muhurat Trading" 
                        ? `Special Muhurat Trading session is open today from ${holidayPreview.start_time || "17:30"} to ${holidayPreview.end_time || "18:30"}. ${holidayPreview.description}`
                        : `Trading is disabled today due to the ${holidayPreview.name} market holiday. ${holidayPreview.description}`)
                      : (holidayPreview.market_status === "Muhurat Trading"
                        ? `Special Muhurat Trading session is open today from ${holidayPreview.start_time || "17:30"} to ${holidayPreview.end_time || "18:30"}.`
                        : `Trading is disabled today due to the ${holidayPreview.name} market holiday.`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHolidayPreview(null)}
                className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
