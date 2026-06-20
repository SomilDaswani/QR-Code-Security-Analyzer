import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 3000;

export default function ServerStatusBanner() {
  const [online, setOnline] = useState(null); // null = unknown, true = up, false = down

  useEffect(() => {
    let timer = null;

    async function ping() {
      try {
        console.log("[ServerStatus] Pinging /api/health...");
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok) {
          console.log("[ServerStatus] Server is online.");
          setOnline(true);
          return; // stop polling
        }
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.warn("[ServerStatus] Server unreachable:", String(err));
        setOnline(false);
        timer = setTimeout(ping, POLL_INTERVAL_MS);
      }
    }

    ping();
    return () => clearTimeout(timer);
  }, []);

  if (online === null) {
    return (
      <div className="bg-gray-100 text-gray-500 text-sm text-center py-2 px-4">
        Connecting to server...
      </div>
    );
  }

  if (online === false) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm text-center py-2 px-4">
        Server offline — retrying every 3 s...
      </div>
    );
  }

  return null; // online — show nothing
}
