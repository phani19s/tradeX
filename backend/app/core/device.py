import re


def _browser_version(user_agent: str, marker: str) -> str:
    match = re.search(rf"{re.escape(marker)}/([\d.]+)", user_agent)
    return match.group(1).split(".")[0] if match else ""


def parse_user_agent(user_agent: str | None) -> dict:
    value = (user_agent or "").strip()

    if not value:
        return {
            "device": "Unknown Device",
            "browser": "Unknown App",
            "browser_version": "",
            "browser_display": "Unknown App",
        }

    if "TradeXDesktop" in value:
        return {
            "device": "TradeX Desktop App",
            "browser": "TradeX Desktop App",
            "browser_version": "",
            "browser_display": "TradeX Desktop App",
        }

    if "Edg/" in value:
        browser = "Edge"
        version = _browser_version(value, "Edg")
    elif "OPR/" in value:
        browser = "Opera"
        version = _browser_version(value, "OPR")
    elif "Chrome/" in value or "CriOS/" in value:
        browser = "Chrome"
        version = _browser_version(value, "Chrome") or _browser_version(value, "CriOS")
    elif "Firefox/" in value or "FxiOS/" in value:
        browser = "Firefox"
        version = _browser_version(value, "Firefox") or _browser_version(value, "FxiOS")
    elif "Safari/" in value:
        browser = "Safari"
        version = _browser_version(value, "Version")
    else:
        browser = "Unknown Browser"
        version = ""

    if "Windows NT 10.0" in value:
        platform = "Windows 11" if "Chrome/" in value or "Edg/" in value else "Windows"
    elif "Windows" in value:
        platform = "Windows"
    elif "Mac OS X" in value or "Macintosh" in value:
        platform = "macOS"
    elif "Android" in value:
        platform = "Android"
    elif "iPhone" in value:
        platform = "iPhone"
    elif "iPad" in value:
        platform = "iPad"
    elif "Linux" in value:
        platform = "Linux"
    else:
        platform = "Unknown Device"

    browser_display = f"{browser} {version}" if version else browser

    return {
        "device": f"{platform} - {browser}",
        "browser": browser,
        "browser_version": version,
        "browser_display": browser_display,
    }
