const LEVELS = {
  SAFE:       { bg: "bg-green-50",  border: "border-green-200", badge: "bg-green-100 text-green-800",  score: "text-green-600" },
  SUSPICIOUS: { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-800", score: "text-yellow-600" },
  RISKY:      { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800", score: "text-orange-600" },
  DANGEROUS:  { bg: "bg-red-50",    border: "border-red-200",   badge: "bg-red-100 text-red-800",      score: "text-red-600" },
};

function ScoreRing({ score, level }) {
  const s = LEVELS[level] ?? LEVELS.SAFE;
  return (
    <div className={`flex flex-col items-center justify-center w-28 h-28 rounded-full border-4 ${s.border} ${s.bg} shrink-0`}>
      <span className={`text-3xl font-bold ${s.score}`}>{score}</span>
      <span className="text-xs text-gray-400 font-medium">/ 100</span>
    </div>
  );
}

function SubResult({ title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{title}</p>
      {children}
    </div>
  );
}

export default function ResultCard({ data }) {
  const {
    url, final_url, had_redirect, redirect_chain,
    risk_score, risk_level, recommendation,
    analysis: { heuristics, safe_browsing, virustotal },
  } = data;

  const s = LEVELS[risk_level] ?? LEVELS.SAFE;

  return (
    <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className={`px-5 py-4 flex items-center gap-4 ${s.bg} border-b ${s.border}`}>
        <ScoreRing score={risk_score} level={risk_level} />
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full self-start ${s.badge}`}>
            {risk_level}
          </span>
          <p className="text-sm text-gray-700 leading-snug">{recommendation}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* URL info */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Scanned URL</p>
          <p className="text-sm text-gray-700 break-all">{url}</p>
          {had_redirect && (
            <>
              <p className="text-xs text-gray-400">Redirected through {redirect_chain.length - 1} hop{redirect_chain.length > 2 ? "s" : ""}</p>
              <p className="text-xs text-gray-500 break-all">Final: <span className="text-gray-700">{final_url}</span></p>
            </>
          )}
        </div>

        {/* Threats */}
        <SubResult title="Risk indicators">
          {heuristics.threats.length > 0 ? (
            <ul className="space-y-1.5">
              {heuristics.threats.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-red-400 shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No threats detected</p>
          )}
        </SubResult>

        {/* VirusTotal */}
        <SubResult title="VirusTotal">
          {virustotal.available ? (
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${virustotal.malicious_count > 0 ? "text-red-600" : "text-green-600"}`}>
                {virustotal.malicious_count} / {virustotal.total_engines} engines flagged
              </span>
              {virustotal.malicious_count > 0 && (
                <a href={virustotal.scan_url} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 underline">
                  View report
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{virustotal.reason ?? "Unavailable"}</p>
          )}
        </SubResult>

        {/* Safe Browsing */}
        <SubResult title="Google Safe Browsing">
          {safe_browsing.available ? (
            <p className={`text-sm font-medium ${safe_browsing.is_malicious ? "text-red-600" : "text-green-600"}`}>
              {safe_browsing.is_malicious
                ? `Threats: ${safe_browsing.threat_types.join(", ")}`
                : "No threats found"}
            </p>
          ) : (
            <p className="text-sm text-gray-400">Unavailable</p>
          )}
        </SubResult>

      </div>
    </div>
  );
}
