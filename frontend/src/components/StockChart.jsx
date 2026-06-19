import { useMemo, useState, useRef, useEffect } from "react";

function StockChart({ symbol, currentPrice, previousClose }) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef(null);

  // Generate 1 Year (365 days) of stable pseudo-random data
  const allCandles = useMemo(() => {
    const totalDays = 365;
    const data = [];
    
    let lastClose = previousClose;
    const targetPrice = currentPrice;
    const volatilityFactor = (targetPrice > 1000) ? 0.02 : 0.04;

    for (let i = 0; i < totalDays; i++) {
      const remainingSteps = totalDays - i;
      const pull = (targetPrice - lastClose) / remainingSteps;
      
      let close;
      if (i === totalDays - 1) {
        close = targetPrice;
      } else {
        const baseVolatility = targetPrice * volatilityFactor;
        const macroWave = Math.sin(i * 0.2) * (targetPrice * 0.02);
        const noise = (Math.random() - 0.5) * baseVolatility;
        
        close = lastClose + pull + noise + macroWave;
        close = Math.max(close, targetPrice * 0.1);
      }

      const open = lastClose;
      const dayVol = close * 0.012;
      const high = Math.max(open, close) + Math.random() * dayVol;
      const low = Math.min(open, close) - Math.random() * dayVol;

      data.push({ open, close, high, low, isUp: close >= open });
      lastClose = close;
    }
    return data;
  }, [currentPrice, previousClose]);

  const [visibleRange, setVisibleRange] = useState({ min: 0, max: 0, range: 1 });

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    const startIndex = Math.max(0, Math.floor((scrollLeft / scrollWidth) * allCandles.length));
    const endIndex = Math.min(allCandles.length - 1, Math.ceil(((scrollLeft + clientWidth) / scrollWidth) * allCandles.length));
    
    const visibleCandles = allCandles.slice(startIndex, endIndex + 1);
    if (visibleCandles.length === 0) return;
    
    const prices = visibleCandles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    setVisibleRange({ 
      min: minPrice, 
      max: maxPrice, 
      range: maxPrice - minPrice || 1 
    });
  };

  // Default view: scroll to end (today) and initial range calculation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      // Small delay to ensure scrollWidth is updated if zoom changed
      setTimeout(handleScroll, 10);
    }
  }, [allCandles, zoom]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, [allCandles]);

  const yLabels = [
    visibleRange.max, 
    visibleRange.min + visibleRange.range * 0.75, 
    visibleRange.min + visibleRange.range * 0.5, 
    visibleRange.min + visibleRange.range * 0.25, 
    visibleRange.min
  ];

  return (
    <div className="w-full mt-6 rounded-3xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Top Controls Area */}
      <div className="flex justify-between items-center mb-4 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <span className="text-[9px] uppercase tracking-[0.2em] opacity-50 font-black">{symbol} Chart</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/10 rounded-lg p-1 border px-2" style={{ borderColor: "var(--border)" }}>
              <button 
                  onClick={() => setZoom(prev => Math.min(prev + 0.5, 4))}
                  className="w-6 h-6 flex items-center justify-center text-[10px] font-black bg-white/5 hover:bg-white/10 rounded transition"
              >+</button>
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Zoom</span>
              <button 
                  onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
                  className="w-6 h-6 flex items-center justify-center text-[10px] font-black bg-white/5 hover:bg-white/10 rounded transition"
              >-</button>
          </div>

          <div className="hidden sm:flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#10b981]"></div>
              <span className="text-[9px] font-bold opacity-70 uppercase tracking-wider">Price Up</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
              <span className="text-[9px] font-bold opacity-70 uppercase tracking-wider">Price Down</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex h-52 gap-4">
        {/* Fixed Y-Axis Labels */}
        <div className="flex flex-col justify-between text-[10px] font-bold opacity-40 py-1 min-w-[45px]">
          {yLabels.map((val, i) => (
            <span key={i}>₹{Math.round(val)}</span>
          ))}
        </div>

        {/* Scrollable Container */}
        <div 
          ref={scrollRef}
          className="relative flex-grow overflow-x-auto overflow-y-hidden border-l border-b pb-2 pl-2 custom-scrollbar" 
          style={{ borderColor: "rgba(0,0,0,0.1)" }}
        >
          {/* Inner Content Area - 1 year data, dynamic viewport based on zoom */}
          <div 
            className="flex items-end h-full" 
            style={{ 
              width: `${(allCandles.length / (30 / zoom)) * 100}%`, 
              minWidth: "100%",
              gap: "2px"
            }}
          >
            {allCandles.map((c, i) => {
              const hTop = ((c.high - visibleRange.min) / visibleRange.range) * 100;
              const hBottom = ((c.low - visibleRange.min) / visibleRange.range) * 100;
              const bTop = ((Math.max(c.open, c.close) - visibleRange.min) / visibleRange.range) * 100;
              const bBottom = ((Math.min(c.open, c.close) - visibleRange.min) / visibleRange.range) * 100;
              const bodyHeight = Math.max(bTop - bBottom, 2); 

              return (
                <div key={i} className="relative flex flex-col items-center h-full flex-grow">
                  {/* Wick */}
                  <div 
                    className="absolute w-[1px] opacity-40" 
                    style={{ 
                      bottom: `${hBottom}%`, 
                      height: `${hTop - hBottom}%`, 
                      backgroundColor: c.isUp ? "#10b981" : "#ef4444" 
                    }}
                  />
                  {/* Body */}
                  <div 
                    className="absolute w-full max-w-[12px] rounded-sm" 
                    style={{ 
                      bottom: `${bBottom}%`, 
                      height: `${bodyHeight}%`, 
                      backgroundColor: c.isUp ? "#10b981" : "#ef4444",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-4 ml-[49px] opacity-40 text-[9px] font-black uppercase tracking-widest">
        <span>History</span>
        <span>-20 Days</span>
        <span>-10 Days</span>
        <span className="text-accent">Live</span>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

export default StockChart;
