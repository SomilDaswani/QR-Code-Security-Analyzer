import hashlib
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from analyzer.heuristics import analyze as heuristic_analyze
from analyzer.url_utils import follow_redirects
from analyzer.virustotal import check as vt_check
from analyzer.safe_browsing import check as sb_check
from cache import get_cached, set_cached

load_dotenv()

app = Flask(__name__)

_allowed_origins = ["http://localhost:5173"]
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url:
    _allowed_origins.append(_frontend_url.rstrip("/"))
CORS(app, origins=_allowed_origins)


def _is_valid_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()



def _level(score: int) -> str:
    if score <= 25: return "SAFE"
    if score <= 50: return "SUSPICIOUS"
    if score <= 75: return "RISKY"
    return "DANGEROUS"


def _rec(level: str) -> str:
    return {
        "SAFE": "This URL appears safe to visit.",
        "SUSPICIOUS": "Proceed with caution — this URL has some suspicious characteristics.",
        "RISKY": "This URL shows multiple risk indicators. Avoid if possible.",
        "DANGEROUS": "Do not visit this URL. It shows strong signs of phishing or malware.",
    }[level]


def _build_response(
    original_url: str,
    final_url: str,
    redirect_chain: list,
    had_redirect: bool,
    original_heuristics: dict,
    final_heuristics: dict | None,
    vt_result: dict,
    sb_result: dict,
    cached: bool = False,
) -> dict:
    all_threats = list(original_heuristics["threats"])
    combined_score = original_heuristics["score"]

    if final_heuristics and had_redirect:
        for t in final_heuristics["threats"]:
            if t not in all_threats:
                all_threats.append(t)
        # Use max, not sum: destination risk dominates when we can verify it.
        # Summing would double-penalise a clean URL just for passing through a shortener.
        combined_score = max(original_heuristics["score"], final_heuristics["score"])

    # Boost score if VirusTotal flags it as malicious (+5 per engine, max +30)
    if vt_result.get("available") and vt_result.get("malicious_count", 0) > 0:
        vt_boost = min(vt_result["malicious_count"] * 5, 30)
        combined_score = min(combined_score + vt_boost, 100)
        print(f"[ANALYZE] VT malicious boost: +{vt_boost} -> score={combined_score}", flush=True)

    # Boost score if Safe Browsing flags it (+40, hard signal)
    if sb_result.get("available") and sb_result.get("is_malicious"):
        combined_score = min(combined_score + 40, 100)
        print(f"[ANALYZE] Safe Browsing malicious boost: +40 -> score={combined_score}", flush=True)

    level = _level(combined_score)

    heuristics_block = {"score": combined_score, "threats": all_threats}
    if had_redirect and final_heuristics:
        heuristics_block["original_url_score"] = original_heuristics["score"]
        heuristics_block["final_url_score"] = final_heuristics["score"]

    return {
        "url": original_url,
        "final_url": final_url,
        "had_redirect": had_redirect,
        "redirect_chain": redirect_chain,
        "risk_score": combined_score,
        "risk_level": level,
        "recommendation": _rec(level),
        "cached": cached,
        "analysis": {
            "heuristics": heuristics_block,
            "safe_browsing": sb_result,
            "virustotal": vt_result,
        },
        "scan_time": datetime.now(timezone.utc).isoformat(),
    }


@app.route("/api/health")
def health():
    print("[HEALTH] GET /api/health", flush=True)
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(silent=True) or {}
    url = body.get("url", "").strip()

    print(f"[ANALYZE] POST /api/analyze  url={url!r}", flush=True)

    if not url:
        return jsonify({"error": "Missing 'url' field in request body"}), 400
    if not _is_valid_url(url):
        print(f"[ANALYZE] 400 - invalid URL: {url!r}", flush=True)
        return jsonify({"error": f"Invalid or non-HTTP(S) URL: {url!r}"}), 400

    url_hash = _url_hash(url)
    print(f"[ANALYZE] sha256={url_hash[:12]}...", flush=True)

    t0 = time.perf_counter()
    cached_result = get_cached(url_hash)
    if cached_result is not None:
        elapsed = (time.perf_counter() - t0) * 1000
        print(f"[ANALYZE] CACHE HIT ({elapsed:.2f}ms)", flush=True)
        cached_result["cached"] = True
        return jsonify(cached_result)

    print("[ANALYZE] CACHE MISS - running analysis", flush=True)

    # 1. Heuristics on original URL
    original_heuristics = heuristic_analyze(url)
    print(
        f"[ANALYZE] Original heuristics - score={original_heuristics['score']} "
        f"level={original_heuristics['risk_level']}",
        flush=True,
    )

    # 2. Always follow redirects — any URL can redirect, not just shorteners
    print("[ANALYZE] Following redirects", flush=True)
    redir = follow_redirects(url)
    final_url = redir["final_url"]
    redirect_chain = redir["redirect_chain"]
    had_redirect = redir["had_redirect"]
    final_heuristics = None

    if had_redirect:
        print(f"[ANALYZE] Redirect detected: {url!r} -> {final_url!r}", flush=True)
        final_heuristics = heuristic_analyze(final_url)
        print(
            f"[ANALYZE] Final URL heuristics - score={final_heuristics['score']} "
            f"level={final_heuristics['risk_level']}",
            flush=True,
        )
    else:
        print("[ANALYZE] No redirect", flush=True)

    # 3. VirusTotal + Safe Browsing (both run on final URL)
    print(f"[ANALYZE] Running VirusTotal check on {final_url!r}", flush=True)
    vt_result = vt_check(final_url)
    print(f"[ANALYZE] VirusTotal result: {vt_result}", flush=True)

    print(f"[ANALYZE] Running Safe Browsing check on {final_url!r}", flush=True)
    sb_result = sb_check(final_url)
    print(f"[ANALYZE] Safe Browsing result: {sb_result}", flush=True)

    response = _build_response(
        url, final_url, redirect_chain, had_redirect,
        original_heuristics, final_heuristics, vt_result, sb_result,
    )
    set_cached(url_hash, response.copy())

    elapsed = (time.perf_counter() - t0) * 1000
    print(
        f"[ANALYZE] Done - risk_score={response['risk_score']} "
        f"level={response['risk_level']} ({elapsed:.2f}ms)",
        flush=True,
    )
    return jsonify(response)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
