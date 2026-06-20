# QR Code Security Analyzer — Full Development Plan
**Project:** Detecting QR-Based Phishing (Quishing)  
**Team:** Muhammad Sannan Umer · Somil Raj · Muhammad Ali · Pawan Kumar  
**Deployment:** Vercel (frontend) + Render free tier (backend)  
**History:** localStorage only, no user accounts

---

## 1. Architecture Overview

```
User (Mobile Browser)
        │
        │  Opens https://qrsecurityanalyzer.vercel.app
        ▼
┌─────────────────────────────┐
│   React Frontend (Vercel)   │
│   - Camera via html5-qrcode │
│   - QR decoded client-side  │
│   - LocalStorage history    │
└──────────────┬──────────────┘
               │  POST /api/analyze
               │  { "url": "https://..." }
               ▼
┌──────────────────────────────────┐
│   Flask Backend (Render)         │
│   - Heuristic engine (always on) │
│   - Google Safe Browsing API     │
│   - VirusTotal API v3            │
│   - In-memory URL cache (1hr)    │
└──────────┬───────────┬───────────┘
           │           │
           ▼           ▼
  Google Safe     VirusTotal
  Browsing API    API v3
```

**Why client-side QR decoding?**  
The presentation specifies pyzbar + OpenCV (server-side). That works, but it means sending a base64 image on every scan — slower on mobile, heavier on Render's 512MB free RAM. Instead: `html5-qrcode` decodes the QR in the browser (<50ms), then sends only the decoded URL string to Flask. The backend stays lightweight and the API is simpler. The pyzbar approach is kept as a **file-upload fallback endpoint** only.

---

## 2. Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend framework | React 18 + Vite | Fast dev, small bundle, great mobile PWA support |
| Styling | TailwindCSS v3 | Mobile-first utility classes, no build quirks |
| QR Scanning | `html5-qrcode` v2.3.8 | Camera + file upload, iOS/Android tested, React hooks compatible |
| Routing | `react-router-dom` v6 | 4 pages, simple |
| HTTP client | `axios` | Cleaner than fetch for error handling |
| Backend framework | Flask 3.x | Specified in presentation |
| CORS | `flask-cors` | Required for Vercel→Render cross-origin |
| HTTP calls | `requests` | Safe Browsing + VirusTotal calls |
| Image QR decode (fallback) | `pyzbar` + `Pillow` | File upload path only; no OpenCV needed |
| Config | `python-dotenv` | API key management |
| WSGI server | `gunicorn` | Required for Render deployment |
| Frontend deploy | Vercel | Free, HTTPS auto (required for mobile camera) |
| Backend deploy | Render free tier | Free Flask hosting |

---

## 3. Identified Challenges & Solutions

### Challenge 1 — Camera access on iOS Safari
**Problem:** iOS Safari requires HTTPS for `getUserMedia()`. HTTP blocks camera completely.  
**Solution:** Vercel provides HTTPS automatically on all deployments. No action needed.  
**Fallback:** `<input type="file" accept="image/*" capture="environment">` for edge cases. `html5-qrcode` provides this built-in.

---

### Challenge 2 — Render cold start (30–60 seconds)
**Problem:** Render's free tier has a 15-minute sleep policy. After no requests for 15 minutes, the app spins down. The next request triggers a cold start that takes 30–60 seconds.  
**Solution:**  
- On app load, React immediately pings `GET /api/health` in the background.  
- A subtle "Connecting to server..." banner appears at the top while `serverReady = false`.  
- Banner disappears once health check responds.  
- The scanner still works during this time — user can scan while server wakes up.  
- If the user scans before the server is ready, the analyze request queues and auto-retries.

---

### Challenge 3 — VirusTotal rate limit (4 requests/minute, 500/day)
**Problem:** Free tier is very limited. Heavy usage hits quota.  
**Solution:**  
- In-memory Python dict cache: `{ url_hash: (result, timestamp) }` with 1-hour TTL.  
- Same URL scanned twice within 1 hour → returns cached result instantly, no API call.  
- If quota exceeded (HTTP 429), backend returns heuristic-only result with a flag `"virustotal_available": false`.  
- Frontend shows "⚠️ VirusTotal quota reached — heuristic analysis only" in the result UI.

---

### Challenge 4 — Non-URL QR codes
**Problem:** QR codes can encode WiFi credentials, phone numbers, plain text, vCards — not just URLs. Sending these to the URL analysis endpoint would fail.  
**Solution:** Content type detected **client-side** before any API call:

```
http:// or https://  →  URL  →  Send to backend for full analysis
WIFI:T:...           →  WiFi credentials  →  Show SSID/password UI, no analysis
tel:+...             →  Phone number  →  Show number with call icon
mailto:...           →  Email address  →  Show email with compose icon
SMSTO:...            →  SMS  →  Show number + message
BEGIN:VCARD          →  Contact card  →  Show name/details
geo:lat,long         →  Location  →  Show coordinates + maps link
(anything else)      →  Plain text  →  Show raw text
```

Only URLs hit the Flask backend. Everything else shows an informational card with no risk score.

---

### Challenge 5 — URL shorteners hiding destination
**Problem:** `bit.ly/abc123` in a QR code reveals nothing about the destination. It could point anywhere.  
**Solution (2-step):**  
1. Heuristic flags it immediately (+30 risk points, "URL shortener detected").  
2. Backend follows redirect chain (max 5 hops, 5s timeout) using `requests.head()` to get the final URL.  
3. Final URL is also analyzed — so both the shortener AND the destination get scored.  
4. Response includes `"final_url"` and `"redirect_chain"` so the user sees where it actually goes.

---

### Challenge 6 — Typosquatting (the Meezan Bank example from slide 3)
**Problem:** `rneezanbank.com` vs `meezanbank.com` — one letter difference, easy to miss.  
**Solution:** Heuristic engine maintains a list of known Pakistani and global domains. For each scanned URL, it computes the Levenshtein distance between the hostname and each known brand domain. Distance ≤ 2 and not an exact match → typosquatting warning (+35 risk points).

Built-in brand list includes:
`meezanbank.com`, `google.com`, `paypal.com`, `amazon.com`, `microsoft.com`, `facebook.com`, `apple.com`, `hbl.com`, `jazzcash.com.pk`, `easypaisa.com.pk`, `ubl.com.pk`, `habibmetro.com`, `statebank.org.pk`, and 20 more.

---

### Challenge 7 — React + html5-qrcode lifecycle conflict
**Problem:** `html5-qrcode` is a DOM-manipulating library, not a React component. Calling `.start()` multiple times or during re-renders crashes it.  
**Solution:** Store the scanner instance in `useRef`. Start it once in `useEffect` on mount. Clean up with `.stop()` in the `useEffect` return function. Never call start/stop outside the effect.

---

### Challenge 8 — CORS between Vercel and Render
**Problem:** Browser blocks cross-origin requests from `qrsecurityanalyzer.vercel.app` to `api.render.com`.  
**Solution:** `flask-cors` configured with explicit origin whitelist:
```python
CORS(app, origins=["https://qrsecurityanalyzer.vercel.app", "http://localhost:5173"])
```

---

## 4. Detection Engine (Heuristic Scoring)

All checks run in Python on the backend. Score range: 0–100.

| Check | Points Added | Trigger |
|---|---|---|
| HTTP (not HTTPS) | +20 | `scheme == 'http'` |
| IP address as hostname | +40 | Regex match on host |
| URL shortener domain | +30 | Host in shortener list (bit.ly, t.co, tinyurl.com, etc.) |
| Suspicious keywords | +10 per keyword (max +30) | "login", "signin", "verify", "account", "secure", "update", "confirm", "password", "banking", "credential", "wallet" |
| Excessive subdomains (>3 levels) | +15 | Count dots in host |
| Unusually long URL (>75 chars) | +10 | `len(url) > 75` |
| @ symbol in URL | +50 | Classic phishing trick (`user@evil.com@real.com`) |
| Double slash in path | +20 | `//` in path after TLD |
| Typosquatting (Levenshtein ≤ 2) | +35 | Against brand list |
| Non-existent TLD | +25 | Not in IANA TLD list |
| **Google Safe Browsing flagged** | Score set to 90 | API returns match |
| **VirusTotal: 1–2 engines flag** | +20 | Low confidence |
| **VirusTotal: 3+ engines flag** | Score set to 85 | High confidence |

**Risk Levels:**
```
0–25   →  SAFE      (green)
26–50  →  SUSPICIOUS (yellow)
51–75  →  RISKY     (orange)
76–100 →  DANGEROUS  (red)
```

---

## 5. Backend API Specification

### Base URL
`https://qr-security-backend.onrender.com`

---

### `GET /api/health`
Used by frontend to wake up Render and check server status.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-06-19T12:00:00Z" }
```

---

### `POST /api/analyze`
Main endpoint. Receives a decoded URL, returns full risk analysis.

**Request:**
```json
{ "url": "https://rneezanbank.com/login?verify=true" }
```

**Response 200:**
```json
{
  "url": "https://rneezanbank.com/login?verify=true",
  "final_url": "https://rneezanbank.com/harvest-credentials",
  "had_redirect": true,
  "redirect_chain": [
    "https://rneezanbank.com/login?verify=true",
    "https://rneezanbank.com/harvest-credentials"
  ],
  "risk_score": 88,
  "risk_level": "DANGEROUS",
  "recommendation": "Do not visit this URL. It shows signs of phishing.",
  "cached": false,
  "analysis": {
    "heuristics": {
      "score": 53,
      "threats": [
        "Possible Meezan Bank impersonation (typosquatting detected)",
        "Suspicious keywords: login, verify"
      ]
    },
    "safe_browsing": {
      "available": true,
      "is_malicious": true,
      "threat_types": ["SOCIAL_ENGINEERING"]
    },
    "virustotal": {
      "available": true,
      "malicious_count": 7,
      "total_engines": 89,
      "harmless_count": 76,
      "scan_url": "https://www.virustotal.com/gui/url/abc123"
    }
  },
  "scan_time": "2026-06-19T12:00:00Z"
}
```

**Response when APIs unavailable (no keys yet):**
```json
{
  "risk_score": 53,
  "risk_level": "RISKY",
  "analysis": {
    "heuristics": { "score": 53, "threats": [...] },
    "safe_browsing": { "available": false },
    "virustotal": { "available": false }
  }
}
```

**Error 400:**
```json
{ "error": "URL is required" }
```

**Error 400:**
```json
{ "error": "Invalid URL format" }
```

---

### `POST /api/decode` (fallback only)
Accepts a base64-encoded QR image, returns decoded text. Used when camera doesn't work.

**Request:**
```json
{ "image": "base64encodedimagestring..." }
```

**Response 200:**
```json
{ "content": "https://example.com", "type": "URL" }
```

**Response 400:**
```json
{ "error": "No QR code found in image" }
```

---

## 6. Frontend Pages & Components

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | `ScanPage` | Camera viewfinder, scan button, file upload toggle |
| `/result` | `ResultPage` | Risk score, threat breakdown, URL details |
| `/history` | `HistoryPage` | Last 50 scans from localStorage |
| `/about` | `AboutPage` | How the tool works, team info |

---

### Component Tree

```
App
├── Navbar (bottom navigation bar — mobile pattern)
├── ScanPage
│   ├── ServerStatusBanner (shows "Connecting..." during cold start)
│   ├── QRScanner (wraps html5-qrcode in useRef)
│   │   └── CameraToggle (switch front/back camera)
│   ├── UploadButton (file input fallback)
│   ├── ContentTypeCard (shows WiFi/Phone/Text for non-URL QR)
│   └── ScanningOverlay (animated corner brackets)
├── ResultPage
│   ├── RiskMeter (circular 0-100 gauge, color-coded)
│   ├── RiskBadge (SAFE / SUSPICIOUS / RISKY / DANGEROUS)
│   ├── URLDisplay (original URL + final URL if redirect occurred)
│   ├── ThreatList (each heuristic threat as a card)
│   ├── APIResults
│   │   ├── SafeBrowsingResult
│   │   └── VirusTotalResult
│   ├── Recommendation (bold "Do not visit" / "Proceed with caution" / "Safe to visit")
│   └── ActionButtons (Scan Again / View on VirusTotal / Copy URL)
└── HistoryPage
    ├── HistoryList
    │   └── HistoryItem (risk badge + URL + date, tap to see details)
    └── ClearButton
```

---

### QRScanner Component (key logic)

```jsx
// QRScanner.jsx
import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function QRScanner({ onDetected }) {
  const scannerRef = useRef(null);
  const elementId = "qr-reader";

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(elementId);
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },   // back camera
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        html5QrCode.stop();
        onDetected(decodedText);       // pass URL up to ScanPage
      },
      () => {}   // ignore per-frame scan errors
    ).catch((err) => {
      console.error("Camera start failed:", err);
    });

    return () => {
      // cleanup on unmount — critical to prevent crashes
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);   // empty deps — run once only

  return <div id={elementId} className="w-full" />;
}
```

---

### LocalStorage History Schema

```javascript
// utils/storage.js
const HISTORY_KEY = "qr_scan_history";
const MAX_HISTORY = 50;

// Each entry:
{
  id: crypto.randomUUID(),
  url: "https://...",
  final_url: "https://...",          // null if no redirect
  risk_score: 88,
  risk_level: "DANGEROUS",
  threats: ["Typosquatting detected", "..."],
  scan_time: "2026-06-19T12:00:00Z"
}
```

---

## 7. Backend File Structure

```
backend/
├── app.py                  # Flask app, route definitions
├── analyzer/
│   ├── __init__.py
│   ├── heuristics.py       # Pure Python scoring engine
│   ├── safe_browsing.py    # Google Safe Browsing API wrapper
│   ├── virustotal.py       # VirusTotal API v3 wrapper
│   └── url_utils.py        # Follow redirects, content type detection
├── cache.py                # In-memory URL result cache (dict + TTL)
├── requirements.txt
├── .env.example
├── render.yaml
└── .gitignore
```

---

## 8. Frontend File Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── ScanPage.jsx
│   │   ├── ResultPage.jsx
│   │   ├── HistoryPage.jsx
│   │   └── AboutPage.jsx
│   ├── components/
│   │   ├── QRScanner.jsx
│   │   ├── RiskMeter.jsx
│   │   ├── ThreatList.jsx
│   │   ├── URLDisplay.jsx
│   │   ├── HistoryItem.jsx
│   │   ├── ContentTypeCard.jsx
│   │   ├── ServerStatusBanner.jsx
│   │   └── Navbar.jsx
│   ├── utils/
│   │   ├── api.js          # axios calls to Flask backend
│   │   ├── storage.js      # localStorage read/write
│   │   └── qrContent.js    # Detect URL vs WiFi vs Phone etc.
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 9. Key Backend Code Snippets

### `cache.py`
```python
import time

_cache = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

def get_cached(url_hash):
    entry = _cache.get(url_hash)
    if entry and (time.time() - entry["timestamp"]) < CACHE_TTL_SECONDS:
        return entry["result"]
    return None

def set_cached(url_hash, result):
    _cache[url_hash] = {"result": result, "timestamp": time.time()}
```

### `analyzer/url_utils.py`
```python
import requests

SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "is.gd", "buff.ly", "rb.gy", "cutt.ly", "shorturl.at"
}

def is_url_shortener(hostname):
    return any(s in hostname for s in SHORTENERS)

def follow_redirects(url, max_hops=5, timeout=5):
    try:
        session = requests.Session()
        resp = session.head(url, allow_redirects=True,
                            timeout=timeout, stream=True)
        chain = [r.url for r in resp.history] + [resp.url]
        return resp.url, chain[:max_hops]
    except Exception:
        return url, [url]
```

### `analyzer/virustotal.py`
```python
import os, requests
from base64 import urlsafe_b64encode

VT_BASE = "https://www.virustotal.com/api/v3"

def analyze_url(url):
    api_key = os.getenv("VIRUSTOTAL_API_KEY")
    if not api_key:
        return {"available": False}
    
    headers = {"x-apikey": api_key}
    url_id = urlsafe_b64encode(url.encode()).decode().rstrip("=")
    
    try:
        resp = requests.get(f"{VT_BASE}/urls/{url_id}",
                            headers=headers, timeout=8)
        if resp.status_code == 404:
            # URL not in VT database — submit for analysis
            post = requests.post(f"{VT_BASE}/urls",
                                 headers=headers,
                                 data={"url": url}, timeout=8)
            return {"available": True, "malicious_count": 0,
                    "total_engines": 0, "status": "submitted"}
        
        if resp.status_code == 429:
            return {"available": False, "reason": "quota_exceeded"}
        
        data = resp.json()["data"]["attributes"]["last_analysis_stats"]
        return {
            "available": True,
            "malicious_count": data.get("malicious", 0),
            "suspicious_count": data.get("suspicious", 0),
            "harmless_count": data.get("harmless", 0),
            "total_engines": sum(data.values()),
            "scan_url": f"https://www.virustotal.com/gui/url/{url_id}"
        }
    except Exception:
        return {"available": False}
```

### `analyzer/safe_browsing.py`
```python
import os, requests

GSB_BASE = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

def check_url(url):
    api_key = os.getenv("GOOGLE_SAFE_BROWSING_API_KEY")
    if not api_key:
        return {"available": False}
    
    payload = {
        "client": {"clientId": "qr-security-analyzer", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING",
                            "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }
    
    try:
        resp = requests.post(f"{GSB_BASE}?key={api_key}",
                             json=payload, timeout=8)
        data = resp.json()
        matches = data.get("matches", [])
        is_malicious = len(matches) > 0
        threat_types = list({m["threatType"] for m in matches})
        return {
            "available": True,
            "is_malicious": is_malicious,
            "threat_types": threat_types
        }
    except Exception:
        return {"available": False}
```

---

## 10. Deployment Configuration

### `render.yaml`
```yaml
services:
  - type: web
    name: qr-security-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --bind 0.0.0.0:$PORT --workers 1
    envVars:
      - key: GOOGLE_SAFE_BROWSING_API_KEY
        sync: false
      - key: VIRUSTOTAL_API_KEY
        sync: false
    healthCheckPath: /api/health
```

### `requirements.txt`
```
flask==3.0.3
flask-cors==4.0.1
requests==2.32.3
python-dotenv==1.0.1
pyzbar==0.1.9
Pillow==10.4.0
gunicorn==22.0.0
```

### `vite.config.js` (VITE_API_URL env var)
```javascript
export default {
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || "http://localhost:5000")
  }
}
```

On Vercel: set environment variable `VITE_API_URL=https://qr-security-backend.onrender.com`

---

## 11. UI Design Decisions (Mobile-First)

- **Color scheme:** Dark background (#0A0F1E like the presentation) with blue accents (#1E40AF)
- **Risk colors:** Green `#10B981`, Yellow `#F59E0B`, Orange `#F97316`, Red `#EF4444`
- **Bottom navigation bar:** 4 icons (Scan / History / About) — thumb-reachable zone
- **Camera view:** Full-screen, portrait, with animated corner brackets on the scan box
- **Result screen:** Slides up as a bottom sheet over the camera — no page navigation needed for quick results
- **RiskMeter:** Circular gauge (SVG arc) that animates from 0 to the score on render
- **Minimum tap target:** 48px on all interactive elements
- **Font:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) — no Google Fonts dependency

---

## 12. Development Phases

### Phase 1 — Core Scan & Analyze (2–3 days)
- [ ] React app scaffold (Vite + Tailwind)
- [ ] QRScanner component with `html5-qrcode`
- [ ] Flask app with `/api/health` and `/api/analyze`
- [ ] Heuristic engine (`heuristics.py`) — full scoring
- [ ] Basic ResultPage with risk score display
- [ ] CORS configured for localhost

### Phase 2 — API Integrations (1–2 days)
- [ ] VirusTotal API wrapper + in-memory cache
- [ ] Google Safe Browsing API wrapper
- [ ] Redirect-following in `url_utils.py`
- [ ] Graceful fallback when APIs unavailable
- [ ] `/api/decode` endpoint with pyzbar (image upload fallback)

### Phase 3 — Full UI & UX (2 days)
- [ ] RiskMeter animated SVG gauge
- [ ] ThreatList detailed cards
- [ ] Non-URL content type cards (WiFi, Phone, etc.)
- [ ] History page (localStorage)
- [ ] ServerStatusBanner for cold start
- [ ] About page

### Phase 4 — Deployment (1 day)
- [ ] Deploy Flask to Render (set env vars in dashboard)
- [ ] Deploy React to Vercel (set `VITE_API_URL`)
- [ ] Add API keys to Render environment variables
- [ ] Test end-to-end on iOS Safari + Android Chrome
- [ ] Fix any CORS issues

### Phase 5 — Polish (1 day)
- [ ] Test with real malicious QR codes (use VirusTotal test URLs)
- [ ] Test cold start UX
- [ ] Test file upload fallback
- [ ] Test all non-URL QR types
- [ ] Performance check on Render (response < 2s for cached, < 5s uncached)

---

## 13. Things NOT in Scope (to keep it achievable)

- User accounts / login
- Server-stored scan history
- Browser extension
- Real-time scanning of physical QR posters (camera stream works, but no OCR)
- PDF/document scanning for embedded QR codes
- Machine learning model (heuristics + APIs are sufficient)
- Rate limiting on the Flask API (not needed for a student project)
- WebSocket / real-time updates

---

## 14. API Keys — How to Get Them

### VirusTotal
1. Sign up at https://www.virustotal.com
2. Go to Profile → API Key
3. Free key: 4 requests/minute, 500/day

### Google Safe Browsing
1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable "Safe Browsing API"
4. Go to APIs & Services → Credentials → Create API Key
5. Free tier: 10,000 requests/day

Both keys go into Render's environment variables — never hardcoded.

---

## 15. Testing QR Codes

For testing dangerous URLs without risk, use:
- VirusTotal test URL: `http://malware.testing.google.test/testing/malware/`
- EICAR test URL: `http://www.eicar.org/download/eicar.com`
- Custom typosquatting test: Create a QR with `http://rneezanbank.com/login`
- URL shortener test: `https://bit.ly/anything`

Generate test QR codes free at https://www.qr-code-generator.com

---

*Plan version 1.0 — Ready for Claude Code implementation upon approval*
