import base64
import os
import time

import requests

_API_KEY = None
_BASE = "https://www.virustotal.com/api/v3"


def _key() -> str | None:
    global _API_KEY
    if _API_KEY is None:
        _API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "").strip() or None
    return _API_KEY


def _headers() -> dict:
    return {"x-apikey": _key(), "Accept": "application/json"}


def _url_id(url: str) -> str:
    """VirusTotal URL identifier: base64url of the URL, no padding."""
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


def _parse_report(data: dict, url: str) -> dict:
    stats = data.get("last_analysis_stats", {})
    malicious = stats.get("malicious", 0)
    harmless = stats.get("harmless", 0)
    undetected = stats.get("undetected", 0)
    total = malicious + harmless + undetected + stats.get("suspicious", 0)
    url_id = _url_id(url)
    return {
        "available": True,
        "malicious_count": malicious,
        "harmless_count": harmless,
        "total_engines": total,
        "scan_url": f"https://www.virustotal.com/gui/url/{url_id}",
    }


def check(url: str) -> dict:
    key = _key()
    if not key:
        print("[VIRUSTOTAL] STUBBED — VIRUSTOTAL_API_KEY not set in .env", flush=True)
        return {"available": False, "reason": "API key not configured"}

    url_id = _url_id(url)
    print(f"[VIRUSTOTAL] Checking existing report for url_id={url_id[:20]}...", flush=True)

    # Step 1: try to fetch an existing report
    get_url = f"{_BASE}/urls/{url_id}"
    print(f"[VIRUSTOTAL] GET {get_url}", flush=True)
    try:
        resp = requests.get(get_url, headers=_headers(), timeout=10)
        print(f"[VIRUSTOTAL] GET response: HTTP {resp.status_code}", flush=True)
    except Exception as exc:
        print(f"[VIRUSTOTAL] GET error: {exc}", flush=True)
        return {"available": False, "reason": str(exc)}

    if resp.status_code == 200:
        report = resp.json().get("data", {}).get("attributes", {})
        result = _parse_report(report, url)
        print(
            f"[VIRUSTOTAL] Existing report found — "
            f"malicious={result['malicious_count']} total={result['total_engines']}",
            flush=True,
        )
        return result

    if resp.status_code == 429:
        print("[VIRUSTOTAL] 429 Rate limit hit — skipping submission", flush=True)
        return {"available": False, "reason": "VirusTotal rate limit (429)"}

    if resp.status_code == 404:
        # Step 2: no existing report — submit for analysis
        print(f"[VIRUSTOTAL] No existing report (404) — submitting URL for analysis", flush=True)
        post_url = f"{_BASE}/urls"
        print(f"[VIRUSTOTAL] POST {post_url}", flush=True)
        try:
            post_resp = requests.post(
                post_url,
                headers=_headers(),
                data={"url": url},
                timeout=10,
            )
            print(f"[VIRUSTOTAL] POST response: HTTP {post_resp.status_code}", flush=True)
        except Exception as exc:
            print(f"[VIRUSTOTAL] POST error: {exc}", flush=True)
            return {"available": False, "reason": str(exc)}

        if post_resp.status_code == 429:
            print("[VIRUSTOTAL] 429 Rate limit on submission", flush=True)
            return {"available": False, "reason": "VirusTotal rate limit (429)"}

        if post_resp.status_code not in (200, 201):
            print(f"[VIRUSTOTAL] Submission failed: HTTP {post_resp.status_code}", flush=True)
            return {"available": False, "reason": f"Submission HTTP {post_resp.status_code}"}

        # Step 3: poll for the completed analysis (up to 3 attempts, 3s apart)
        analysis_id = post_resp.json().get("data", {}).get("id", "")
        print(f"[VIRUSTOTAL] Submitted — analysis_id={analysis_id[:20]}... Polling...", flush=True)

        for attempt in range(3):
            time.sleep(3)
            poll_url = f"{_BASE}/analyses/{analysis_id}"
            print(f"[VIRUSTOTAL] Poll attempt {attempt + 1}: GET {poll_url}", flush=True)
            try:
                poll_resp = requests.get(poll_url, headers=_headers(), timeout=10)
                print(f"[VIRUSTOTAL] Poll response: HTTP {poll_resp.status_code}", flush=True)
            except Exception as exc:
                print(f"[VIRUSTOTAL] Poll error: {exc}", flush=True)
                break

            if poll_resp.status_code == 429:
                print("[VIRUSTOTAL] 429 during poll", flush=True)
                return {"available": False, "reason": "VirusTotal rate limit (429)"}

            if poll_resp.status_code == 200:
                attrs = poll_resp.json().get("data", {}).get("attributes", {})
                if attrs.get("status") == "completed":
                    result = _parse_report(attrs.get("stats", {}), url)
                    # attrs uses "stats" key during analysis polling
                    stats = attrs.get("stats", {})
                    result = {
                        "available": True,
                        "malicious_count": stats.get("malicious", 0),
                        "harmless_count": stats.get("harmless", 0),
                        "total_engines": sum(stats.values()),
                        "scan_url": f"https://www.virustotal.com/gui/url/{url_id}",
                    }
                    print(
                        f"[VIRUSTOTAL] Analysis complete — "
                        f"malicious={result['malicious_count']} total={result['total_engines']}",
                        flush=True,
                    )
                    return result
                print(f"[VIRUSTOTAL] Status: {attrs.get('status')} — waiting...", flush=True)

        print("[VIRUSTOTAL] Analysis not ready after polling — returning partial", flush=True)
        return {"available": False, "reason": "Analysis still in progress after polling"}

    print(f"[VIRUSTOTAL] Unexpected status {resp.status_code}", flush=True)
    return {"available": False, "reason": f"Unexpected HTTP {resp.status_code}"}
