import { useState } from "react";
import { useNavigate } from "react-router-dom";
import QRScanner from "../components/QRScanner";
import ContentCard from "../components/ContentCard";
import { analyzeUrl } from "../utils/api";
import { addToHistory } from "../utils/storage";

export default function ScanPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [nonUrlResult, setNonUrlResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleResult(classified) {
    setNonUrlResult(null);
    setError(null);

    if (classified.type === "URL") {
      setLoading(true);
      try {
        const result = await analyzeUrl(classified.data);
        addToHistory(result);
        navigate("/result", { state: { analysis: result } });
      } catch (err) {
        console.error("[ScanPage] API error:", err);
        setError("Could not reach the server. Is Flask running?");
      } finally {
        setLoading(false);
      }
    } else {
      setNonUrlResult(classified);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Point your camera at a QR code or upload an image to check if it's safe.
      </p>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analyzing URL...</p>
        </div>
      ) : (
        <QRScanner onResult={handleResult} />
      )}

      {error && (
        <div className="w-72 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {nonUrlResult && (
        <div className="w-full max-w-sm">
          <ContentCard type={nonUrlResult.type} data={nonUrlResult.data} />
          <button
            onClick={() => setNonUrlResult(null)}
            className="mt-3 w-full text-sm text-blue-600 underline text-center"
          >
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}
