import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrScanner({ onScan, onClose }) {
  const containerId = 'qr-reader-volunteer';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    let cancelled = false;

    const startScanner = async () => {
      try {
        const onSuccess = (decodedText) => {
          // decodedText is expected to be a roll number or student id
          onScan(decodedText.trim());
        };
        const onFrameError = () => {}; // ignore per-frame errors
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        // Preferred for mobile.
        try {
          await scanner.start({ facingMode: 'environment' }, config, onSuccess, onFrameError);
          if (!cancelled) setStarted(true);
          return;
        } catch {
          // Fall through to explicit camera selection.
        }

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) {
          throw new Error('No camera devices found');
        }
        await scanner.start(cameras[0].id, config, onSuccess, onFrameError);
        if (!cancelled) setStarted(true);
      } catch (err) {
        if (cancelled) return;
        if (!window.isSecureContext) {
          setError('Camera needs HTTPS or localhost. Please search manually.');
        } else {
          setError('Camera access denied or not available. Please search manually.');
        }
        console.error(err);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        {/* Header */}
        <div className="bg-forest-700 text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold">Scan Wristband QR</div>
            <div className="text-xs text-forest-300">कलाई बैंड स्कैन करें</div>
          </div>
          <button onClick={onClose} className="text-forest-300 text-2xl leading-none">✕</button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black">
          <div id={containerId} className="w-full" />
          {!started && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-white text-center">
                <div className="text-3xl mb-2 animate-pulse">📷</div>
                <div className="text-sm">Starting camera…</div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border-t border-red-200 text-red-700 text-sm text-center">
            <div className="text-2xl mb-1">⚠️</div>
            {error}
          </div>
        )}

        {/* Instructions */}
        {!error && (
          <div className="px-4 py-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
            Point camera at the QR code on student's wristband
            <br />छात्र के कलाई बैंड पर QR कोड की ओर कैमरा करें
          </div>
        )}

        <div className="px-4 pb-4 pt-2">
          <button onClick={onClose} className="w-full btn-outline py-2 text-sm">
            Cancel — मैनुअल खोज करें
          </button>
        </div>
      </div>
    </div>
  );
}
