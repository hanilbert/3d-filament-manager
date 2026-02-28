export const LOCATION_TYPES = [
  { value: "shelf",    label: "货架",       icon: "📦" },
  { value: "printer",  label: "打印机",     icon: "🖨️" },
  { value: "ams_slot", label: "AMS",         icon: "🔲" },
  { value: "dryer",    label: "耗材干燥机", icon: "💨" },
  { value: "custom",   label: "自定义位置", icon: "📍" },
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number]["value"];
const LOCATION_TYPE_SET = new Set<LocationType>(LOCATION_TYPES.map((item) => item.value));

const CUSTOM_TYPE = LOCATION_TYPES.find((t) => t.value === "custom")!;

export function getLocationType(type: string) {
  return LOCATION_TYPES.find((t) => t.value === type) ?? CUSTOM_TYPE;
}

export function isLocationType(value: unknown): value is LocationType {
  return typeof value === "string" && LOCATION_TYPE_SET.has(value as LocationType);
}
