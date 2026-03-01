export type HueGroup =
  | "unknown"
  | "black"
  | "white"
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "lime"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "magenta"
  | "pink";

export const HUE_GROUP_LABELS: Record<HueGroup, string> = {
  unknown: "未知",
  black: "黑色",
  white: "白色",
  gray: "灰色",
  red: "红色",
  orange: "橙色",
  yellow: "黄色",
  lime: "黄绿",
  green: "绿色",
  teal: "蓝绿",
  cyan: "青色",
  blue: "蓝色",
  indigo: "靛色",
  purple: "紫色",
  magenta: "品红",
  pink: "粉色",
};

export const HUE_GROUP_ORDER: HueGroup[] = [
  "black",
  "gray",
  "white",
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "magenta",
  "pink",
  "unknown",
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX_RE.test(hex)) return null;
  const raw = hex.slice(1);
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function classifyHueGroup(hex?: string | null): HueGroup {
  if (!hex) return "unknown";
  const rgb = hexToRgb(hex);
  if (!rgb) return "unknown";
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  if (l <= 10) return "black";
  if (l >= 95) return "white";
  if (s < 10) return "gray";
  if (h >= 345 || h < 15) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 95) return "lime";
  if (h < 160) return "green";
  if (h < 190) return "teal";
  if (h < 210) return "cyan";
  if (h < 250) return "blue";
  if (h < 275) return "indigo";
  if (h < 300) return "purple";
  if (h < 330) return "magenta";
  return "pink";
}

export type GroupMode = "material" | "brand" | "hue";
export const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  material: "按材料",
  brand: "按品牌",
  hue: "按色系",
};

export function parseGroupMode(raw: string | null): GroupMode {
  if (raw === "brand" || raw === "hue") return raw;
  return "material";
}
