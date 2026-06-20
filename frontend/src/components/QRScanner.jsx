import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { classifyQR } from "../utils/qrContent";

const CAM_ID = "qr-cam-region";
const FILE_ID = "qr-file-region";

export default function QRScanner({ onResult }) {
  const stoppedRef = useRef(false);
  const [camError, setCamError] = useState(null);
  const [fileError, setFileError] = useState(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(CAM_ID);
    stoppedRef.current = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          try { scanner.stop().catch(() => {}); } catch (_) {}
          console.log("[QRScanner] Camera decoded:", decodedText);
          onResult(classifyQR(decodedText));
        },
        () => {}
      )
      .catch((err) => {
        console.error("[QRScanner] Camera start error:", err);
        setCamError(String(err));
      });

    return () => {
      if (!stoppedRef.current) {
        stoppedRef.current = true;
        try { scanner.stop().catch(() => {}); } catch (_) {}
      }
    };
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    const tmp = new Html5Qrcode(FILE_ID);
    tmp.scanFile(file, false)
      .then((decodedText) => {
        console.log("[QRScanner] File decoded:", decodedText);
        onResult(classifyQR(decodedText));
      })
      .catch((err) => {
        console.error("[QRScanner] File scan error:", err);
        setFileError("Could not read QR code from that image.");
      });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Viewfinder */}
      <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
        <div id={CAM_ID} className="w-full h-full" />
        {camError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-400 text-sm text-center px-4">
            Camera unavailable.<br />Use file upload below.
          </div>
        )}
      </div>

      <div id={FILE_ID} className="hidden" />

      {/* File upload */}
      <label className="w-72 flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm text-gray-500">Upload QR image</span>
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>

      {fileError && (
        <p className="text-sm text-red-500 text-center">{fileError}</p>
      )}
    </div>
  );
}
