const LAYERS = [
  { title: "Heuristic Analysis", desc: "Scores the URL against 9 rule-based checks: IP addresses, URL shorteners, suspicious keywords, typosquatting against known Pakistani and global brands, and more." },
  { title: "VirusTotal", desc: "Checks the URL against 90+ antivirus and web security engines via the VirusTotal API v3." },
  { title: "Google Safe Browsing", desc: "Queries Google's Safe Browsing API for known phishing, malware, and unwanted software threats." },
];

const LEVELS = [
  { label: "SAFE",       color: "bg-green-100 text-green-700",   desc: "Score 0–25. No significant risk indicators." },
  { label: "SUSPICIOUS", color: "bg-yellow-100 text-yellow-700", desc: "Score 26–50. Proceed with caution." },
  { label: "RISKY",      color: "bg-orange-100 text-orange-700", desc: "Score 51–75. Multiple risk signals detected." },
  { label: "DANGEROUS",  color: "bg-red-100 text-red-700",       desc: "Score 76–100. Strong signs of phishing or malware." },
];

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-md mx-auto">

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">QR Security Analyzer</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Decodes QR codes and checks embedded URLs for phishing, malware, and other threats
          before you visit them — using three independent detection layers.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Detection layers</h3>
        <ul className="space-y-2">
          {LAYERS.map(({ title, desc }) => (
            <li key={title} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-800 mb-1">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Risk levels</h3>
        <ul className="space-y-2">
          {LEVELS.map(({ label, color, desc }) => (
            <li key={label} className="flex gap-3 items-start">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${color}`}>{label}</span>
              <p className="text-xs text-gray-500 leading-relaxed pt-0.5">{desc}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-300 text-center pb-2">
        Student project · local analysis only · results may vary
      </p>
    </div>
  );
}
