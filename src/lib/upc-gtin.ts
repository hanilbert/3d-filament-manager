const UPC_GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeUpcGtin(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function isValidUpcGtin(value: string): boolean {
  return /^\d+$/.test(value) && UPC_GTIN_LENGTHS.has(value.length);
}

export function parseBodyUpcGtin(value: unknown): {
  provided: boolean;
  normalized: string | null;
  error: string | null;
} {
  if (value === undefined) {
    return { provided: false, normalized: null, error: null };
  }
  if (value === null) {
    return { provided: true, normalized: null, error: null };
  }
  if (typeof value !== "string") {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  const normalized = normalizeUpcGtin(value);
  if (!normalized) {
    return { provided: true, normalized: null, error: null };
  }
  if (!isValidUpcGtin(normalized)) {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  return { provided: true, normalized, error: null };
}

export function parseQueryUpcGtin(value: string | null): {
  provided: boolean;
  normalized: string | null;
  error: string | null;
} {
  if (value === null) {
    return { provided: false, normalized: null, error: null };
  }
  const normalized = normalizeUpcGtin(value);
  if (!normalized || !isValidUpcGtin(normalized)) {
    return { provided: true, normalized: null, error: "UPC/GTIN 格式无效" };
  }
  return { provided: true, normalized, error: null };
}
