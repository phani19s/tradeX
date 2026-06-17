import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

function Toggle({ active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-12 rounded-full transition-colors ${
        active ? "bg-blue-600" : "bg-slate-400"
      }`}
      aria-pressed={active}
    >
      <span
        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
          active ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ColorSwatch({ label, hex, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className="h-11 w-11 rounded-full border-2 transition"
        style={{
          backgroundColor: hex,
          borderColor: selected ? "var(--accent)" : "transparent",
          boxShadow: selected ? `0 0 0 3px var(--accent-soft)` : "none",
        }}
      />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ThemeModal({ isOpen, onClose }) {
  const {
    themeMode,
    setThemeMode,
    accentTheme,
    setAccentTheme,
    accentColor,
    timeConfigs,
    setTimeConfigs,
    currentThemeLabel,
    activePeriod,
  } = useTheme();

  const colors = [
    { name: "red", label: "Red", hex: "#ff7a90" },
    { name: "green", label: "Green", hex: "#7ee7bf" },
    { name: "purple", label: "Purple", hex: "#c4a1ff" },
    { name: "orange", label: "Orange", hex: "#ffbc82" },
    { name: "yellow", label: "Yellow", hex: "#ffe28a" },
    { name: "blue", label: "Blue", hex: "#93c5fd" },
  ];

  const periods = [
    { name: "Morning", time: "06:00 AM - 12:00 PM", theme: "Light Theme", dot: "bg-amber-400" },
    { name: "Afternoon", time: "12:00 PM - 06:00 PM", theme: "Blue Theme", dot: "bg-sky-400" },
    { name: "Evening", time: "06:00 PM - 09:00 PM", theme: "Dark Theme", dot: "bg-emerald-400" },
    { name: "Night", time: "09:00 PM - 06:00 AM", theme: "Purple Theme", dot: "bg-violet-400" },
  ];

  const timePresets = [
    { value: "light", label: "Light Theme", mode: "light", accent: "green" },
    { value: "dark", label: "Dark Theme", mode: "dark", accent: "blue" },
    { value: "crazy:red", label: "Crazy Theme - Red", mode: "crazy", accent: "red" },
    { value: "crazy:green", label: "Crazy Theme - Green", mode: "crazy", accent: "green" },
    { value: "crazy:purple", label: "Crazy Theme - Purple", mode: "crazy", accent: "purple" },
    { value: "crazy:orange", label: "Crazy Theme - Orange", mode: "crazy", accent: "orange" },
    { value: "crazy:yellow", label: "Crazy Theme - Yellow", mode: "crazy", accent: "yellow" },
    { value: "crazy:blue", label: "Crazy Theme - Blue", mode: "crazy", accent: "blue" },
  ];

  const [selectedPeriod, setSelectedPeriod] = useState(
    periods.some((period) => period.name === activePeriod) ? activePeriod : "Evening"
  );
  const selectedConfig = timeConfigs?.[selectedPeriod] || { mode: "dark", accent: accentTheme };
  const selectedPreset =
    timePresets.find(
      (preset) => preset.mode === selectedConfig.mode && preset.accent === selectedConfig.accent
    ) ||
    timePresets.find((preset) => preset.mode === selectedConfig.mode) ||
    timePresets[0];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed right-2 top-14 z-50 w-[min(64vw,270px)]">
      <div
        className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-[18px] border p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        style={{
          background: "var(--card)",
          color: "var(--text)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">Theme Settings</h2>
            <p className="mt-1 text-xs opacity-80">Current: {currentThemeLabel}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-2xl leading-none opacity-70 transition hover:opacity-100"
            aria-label="Close theme settings"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs">System Default</span>
            <Toggle active={themeMode === "system"} onClick={() => setThemeMode("system")} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs">Light Theme</span>
            <Toggle active={themeMode === "light"} onClick={() => setThemeMode("light")} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs">Dark Theme</span>
            <Toggle active={themeMode === "dark"} onClick={() => setThemeMode("dark")} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs">Crazy Theme</span>
            <Toggle active={themeMode === "crazy"} onClick={() => setThemeMode("crazy")} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs">Time-Based Theme</span>
            <Toggle active={themeMode === "time"} onClick={() => setThemeMode("time")} />
          </div>
        </div>

        {themeMode === "crazy" && (
          <section className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Accent Colors</h3>
              <span className="text-xs opacity-70">Custom palette</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {colors.map((color) => {
                const isSelected = accentTheme === color.name;

                return (
                  <ColorSwatch
                    key={color.name}
                    label={color.label}
                    hex={color.hex}
                    selected={isSelected}
                    onClick={() => {
                      setAccentTheme(color.name);
                      if (themeMode === "crazy") {
                        setThemeMode("crazy");
                      }
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {themeMode === "time" && (
          <section className="mt-3 space-y-3">
            <div
              className="rounded-2xl px-3 py-2 text-sm font-semibold"
              style={{
                background: "var(--accent-soft)",
                color: "var(--text)",
                border: `1px solid var(--accent-border)`,
              }}
            >
              <span
                className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
                style={{ background: accentColor }}
              >
                ●
              </span>
              {activePeriod} is active now
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Select Period to Configure</h3>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs outline-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                  backgroundColor: "var(--card)",
                }}
              >
                {periods.map((period) => (
                  <option
                    key={period.name}
                    value={period.name}
                    style={{ color: "var(--text)", backgroundColor: "var(--card)" }}
                  >
                    {period.name}
                  </option>
                ))}
              </select>
            </div>

            <div
                className="rounded-xl border p-2.5"
              style={{
                borderColor: selectedPeriod === activePeriod ? "var(--accent-border)" : "var(--border)",
                background: "color-mix(in srgb, var(--card) 94%, black 6%)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      periods.find((period) => period.name === selectedPeriod)?.dot || "bg-slate-400"
                    }`}
                  />
                  <p className="text-sm font-semibold">{selectedPeriod}</p>
                </div>
                <span className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ background: "var(--accent-soft)" }}>
                  {selectedPeriod === activePeriod ? "Active" : "Edit"}
                </span>
              </div>

                <label className="mb-2 block text-[10px] font-semibold uppercase opacity-70">
                  Theme + Accent
                </label>
              <select
                value={selectedPreset.value}
                onChange={(e) =>
                  setTimeConfigs((prev) => {
                    const nextPreset = timePresets.find((preset) => preset.value === e.target.value);

                    if (!nextPreset) {
                      return prev;
                    }

                    return {
                      ...prev,
                      [selectedPeriod]: {
                        mode: nextPreset.mode,
                        accent: nextPreset.accent,
                      },
                    };
                  })
                }
                className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-xs outline-none"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                  backgroundColor: "var(--card)",
                }}
              >
                {timePresets.map((preset) => (
                  <option
                    key={preset.value}
                    value={preset.value}
                    style={{ color: "var(--text)", backgroundColor: "var(--card)" }}
                  >
                    {preset.label}
                  </option>
                ))}
              </select>

              <div className="mt-3 rounded-lg border px-2.5 py-2 text-[11px]" style={{ borderColor: "var(--border)" }}>
                Theme for {selectedPeriod}: {selectedPreset.label}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default ThemeModal;
