export function getDeviceInfo(device, browserValue) {
  const value = String(device || "").trim();
  if (!value) {
    return {
      device: "Unknown Device",
      browser: browserValue || "Unknown App",
    };
  }

  const normalized = value.replace(/^Desktop\/Laptop -\s*/i, "");
  if (!normalized.includes("Mozilla/")) {
    return {
      device: normalized,
      browser: browserValue || normalized,
    };
  }

  const browser =
    normalized.includes("Edg/") ? "Edge" :
    normalized.includes("OPR/") || normalized.includes("Opera") ? "Opera" :
    normalized.includes("Chrome/") || normalized.includes("CriOS/") ? "Chrome" :
    normalized.includes("Firefox/") || normalized.includes("FxiOS/") ? "Firefox" :
    normalized.includes("Safari/") ? "Safari" :
    "Unknown Browser";

  const versionMatch =
    normalized.match(/(?:Edg|OPR|Chrome|CriOS|Firefox|FxiOS|Version)\/([\d.]+)/);
  const version = versionMatch ? versionMatch[1].split(".")[0] : "";

  const platform =
    normalized.includes("Windows NT 10.0") ? "Windows 11" :
    normalized.includes("Windows") ? "Windows" :
    normalized.includes("Mac OS X") || normalized.includes("Macintosh") ? "macOS" :
    normalized.includes("Android") ? "Android" :
    normalized.includes("iPhone") ? "iPhone" :
    normalized.includes("iPad") ? "iPad" :
    normalized.includes("Linux") ? "Linux" :
    "Unknown Device";

  return {
    device: `${platform} - ${browser}`,
    browser: browserValue || `${browser}${version ? ` ${version}` : ""}`,
  };
}

export function formatDevice(device, browser) {
  return getDeviceInfo(device, browser).device;
}

export function formatBrowser(device, browser) {
  return getDeviceInfo(device, browser).browser;
}

export function formatSecurityDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).replace(",", "");
}

export function formatDuration(seconds) {
  const totalSeconds = Number(seconds || 0);
  if (totalSeconds <= 0) return "-";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "success" || normalized === "active") {
    return "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";
  }

  if (normalized === "failed") {
    return "bg-rose-500/15 text-rose-500 border-rose-500/20";
  }

  if (normalized.includes("expired")) {
    return "bg-amber-500/15 text-amber-500 border-amber-500/20";
  }

  return "bg-slate-500/15 text-slate-500 border-slate-500/20";
}
