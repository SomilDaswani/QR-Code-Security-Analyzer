import { useLocation, useNavigate } from "react-router-dom";
import ResultCard from "../components/ResultCard";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state?.analysis) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-gray-500 text-sm">No result to display.</p>
        <button onClick={() => navigate("/")} className="text-blue-600 text-sm underline">
          Go to scanner
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResultCard data={state.analysis} />
      <button
        onClick={() => navigate("/")}
        className="w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-3 rounded-xl transition-colors"
      >
        Scan Another
      </button>
    </div>
  );
}
