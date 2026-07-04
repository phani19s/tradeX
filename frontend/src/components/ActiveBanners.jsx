import { useEffect, useState } from "react";
import api from "../api/api";
import { useTheme } from "../context/ThemeContext";

export default function ActiveBanners({ onBannersLoaded, isLoginPage = false }) {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { resolvedThemeClass } = useTheme();
  const isLightTheme = resolvedThemeClass !== "theme-dark";

  useEffect(() => {
    fetchActiveBanners();
  }, []);

  // Auto-play slider
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Change slide every 5 seconds
    return () => clearInterval(interval);
  }, [banners]);

  const fetchActiveBanners = async () => {
    try {
      const res = await api.get("/admin/banners/active");
      const list = res.data || [];
      setBanners(list);
      if (onBannersLoaded) {
        onBannersLoaded(list.length > 0);
      }
    } catch (error) {
      console.error("Failed to load active banners:", error);
      if (onBannersLoaded) {
        onBannersLoaded(false);
      }
    }
  };

  if (banners.length === 0) return null;

  const current = banners[currentIndex];
  
  // Fallback image selection for all holidays
  const getFallbackImage = () => {
    if (current.banner_type === "Holiday") {
      return "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=60";
    }
    return "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=60"; // Generic trading
  };

  const imageUrl = current.image_url || getFallbackImage();

  return (
    <div 
      className={`w-full relative overflow-hidden rounded-3xl border transition duration-300 animate-in fade-in duration-300 flex group ${
        isLoginPage ? "mb-0 border-blue-400/20 bg-slate-900/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.5)]" : "mb-6 shadow-lg"
      }`} 
      style={isLoginPage ? {} : { borderColor: "var(--border)" }}
    >
      {/* Slide Content */}
      <div 
        key={currentIndex}
        className={`relative w-full bg-black/10 flex flex-col justify-stretch animate-in fade-in slide-in-from-right-3 duration-500 ${
          isLoginPage ? "min-h-[250px] lg:min-h-[500px] h-full" : "h-44 sm:h-52"
        }`}
      >
        <img
          src={imageUrl}
          alt={current.title}
          className={`w-full h-full object-cover select-none absolute inset-0 transition-all duration-300 ${
            isLightTheme ? "opacity-90 contrast-[0.95] brightness-[1.02]" : "opacity-50 brightness-[0.75] contrast-[1.05]"
          }`}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        
        {/* Overlay gradient */}
        <div className={`absolute inset-0 bg-gradient-to-r p-8 flex flex-col justify-center space-y-3 transition-colors duration-300 ${
          isLoginPage 
            ? "from-slate-950 via-slate-950/80 to-transparent text-white" 
            : (isLightTheme 
              ? "from-[var(--card)] via-[var(--card)]/80 to-[var(--card)]/10 text-[var(--text)]" 
              : "from-black/85 via-black/55 to-transparent text-white")
        }`}>
          <span className="rounded-full bg-accent/90 backdrop-blur w-fit px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "var(--accent)" }}>
            {current.banner_type}
          </span>
          <h3 className={`font-black max-w-lg truncate ${
            isLoginPage ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}>{current.title}</h3>
          <p className={`max-w-md opacity-85 leading-relaxed ${
            isLoginPage ? "text-sm line-clamp-4" : "text-xs line-clamp-2"
          }`}>{current.description}</p>
          
          {current.button_text && (
            <div className="pt-2">
              <a
                href={current.button_url || "#"}
                className="inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-bold hover:bg-accent/90 shadow transition"
                style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
              >
                {current.button_text}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Indicators */}
      {banners.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition cursor-pointer md:opacity-0 group-hover:opacity-100"
            title="Previous Banner"
          >
            ‹
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition cursor-pointer md:opacity-0 group-hover:opacity-100"
            title="Next Banner"
          >
            ›
          </button>

          {/* Banner Counter */}
          <div className="absolute top-4 right-4 z-20 bg-black/30 backdrop-blur-md text-white/90 text-[10px] font-extrabold px-2 py-0.5 rounded-full select-none">
            {currentIndex + 1} / {banners.length}
          </div>

          {/* Dots */}
          <div className="absolute bottom-4 right-4 flex gap-1.5 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex ? "bg-accent scale-125" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
