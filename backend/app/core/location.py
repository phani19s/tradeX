import requests
import ipaddress

_location_cache = {}

def get_location(ip):
    if not ip or ip in {"Unknown", "localhost"}:
        return "Unknown Location"

    # Check for private or loopback IP address using standard library
    try:
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_unspecified or ip_obj.is_link_local:
            return "Local Network"
    except ValueError:
        # If it's not a valid IP address (e.g. hostnames)
        if ip in {"127.0.0.1", "::1", "localhost"}:
            return "Local Network"

    # Check cache
    if ip in _location_cache:
        return _location_cache[ip]

    try:
        response = requests.get(
            f"http://ip-api.com/json/{ip}",
            timeout=2
        )

        data = response.json()
        if data.get("status") == "fail":
            _location_cache[ip] = "Unknown Location"
            return "Unknown Location"

        parts = [
            data.get("city"),
            data.get("regionName"),
            data.get("country"),
        ]

        location = ", ".join(part for part in parts if part)
        result = location or "Unknown Location"
        _location_cache[ip] = result
        return result

    except:
        return "Unknown Location"

