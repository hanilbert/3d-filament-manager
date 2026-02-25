"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onResult: (decodedText: string) => void;
  onClose: () => void;
  mode?: "qr-only" | "qr-and-barcode";
  onStartError?: (message: string) => void;
}

export function QRScanner({
  onResult,
  onClose,
  mode = "qr-only",
  onStartError,
}: QRScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const onResultRef = useRef(onResult);
  const stoppingRef = useRef(false);
  const id = useId();
  onResultRef.current = onResult;
  const elementId = `qr-scanner-container-${id.replace(/[:]/g, "")}`;

  function safeStop(scanner: import("html5-qrcode").Html5Qrcode | null) {
    if (!scanner || stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const stopPromise = scanner.stop();
      stopPromise
        .catch(() => {})
        .finally(() => {
          stoppingRef.current = false;
        });
    } catch {
      stoppingRef.current = false;
    }
  }

  useEffect(() => {
    let html5QrCode: import("html5-qrcode").Html5Qrcode;
    let isMounted = true;

    async function startScanner() {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!isMounted) return;
      const scannerConfig: import("html5-qrcode").Html5QrcodeFullConfig = {
        verbose: false,
        formatsToSupport:
          mode === "qr-and-barcode"
            ? [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
              ]
            : [Html5QrcodeSupportedFormats.QR_CODE],
      };
      html5QrCode = new Html5Qrcode(elementId, scannerConfig);
      scannerRef.current = html5QrCode;
      const scanConfig: import("html5-qrcode").Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
      };

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          scanConfig,
          (decodedText) => {
            onResultRef.current(decodedText);
            safeStop(html5QrCode);
          },
          undefined
        );
      } catch {
        onStartError?.("摄像头不可用或权限未开启");
      }
    }

    const startPromise = startScanner();

    return () => {
      isMounted = false;
      startPromise.catch(() => {});
      if (scannerRef.current) {
        safeStop(scannerRef.current);
      }
    };
  }, [elementId, mode, onStartError]);

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
