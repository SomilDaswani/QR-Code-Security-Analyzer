import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHistory, clearHistory } from "../utils/storage";

const BADGE = {
  SAFE:       "bg-green-100 text-green-700",
  SUSPICIOUS: "bg-yellow-100 text-yellow-700",
  RISKY:      "bg-orange-100 text-orange-700",
  DANGEROUS:  "bg-red-100 text-red-700",
};

function formatTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function HistoryPage() {
  const [history, setHistory] = useState(getHistory);
  const navigate = useNavigate();

  function handleClear() {
    clearHistory();
    setHistory([]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Scan History</h2>
        {history.length > 0 && (
          <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-600">
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400">No scans yet</p>
          <button onClick={() => navigate("/")} className="text-sm text-blue-500 underline">
            Scan a QR code
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((entry) => (
            <li key={entry.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE[entry.risk_level] ?? BADGE.SAFE}`}>
                  {entry.risk_level}
                </span>
                <span className="text-xs text-gray-400">{entry.risk_score}/100</span>
              </div>
              <p className="text-sm text-gray-700 break-all leading-snug">{entry.url}</p>
              {entry.had_redirect && (
                <p className="text-xs text-gray-400 mt-1 break-all">→ {entry.final_url}</p>
              )}
              {entry.threats.length > 0 && (
                <p className="text-xs text-red-500 mt-1.5">
                  {entry.threats.length} risk indicator{entry.threats.length > 1 ? "s" : ""}
                </p>
              )}
              <p className="text-xs text-gray-300 mt-2">{formatTime(entry.scan_time)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
