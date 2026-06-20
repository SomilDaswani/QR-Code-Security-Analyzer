import { Routes, Route } from "react-router-dom";
import ServerStatusBanner from "./components/ServerStatusBanner";
import BottomNav from "./components/BottomNav";
import ScanPage from "./pages/ScanPage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ServerStatusBanner />

      {/* Page header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <h1 className="text-base font-bold text-gray-800 tracking-tight">QR Security Analyzer</h1>
        </div>
      </header>

      {/* Page content — pb-20 clears the fixed bottom nav */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-5 pb-24">
        <Routes>
          <Route path="/"        element={<ScanPage />} />
          <Route path="/result"  element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about"   element={<AboutPage />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}
