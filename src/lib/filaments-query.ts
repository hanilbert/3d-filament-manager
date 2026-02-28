export interface MaterialTypeCount {
  materialType: string;
  count: number;
}

export function parseExactSearchParam(value: string | null): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

export function buildTextSearchCondition(
  value: string,
  exact: boolean
): { equals: string } | { contains: string } | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return exact ? { equals: normalized } : { contains: normalized };
}

export function aggregateMaterialTypeCounts(
  items: Array<{ variant: string | null | undefined }>
): MaterialTypeCount[] {
  const countMap = new Map<string, number>();
  for (const item of items) {
    const key = item.variant?.trim() ?? "";
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  return Array.from(countMap.entries())
    .map(([materialType, count]) => ({ materialType, count }))
    .sort((a, b) => a.materialType.localeCompare(b.materialType));
}
