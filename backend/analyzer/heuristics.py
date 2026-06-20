import re
from urllib.parse import urlparse
from rapidfuzz.distance import Levenshtein

SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "is.gd", "buff.ly", "rb.gy", "cutt.ly", "shorturl.at",
    "qrco.de", "qr.io", "urlzs.com",
}

SUSPICIOUS_KEYWORDS = [
    "login", "signin", "verify", "account", "secure",
    "update", "confirm", "password", "banking", "credential", "wallet",
]

BRAND_LIST = [
    "meezanbank.com", "hbl.com", "ubl.com.pk", "jazzcash.com.pk",
    "easypaisa.com.pk", "habibmetro.com", "statebank.org.pk",
    "google.com", "paypal.com", "amazon.com", "microsoft.com",
    "facebook.com", "apple.com",
]

_IPV4_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
_IPV6_RE = re.compile(r"^\[?[0-9a-fA-F:]+\]?$")


def _is_ip(hostname: str) -> bool:
    return bool(_IPV4_RE.match(hostname) or _IPV6_RE.match(hostname))


def _score_to_level(score: int) -> str:
    if score <= 25:
        return "SAFE"
    if score <= 50:
        return "SUSPICIOUS"
    if score <= 75:
        return "RISKY"
    return "DANGEROUS"


_RECOMMENDATIONS = {
    "SAFE": "This URL appears safe to visit.",
    "SUSPICIOUS": "Proceed with caution — this URL has some suspicious characteristics.",
    "RISKY": "This URL shows multiple risk indicators. Avoid if possible.",
    "DANGEROUS": "Do not visit this URL. It shows strong signs of phishing or malware.",
}


def analyze(url: str) -> dict:
    threats = []
    score = 0

    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        url_lower = url.lower()
        after_scheme = url.split("://", 1)[1] if "://" in url else url
    except Exception as exc:
        return {
            "score": 0,
            "risk_level": "SAFE",
            "threats": [f"Could not parse URL: {exc}"],
            "recommendation": "URL could not be parsed.",
        }

    # 1. HTTP not HTTPS (+20)
    if parsed.scheme == "http":
        score += 20
        threats.append("Insecure connection (HTTP instead of HTTPS)")

    # 2. IP address as hostname (+40)
    if hostname and _is_ip(hostname):
        score += 40
        threats.append(f"IP address used as hostname ({hostname})")

    # 3. Known URL shortener (+30)
    if hostname in SHORTENERS:
        score += 30
        threats.append(f"Known URL shortener ({hostname})")

    # 4. Suspicious keywords (+10 each, max +30)
    found_kw = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]
    if found_kw:
        score += min(len(found_kw) * 10, 30)
        threats.append(f"Suspicious keywords: {', '.join(found_kw)}")

    # 5. Excessive subdomains — more than 3 dot-separated labels in hostname (+15)
    if hostname and not _is_ip(hostname):
        labels = hostname.split(".")
        if len(labels) > 3:
            score += 15
            threats.append(f"Excessive subdomains ({len(labels)} labels in hostname)")

    # 6. Long URL (+10)
    if len(url) > 75:
        score += 10
        threats.append(f"Unusually long URL ({len(url)} characters)")

    # 7. @ symbol after scheme (+50)
    if "@" in after_scheme:
        score += 50
        threats.append("@ symbol in URL (possible credential/redirect obfuscation)")

    # 8. Double slash in path (+20)
    if "//" in parsed.path:
        score += 20
        threats.append("Double slash in URL path (possible obfuscation)")

    # 9. Typosquatting — Levenshtein distance ≤ 2 vs brand, but not exact match (+35)
    if hostname and not _is_ip(hostname):
        host_labels = hostname.split(".")
        for brand in BRAND_LIST:
            brand_labels = brand.split(".")
            # Extract suffix from hostname with same label count as brand
            if len(host_labels) >= len(brand_labels):
                candidate = ".".join(host_labels[-len(brand_labels):])
            else:
                candidate = hostname
            if candidate == brand:
                continue  # exact match — legit site, not a typosquat
            if Levenshtein.distance(candidate, brand) <= 2:
                score += 35
                threats.append(
                    f"Possible {brand} impersonation (typosquatting detected)"
                )
                break  # flag once per URL

    score = min(score, 100)
    level = _score_to_level(score)

    return {
        "score": score,
        "risk_level": level,
        "threats": threats,
        "recommendation": _RECOMMENDATIONS[level],
    }


if __name__ == "__main__":
    test_cases = [
        ("https://www.google.com",                          "expect SAFE, score ~0"),
        ("http://rneezanbank.com/login?verify=account",     "expect DANGEROUS, score 70+"),
        ("https://bit.ly/xyz123",                           "expect SUSPICIOUS (shortener)"),
        ("http://192.168.1.1/admin@evil.com",               "expect DANGEROUS (IP + @)"),
    ]

    for url, note in test_cases:
        result = analyze(url)
        print(f"\n{'='*60}")
        print(f"URL  : {url}")
        print(f"Note : {note}")
        print(f"Score: {result['score']}  |  Level: {result['risk_level']}")
        print(f"Threats:")
        for t in result["threats"]:
            print(f"  - {t}")
        print(f"Rec  : {result['recommendation']}")
