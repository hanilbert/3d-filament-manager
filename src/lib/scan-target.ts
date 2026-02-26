import { isValidUpcGtin, normalizeUpcGtin } from "@/lib/upc-gtin";

const UUID_REGEX = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SPOOL_PATH_RE = new RegExp(`/spools/(${UUID_REGEX})(?:[/?#]|$)`, "i");
const LOCATION_PATH_RE = new RegExp(`/location/(${UUID_REGEX})(?:[/?#]|$)`, "i");
const UUID_ONLY_RE = new RegExp(`^(${UUID_REGEX})$`, "i");

export type ScanTarget =
  | { type: "spool"; spoolId: string }
  | { type: "location"; locationId: string }
  | { type: "upc_gtin"; upcGtin: string }
  | { type: "unknown" };

export function parseScanTarget(rawText: string): ScanTarget {
  const text = rawText.trim();

  try {
    const pathname = new URL(text).pathname;
    const spoolMatch = pathname.match(SPOOL_PATH_RE);
    if (spoolMatch?.[1]) return { type: "spool", spoolId: spoolMatch[1] };

    const locationMatch = pathname.match(LOCATION_PATH_RE);
    if (locationMatch?.[1]) return { type: "location", locationId: locationMatch[1] };
  } catch {
    // 非 URL 内容继续按路径/纯文本解析
  }

  const spoolMatch = text.match(SPOOL_PATH_RE);
  if (spoolMatch?.[1]) return { type: "spool", spoolId: spoolMatch[1] };

  const locationMatch = text.match(LOCATION_PATH_RE);
  if (locationMatch?.[1]) return { type: "location", locationId: locationMatch[1] };

  const uuidMatch = text.match(UUID_ONLY_RE);
  if (uuidMatch?.[1]) return { type: "spool", spoolId: uuidMatch[1] };

  const normalizedUpcGtin = normalizeUpcGtin(text);
  if (isValidUpcGtin(normalizedUpcGtin)) {
    return { type: "upc_gtin", upcGtin: normalizedUpcGtin };
  }

  return { type: "unknown" };
}
