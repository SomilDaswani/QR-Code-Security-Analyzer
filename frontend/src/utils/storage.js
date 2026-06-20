const KEY = "qr_scan_history";
const MAX_ENTRIES = 50;

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addToHistory(analysisResult) {
  const entry = {
    id: Date.now(),
    url: analysisResult.url,
    final_url: analysisResult.final_url,
    had_redirect: analysisResult.had_redirect,
    risk_score: analysisResult.risk_score,
    risk_level: analysisResult.risk_level,
    scan_time: analysisResult.scan_time,
    threats: analysisResult.analysis.heuristics.threats,
  };

  const current = getHistory();
  const updated = [entry, ...current].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(updated));
  return entry;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
