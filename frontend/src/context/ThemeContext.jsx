/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "tradex-theme";
const THEME_MODES = ["system", "light", "dark", "crazy", "time"];
const ACCENT_THEMES = ["red", "green", "purple", "orange", "yellow", "blue"];

const ACCENT_COLORS = {
  red: "#fb7185",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  yellow: "#eab308",
  blue: "#3b82f6",
};

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getAccentColor(accent) {
  return ACCENT_COLORS[accent] || ACCENT_COLORS.green;
}

function createDefaultTimeConfigs() {
  return {
    Morning: { mode: "light", accent: "yellow" },
    Afternoon: { mode: "light", accent: "blue" },
    Evening: { mode: "dark", accent: "green" },
    Night: { mode: "crazy", accent: "purple" },
  };
}

function getCurrentTimePeriod() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return "Morning";
  }

  if (hour >= 12 && hour < 18) {
    return "Afternoon";
  }

  if (hour >= 18 && hour < 21) {
    return "Evening";
  }

  return "Night";
}

function normalizePreferences(rawValue) {
  if (!rawValue) {
    return { mode: "dark", accent: "green", timeConfigs: createDefaultTimeConfigs() };
  }

  try {
    const parsed = JSON.parse(rawValue);

    const defaultConfigs = createDefaultTimeConfigs();
    const parsedTimeConfigs = parsed.timeConfigs || {};

    return {
      mode: THEME_MODES.includes(parsed.mode) ? parsed.mode : "dark",
      accent: ACCENT_THEMES.includes(parsed.accent) ? parsed.accent : "green",
      timeConfigs: {
        Morning: {
          mode: ["light", "dark", "crazy"].includes(parsedTimeConfigs.Morning?.mode)
            ? parsedTimeConfigs.Morning.mode
            : defaultConfigs.Morning.mode,
          accent: ACCENT_THEMES.includes(parsedTimeConfigs.Morning?.accent)
            ? parsedTimeConfigs.Morning.accent
            : defaultConfigs.Morning.accent,
        },
        Afternoon: {
          mode: ["light", "dark", "crazy"].includes(parsedTimeConfigs.Afternoon?.mode)
            ? parsedTimeConfigs.Afternoon.mode
            : defaultConfigs.Afternoon.mode,
          accent: ACCENT_THEMES.includes(parsedTimeConfigs.Afternoon?.accent)
            ? parsedTimeConfigs.Afternoon.accent
            : defaultConfigs.Afternoon.accent,
        },
        Evening: {
          mode: ["light", "dark", "crazy"].includes(parsedTimeConfigs.Evening?.mode)
            ? parsedTimeConfigs.Evening.mode
            : defaultConfigs.Evening.mode,
          accent: ACCENT_THEMES.includes(parsedTimeConfigs.Evening?.accent)
            ? parsedTimeConfigs.Evening.accent
            : defaultConfigs.Evening.accent,
        },
        Night: {
          mode: ["light", "dark", "crazy"].includes(parsedTimeConfigs.Night?.mode)
            ? parsedTimeConfigs.Night.mode
            : defaultConfigs.Night.mode,
          accent: ACCENT_THEMES.includes(parsedTimeConfigs.Night?.accent)
            ? parsedTimeConfigs.Night.accent
            : defaultConfigs.Night.accent,
        },
      },
    };
  } catch {
    if (THEME_MODES.includes(rawValue)) {
      return {
        mode: rawValue,
        accent: "green",
        timeConfigs: createDefaultTimeConfigs(),
      };
    }

    if (ACCENT_THEMES.includes(rawValue)) {
      return {
        mode: "crazy",
        accent: rawValue,
        timeConfigs: createDefaultTimeConfigs(),
      };
    }

    return {
      mode: "dark",
      accent: "green",
      timeConfigs: createDefaultTimeConfigs(),
    };
  }
}

function resolveTheme(mode, accent, timeConfigs) {
  if (mode === "system") {
    const systemTheme = getSystemTheme();

    return {
      className: `theme-${systemTheme}`,
      currentLabel: "System Default",
      activePeriod: "System",
      themeName: `${capitalize(systemTheme)} Mode`,
      accent: accent,
    };
  }

  if (mode === "time") {
    const currentPeriod = getCurrentTimePeriod();
    const periodConfig = timeConfigs?.[currentPeriod] || createDefaultTimeConfigs()[currentPeriod];
    const themeMode = periodConfig.mode || "dark";
    const themeAccent = periodConfig.accent || "green";
    const className = themeMode === "crazy" ? `theme-${themeAccent}` : `theme-${themeMode}`;

    return {
      className,
      currentLabel: "Time-Based Mode",
      activePeriod: currentPeriod,
      themeName:
        themeMode === "crazy"
          ? `${capitalize(themeAccent)} Theme`
          : `${capitalize(themeMode)} Theme`,
      accent: themeAccent,
    };
  }

  if (mode === "crazy") {
    const resolvedAccent = ACCENT_THEMES.includes(accent) ? accent : "green";

    return {
      className: `theme-${resolvedAccent}`,
      currentLabel: `${capitalize(resolvedAccent)} Theme`,
      activePeriod: null,
      themeName: `${capitalize(resolvedAccent)} Theme`,
      accent: resolvedAccent,
    };
  }

  return {
    className: `theme-${mode}`,
    currentLabel: `${capitalize(mode)} Mode`,
    activePeriod: null,
    themeName: `${capitalize(mode)} Mode`,
    accent,
  };
}

export function ThemeProvider({ children }) {
  const initialPreferences = normalizePreferences(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  const [themeMode, setThemeMode] = useState(initialPreferences.mode);
  const [accentTheme, setAccentTheme] = useState(initialPreferences.accent);
  const [timeConfigs, setTimeConfigs] = useState(initialPreferences.timeConfigs);
  const [themeState, setThemeState] = useState(() =>
    resolveTheme(initialPreferences.mode, initialPreferences.accent, initialPreferences.timeConfigs)
  );

  useEffect(() => {
    const syncTheme = () => {
      const resolved = resolveTheme(themeMode, accentTheme, timeConfigs);
      const accentColor = resolved.accent ? getAccentColor(resolved.accent) : getAccentColor(accentTheme);

      setThemeState(resolved);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: themeMode,
          accent: accentTheme,
          timeConfigs,
        })
      );

      document.documentElement.className = "";
      document.documentElement.classList.add(resolved.className);
      document.documentElement.style.setProperty("--accent", accentColor);
      document.documentElement.style.setProperty("--accent-soft", `${accentColor}26`);
      document.documentElement.style.setProperty("--accent-border", `${accentColor}66`);
    };

    syncTheme();

    const systemQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const handleSystemChange = () => {
      if (themeMode === "system") {
        syncTheme();
      }
    };

    if (systemQuery) {
      if (systemQuery.addEventListener) {
        systemQuery.addEventListener("change", handleSystemChange);
      } else {
        systemQuery.addListener(handleSystemChange);
      }
    }

    const timeTimer =
      themeMode === "time" ? window.setInterval(syncTheme, 60_000) : null;

    return () => {
      if (systemQuery) {
        if (systemQuery.removeEventListener) {
          systemQuery.removeEventListener("change", handleSystemChange);
        } else {
          systemQuery.removeListener(handleSystemChange);
        }
      }

      if (timeTimer) {
        window.clearInterval(timeTimer);
      }
    };
  }, [themeMode, accentTheme, timeConfigs]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        accentTheme,
        setAccentTheme,
        timeConfigs,
        setTimeConfigs,
        accentColor: getAccentColor(themeState.accent || accentTheme),
        currentThemeLabel: themeState.currentLabel,
        currentThemeName: themeState.themeName,
        activePeriod: themeState.activePeriod,
        resolvedThemeClass: themeState.className,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
