"use client";

import { useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";
import { getLocationType } from "@/lib/location-types";

// --- Types ---

interface LocationData {
  id: string;
  name: string;
  type: string;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
}

interface LocationLabelPrinterProps {
  location: LocationData;
  qrUrl: string;
}

export function LocationLabelPrinter({ location, qrUrl }: LocationLabelPrinterProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const isAms = location.type === "ams_slot";
  const typeInfo = getLocationType(location.type);

  const handleDownload = useCallback(async () => {
    if (!labelRef.current) return;
    try {
      const dataUrl = await toPng(labelRef.current, {
        pixelRatio: 4,
        backgroundColor: "#ffffff",
        fetchRequestInit: { mode: "cors" },
        skipFonts: true,
      });
      const link = document.createElement("a");
      const safeName = location.name.replace(/[/\\?%*:|"<>]/g, "-");
      link.download = `location-${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export label:", err);
    }
  }, [location.name]);

  // Layout constants (SVG viewBox 400x300) — matches reference SVG
  const VB_W = 400;
  const VB_H = 300;

  // Top black bar
  const BAR_H = 60;

  // QR code (bottom-right)
  const QR_SIZE = 140;
  const QR_X = 240;
  const QR_Y = 140;

  // AMS icon SVG paths
  const amsIcon = (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      x={15}
      y={15}
      style={{ color: "white" }}
    >
      <path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z" />
      <path d="M10 21.9V14L2.1 9.1" />
      <path d="m10 14 11.9-6.9" />
      <path d="M14 19.8v-8.1" />
      <path d="M18 17.5V9.4" />
    </svg>
  );

  // Build slot display text (e.g. "A-3")
  const slotDisplay = isAms
    ? `${location.ams_unit ?? ""}-${location.ams_slot ?? ""}`
    : "";

  return (
    <>
      {/* Download button */}
      <div style={{ padding: "16px 0", maxWidth: "800px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleDownload} size="lg">
            <Download className="size-4" />
            下载标签图片
          </Button>
        </div>
      </div>

      {/* Label preview */}
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
        <div
          ref={labelRef}
          style={{
            width: "400px",
            aspectRatio: "4/3",
            background: "#fff",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
          }}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: "100%", height: "100%" }}
          >
            <style>{`
              .title { font-family: Inter, sans-serif; font-weight: bold; font-size: 32px; }
              .label { font-family: Inter, sans-serif; font-weight: bold; font-size: 60px; }
              .label-md { font-family: Inter, sans-serif; font-weight: bold; font-size: 48px; }
              .label-sm { font-family: Inter, sans-serif; font-weight: bold; font-size: 36px; }
              .slot-label { font-family: Inter, sans-serif; font-weight: 500; font-size: 24px; fill: #6b7280; }
              .slot-text { font-family: Inter, sans-serif; font-weight: bold; font-size: 100px; }
            `}</style>

            {/* White background */}
            <rect width="100%" height="100%" fill="#FFFFFF" />

            {/* Top black bar */}
            <rect width={VB_W} height={BAR_H} fill="black" />

            {isAms ? (
              <>
                {/* AMS icon */}
                {amsIcon}
                {/* "AMS" title in bar */}
                <text x={55} y={42} className="title" fill="white">
                  AMS
                </text>
                {/* Printer name */}
                <text x={20} y={120} lengthAdjust="spacingAndGlyphs" className="label-md">
                  {location.printer_name ?? ""}
                </text>
                {/* "插槽" label */}
                <text x={20} y={170} className="slot-label">
                  插槽
                </text>
                {/* Slot number (large) */}
                <text x={20} y={260} lengthAdjust="spacingAndGlyphs" className="slot-text">
                  {slotDisplay}
                </text>
              </>
            ) : (
              <>
                {/* Type icon in bar */}
                <text x={15} y={42} className="title" fill="white">
                  {typeInfo.icon}
                </text>
                {/* Type label in bar */}
                <text x={55} y={42} className="title" fill="white">
                  {typeInfo.label}
                </text>
                {/* Location name */}
                <text x={20} y={130} className="label-md">
                  {location.name}
                </text>
              </>
            )}

            {/* QR Code (bottom-right) */}
            <foreignObject x={QR_X} y={QR_Y} width={QR_SIZE} height={QR_SIZE}>
              <div
                style={{ width: QR_SIZE, height: QR_SIZE, background: "#fff" }}
              >
                <QRCodeSVG value={qrUrl} size={QR_SIZE} level="M" />
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>
    </>
  );
}
