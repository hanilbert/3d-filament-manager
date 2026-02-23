"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onResult: (decodedText: string) => void;
  onClose: () => void;
}

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const elementId = "qr-scanner-container";

  useEffect(() => {
    let html5QrCode: import("html5-qrcode").Html5Qrcode;

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            onResultRef.current(decodedText);
            html5QrCode.stop().catch(() => {});
          },
          undefined
        );
      } catch {
        // Camera permission denied or not available
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="mt-4 space-y-3">
      <div
        id={elementId}
        className="w-full rounded-lg overflow-hidden bg-black"
        style={{ minHeight: 280 }}
      />
      <Button variant="outline" className="w-full h-12" onClick={onClose}>
        取消扫码
      </Button>
    </div>
  );
}
