"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onResult: (decodedText: string) => void;
  onClose: () => void;
  mode?: "qr-only" | "qr-and-barcode";
  onStartError?: (message: string) => void;
}

type ScannerState = "idle" | "starting" | "running" | "stopping" | "stopped";

function isAbortPlayError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || "";
  return (
    error.name === "AbortError" ||
    msg.includes("play() request was interrupted") ||
    msg.includes("media was removed from the document")
  );
}

export function QRScanner({
  onResult,
  onClose,
  mode = "qr-only",
  onStartError,
}: QRScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const onResultRef = useRef(onResult);
  const scannerStateRef = useRef<ScannerState>("idle");
  const id = useId();
  onResultRef.current = onResult;
  const elementId = `qr-scanner-container-${id.replace(/[:]/g, "")}`;

  async function safeStop(scanner: import("html5-qrcode").Html5Qrcode | null) {
    if (!scanner) return;
    if (scannerStateRef.current !== "running") return;

    scannerStateRef.current = "stopping";
    try {
      await scanner.stop();
    } catch {
      // 忽略 stop 期间的竞争异常
    } finally {
      scannerStateRef.current = "stopped";
    }
  }

  useEffect(() => {
    let html5QrCode: import("html5-qrcode").Html5Qrcode | null = null;
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
      scannerStateRef.current = "starting";

      const scanConfig: import("html5-qrcode").Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
      };

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          scanConfig,
          async (decodedText) => {
            await safeStop(html5QrCode);
            onResultRef.current(decodedText);
          },
          undefined
        );
        if (isMounted) {
          scannerStateRef.current = "running";
        }
      } catch (error) {
        if (!isAbortPlayError(error)) {
          onStartError?.("摄像头不可用或权限未开启");
        }
      }
    }

    const startPromise = startScanner();

    return () => {
      isMounted = false;
      void startPromise.catch(() => {});
      if (scannerRef.current && scannerStateRef.current === "running") {
        void safeStop(scannerRef.current);
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
