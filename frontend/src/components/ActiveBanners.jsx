import { useEffect, useState } from "react";
import api from "../api/api";

export default function ActiveBanners() {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchActiveBanners();
  }, []);

  // Auto-play slider
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000); // Change slide every 6 seconds
    return () => clearInterval(interval);
  }, [banners]);

  const fetchActiveBanners = async () => {
    try {
      const res = await api.get("/admin/banners/active");
      setBanners(res.data || []);
    } catch (error) {
      console.error("Failed to load active banners:", error);
    }
  };

  if (banners.length === 0) return null;

  const current = banners[currentIndex];

  return (
    <div className="w-full relative overflow-hidden rounded-2xl border shadow-lg transition duration-300 animate-in fade-in duration-300 mb-6" style={{ borderColor: "var(--border)" }}>
      {/* Slide Content */}
      <div className="relative h-44 sm:h-52 w-full bg-black/10">
        <img
          src={current.image_url}
          alt={current.title}
          className="w-full h-full object-cover select-none"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent p-6 flex flex-col justify-center text-white space-y-2">
          <span className="rounded-full bg-accent/90 backdrop-blur w-fit px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--accent)" }}>
            {current.banner_type}
          </span>
          <h3 className="text-xl sm:text-2xl font-black max-w-lg truncate">{current.title}</h3>
          <p className="text-xs max-w-md line-clamp-2 opacity-85 leading-relaxed">{current.description}</p>
          
          {current.button_text && (
            <div className="pt-1.5">
              <a
                href={current.button_url || "#"}
                className="inline-block rounded-xl bg-accent text-white px-4 py-2 text-xs font-bold hover:bg-accent/90 shadow transition"
                style={{ background: "var(--accent)" }}
              >
                {current.button_text}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? "bg-white scale-125" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
