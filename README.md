# QR Code Security Analyzer

A mobile-first web app that decodes QR codes and checks embedded URLs for phishing, malware, and other threats — before you visit them.

## How it works

Every scanned URL passes through three independent detection layers:

1. **Heuristic Analysis** — 9 rule-based checks (typosquatting, suspicious keywords, URL shorteners, IP addresses, HTTP scheme, and more) scored 0–100
2. **VirusTotal** — checked against 90+ antivirus and web security engines via the VirusTotal API v3
3. **Google Safe Browsing** — queried against Google's known phishing, malware, and unwanted software database

Risk levels: **SAFE** (0–25) · **SUSPICIOUS** (26–50) · **RISKY** (51–75) · **DANGEROUS** (76–100)

Non-URL QR codes (WiFi, contact cards, phone numbers, etc.) are decoded and displayed without an analysis.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, react-router-dom |
| QR scanning | html5-qrcode (camera + file upload) |
| Backend | Flask 3, flask-cors, python-dotenv |
| Threat intel | VirusTotal API v3, Google Safe Browsing API v4 |
| Heuristics | rapidfuzz (Levenshtein distance for typosquatting) |
| Caching | In-memory (1-hour TTL, keyed by SHA-256 of URL) |
| History | localStorage (max 50 entries) |

---

## Local development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then fill in your API keys
python app.py
```

Runs on `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` — the Vite dev server proxies `/api/*` to Flask automatically.

---

## Environment variables

Create `backend/.env` from `backend/.env.example`:

```env
VIRUSTOTAL_API_KEY=your_key_here
GOOGLE_SAFE_BROWSING_API_KEY=your_key_here
FLASK_ENV=development
FLASK_DEBUG=1
PYTHONUNBUFFERED=1
```

- **VirusTotal API key** — free tier at https://www.virustotal.com/gui/sign-in
- **Google Safe Browsing API key** — enable the Safe Browsing API in Google Cloud Console

Both APIs have free tiers sufficient for development and light use.

---

## Project structure

```
├── backend/
│   ├── app.py                  # Flask app, routes
│   ├── cache.py                # In-memory result cache (1h TTL)
│   ├── analyzer/
│   │   ├── heuristics.py       # Rule-based URL scoring
│   │   ├── url_utils.py        # Redirect following
│   │   ├── virustotal.py       # VirusTotal API client
│   │   └── safe_browsing.py    # Google Safe Browsing client
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ScanPage.jsx     # Camera / file upload scanner
    │   │   ├── ResultPage.jsx   # Risk analysis result
    │   │   ├── HistoryPage.jsx  # Past scans (localStorage)
    │   │   └── AboutPage.jsx    # How it works
    │   ├── components/
    │   │   ├── QRScanner.jsx        # html5-qrcode wrapper
    │   │   ├── ResultCard.jsx       # Risk result display
    │   │   ├── ContentCard.jsx      # Non-URL QR display
    │   │   ├── BottomNav.jsx        # Navigation bar
    │   │   └── ServerStatusBanner.jsx
    │   └── utils/
    │       ├── api.js           # analyzeUrl()
    │       ├── qrContent.js     # QR type classifier
    │       ├── qrParsers.js     # WiFi/vCard/geo parsers
    │       └── storage.js       # localStorage history
    └── vite.config.js
```

---

## API

### `GET /api/health`
Returns `{ status: "ok", timestamp: "<ISO8601>" }`

### `POST /api/analyze`
**Body:** `{ "url": "https://example.com" }`

**Response:**
```json
{
  "url": "https://example.com",
  "final_url": "https://example.com",
  "had_redirect": false,
  "redirect_chain": ["https://example.com"],
  "risk_score": 0,
  "risk_level": "SAFE",
  "recommendation": "This URL appears safe to visit.",
  "cached": false,
  "analysis": {
    "heuristics": { "score": 0, "threats": [] },
    "safe_browsing": { "available": true, "is_malicious": false, "threat_types": [] },
    "virustotal": { "available": true, "malicious_count": 0, "total_engines": 92, "harmless_count": 61, "scan_url": "https://www.virustotal.com/..." }
  },
  "scan_time": "2026-06-20T10:00:00Z"
}
```

---

## Deployment

- **Backend** → [Render](https://render.com) (free tier, Python web service)
- **Frontend** → [Vercel](https://vercel.com) (free tier, static + SPA)

See deployment notes below for production environment variable setup and CORS configuration.

---

## Limitations

- URL shorteners using JavaScript redirects (not HTTP 3xx) cannot have their destination analyzed — the shortener domain itself is scored instead
- VirusTotal free tier: 4 requests/minute, 500/day
- In-memory cache resets on server restart; results are not persisted to disk
- Camera access requires HTTPS in production (localhost is exempt)
