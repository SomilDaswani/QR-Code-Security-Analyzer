import os

import requests

_BASE = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

_THREAT_TYPES = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]

_PLATFORM_TYPES = ["ANY_PLATFORM"]
_ENTRY_TYPES = ["URL"]


def _key() -> str | None:
    return os.getenv("GOOGLE_SAFE_BROWSING_API_KEY", "").strip() or None


def check(url: str) -> dict:
    key = _key()
    if not key:
        print("[SAFEBROWSING] STUBBED — GOOGLE_SAFE_BROWSING_API_KEY not set in .env", flush=True)
        return {"available": False, "reason": "API key not configured"}

    payload = {
        "client": {"clientId": "qr-security-analyzer", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": _THREAT_TYPES,
            "platformTypes": _PLATFORM_TYPES,
            "threatEntryTypes": _ENTRY_TYPES,
            "threatEntries": [{"url": url}],
        },
    }

    # Log payload without the key
    print(f"[SAFEBROWSING] POST {_BASE}?key=<redacted>", flush=True)
    print(f"[SAFEBROWSING] Payload: threatEntries=[{{url={url!r}}}] threatTypes={_THREAT_TYPES}", flush=True)

    try:
        resp = requests.post(
            _BASE,
            params={"key": key},
            json=payload,
            timeout=10,
        )
        print(f"[SAFEBROWSING] Response: HTTP {resp.status_code}", flush=True)
    except Exception as exc:
        print(f"[SAFEBROWSING] Request error: {exc}", flush=True)
        return {"available": False, "reason": str(exc)}

    if resp.status_code != 200:
        print(f"[SAFEBROWSING] Non-200 response: {resp.text[:200]}", flush=True)
        return {"available": False, "reason": f"HTTP {resp.status_code}"}

    body = resp.json()
    matches = body.get("matches", [])

    if not matches:
        print("[SAFEBROWSING] No threats found — URL is clean", flush=True)
        return {
            "available": True,
            "is_malicious": False,
            "threat_types": [],
        }

    threat_types = list({m.get("threatType", "") for m in matches})
    print(f"[SAFEBROWSING] THREATS FOUND: {threat_types}", flush=True)
    return {
        "available": True,
        "is_malicious": True,
        "threat_types": threat_types,
    }
