import requests


def get_location(ip):
    if ip in {"127.0.0.1", "::1", "localhost", "Unknown"}:
        return "Unknown Location"

    try:
        response = requests.get(
            f"http://ip-api.com/json/{ip}",
            timeout=3
        )

        data = response.json()
        if data.get("status") == "fail":
            return "Unknown Location"

        parts = [
            data.get("city"),
            data.get("regionName"),
            data.get("country"),
        ]

        location = ", ".join(part for part in parts if part)
        return location or "Unknown Location"

    except:
        return "Unknown Location"
