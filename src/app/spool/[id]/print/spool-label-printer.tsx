"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";

// --- Types ---

interface GlobalFilament {
  brand: string;
  material: string;
  color_name: string;
  color_hex: string | null;
  logo_url: string | null;
  nozzle_temp: string | null;
  bed_temp: string | null;
  print_speed: string | null;
  density: string | null;
  diameter: string | null;
  nominal_weight: string | null;
  softening_temp: string | null;
  chamber_temp: string | null;
  pressure_advance: string | null;
  shrinkage: string | null;
  fan_min: string | null;
  fan_max: string | null;
  max_volumetric_speed: string | null;
  flow_ratio: string | null;
  drying_temp: string | null;
  dry_time: string | null;
  ams_compatibility: string | null;
  build_plates: string | null;
  top_voted_td: string | null;
}

interface LabelParam {
  key: keyof GlobalFilament;
  label: string;
  category: string;
  defaultOn: boolean;
  unit?: string;
}

// --- Param config (Chinese labels) ---

const LABEL_PARAMS: LabelParam[] = [
  { key: "nozzle_temp", label: "喷嘴温度", category: "打印参数", defaultOn: true },
  { key: "bed_temp", label: "热床温度", category: "打印参数", defaultOn: true },
  { key: "print_speed", label: "打印速度", category: "打印参数", defaultOn: false, unit: "mm/s" },
  { key: "flow_ratio", label: "流量比", category: "流量特性", defaultOn: true },
  { key: "top_voted_td", label: "TD值", category: "流量特性", defaultOn: true },
  { key: "max_volumetric_speed", label: "最大体积速度", category: "流量特性", defaultOn: false, unit: "mm³/s" },
  { key: "density", label: "密度", category: "技术参数", defaultOn: false, unit: "g/cm³" },
  { key: "diameter", label: "直径", category: "技术参数", defaultOn: false, unit: "mm" },
  { key: "nominal_weight", label: "标称重量", category: "技术参数", defaultOn: false, unit: "g" },
  { key: "softening_temp", label: "软化温度", category: "技术参数", defaultOn: false },
  { key: "chamber_temp", label: "腔体温度", category: "技术参数", defaultOn: false },
  { key: "pressure_advance", label: "压力提前", category: "技术参数", defaultOn: false },
  { key: "shrinkage", label: "收缩率", category: "技术参数", defaultOn: false, unit: "%" },
  { key: "fan_min", label: "最小风扇", category: "风扇速度", defaultOn: false, unit: "%" },
  { key: "fan_max", label: "最大风扇", category: "风扇速度", defaultOn: false, unit: "%" },
  { key: "drying_temp", label: "干燥温度", category: "干燥信息", defaultOn: false },
  { key: "dry_time", label: "干燥时间", category: "干燥信息", defaultOn: false, unit: "h" },
  { key: "ams_compatibility", label: "AMS兼容", category: "兼容性", defaultOn: false },
  { key: "build_plates", label: "打印板", category: "兼容性", defaultOn: false },
];

const STORAGE_KEY = "spool-label-selected-params";

// --- Component ---

interface SpoolLabelPrinterProps {
  globalFilament: GlobalFilament;
  qrUrl: string;
}

export function SpoolLabelPrinter({ globalFilament: gf, qrUrl }: SpoolLabelPrinterProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  const availableParams = useMemo(
    () => LABEL_PARAMS.filter((p) => gf[p.key] != null && gf[p.key] !== ""),
    [gf]
  );

  const groupedParams = useMemo(() => {
    const groups: Record<string, LabelParam[]> = {};
    for (const p of availableParams) {
      (groups[p.category] ??= []).push(p);
    }
    return groups;
  }, [availableParams]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(LABEL_PARAMS.filter((p) => p.defaultOn).map((p) => p.key));
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const keys: string[] = JSON.parse(stored);
        setSelected(new Set(keys));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
    } catch {}
  }, [selected]);

  const toggleParam = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeParams = availableParams.filter((p) => selected.has(p.key));

  const handleDownload = useCallback(async () => {
    if (!labelRef.current) return;
    try {
      const dataUrl = await toPng(labelRef.current, {
        pixelRatio: 4,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${gf.brand}-${gf.material}-${gf.color_name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export label:", err);
    }
  }, [gf.brand, gf.material, gf.color_name]);

  // Layout constants (SVG viewBox 400x300)
  const VB_W = 400;
  const VB_H = 300;
  const PAD = 14;
  const QR_SIZE = 110;
  const QR_X = 270;
  const QR_Y = 20;
  const BAR_Y = 64;
  const BAR_W = 260;
  const BAR_H = 36;
  const HEX_X = 285;
  const COLOR_NAME_Y = 129;
  const PARAM_START_Y = 165;
  const PARAM_LINE_H = 24;
  const PARAM_VAL_X = 142;

  // Dynamic: if many params, shrink line height
  const lineH = activeParams.length > 6 ? 20 : PARAM_LINE_H;

  return (
    <>
      {/* Control panel */}
      <div style={{ padding: "16px 0", maxWidth: "800px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "300px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#333" }}>
              选择要显示的参数
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {Object.entries(groupedParams).map(([category, params]) => (
                <div key={category} style={{ minWidth: "140px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", marginBottom: "6px" }}>
                    {category}
                  </div>
                  {params.map((p) => (
                    <label
                      key={p.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        cursor: "pointer",
                        marginBottom: "4px",
                      }}
                    >
                      <Checkbox
                        checked={selected.has(p.key)}
                        onCheckedChange={() => toggleParam(p.key)}
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleDownload} size="lg" style={{ marginTop: "4px" }}>
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
              text { font-family: Arial, Helvetica, sans-serif; }
              .brand-name { font-weight: bold; font-size: 48px; }
              .text-material { font-size: 30px; font-weight: bold; }
              .text-color { font-size: 30px; }
              .text-hex { font-size: 24px; }
              .text-param-label { font-size: 20px; fill: #666; }
              .text-param-value { font-size: 20px; fill: #000; font-weight: 600; }
              .black-bg { fill: #000000; }
              .white-text { fill: #FFFFFF; }
            `}</style>

            {/* White background */}
            <rect width="100%" height="100%" fill="#FFFFFF" />

            {/* Brand name */}
            <text x={PAD} y="54" className="brand-name">
              {gf.brand}
            </text>

            {/* QR Code (top-right) */}
            <foreignObject x={QR_X} y={QR_Y} width={QR_SIZE} height={QR_SIZE}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: QR_SIZE, height: QR_SIZE, background: "#fff" }}>
                <QRCodeSVG value={qrUrl} size={QR_SIZE} level="M" includeMargin={false} />
              </div>
            </foreignObject>

            {/* Material bar (black) */}
            <rect x={PAD} y={BAR_Y} width={BAR_W} height={BAR_H} className="black-bg" />
            <text x={PAD + 4} y={BAR_Y + 29} className="white-text text-material">
              {gf.material}
            </text>

            {/* Color hex (right of bar) */}
            {gf.color_hex && (
              <text x={HEX_X} y={BAR_Y + 26} className="text-hex">
                {gf.color_hex.toUpperCase()}
              </text>
            )}

            {/* Color name */}
            <text x={PAD} y={COLOR_NAME_Y} className="text-color">
              {gf.color_name}
            </text>

            {/* Divider line */}
            {activeParams.length > 0 && (
              <line x1={PAD} y1={COLOR_NAME_Y + 10} x2={240} y2={COLOR_NAME_Y + 10} stroke="#000" strokeWidth="1" />
            )}

            {/* Parameters */}
            {activeParams.map((p, i) => {
              const y = PARAM_START_Y + i * lineH;
              const val = String(gf[p.key] ?? "");
              const unit = p.unit && !val.includes(p.unit) ? p.unit : "";
              return (
                <g key={p.key}>
                  <text x={PAD} y={y} className="text-param-label">
                    {p.label}:
                  </text>
                  <text x={PARAM_VAL_X} y={y} className="text-param-value">
                    {val}{unit}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </>
  );
}
