export const LOCATION_TYPES = [
  { value: "shelf",    label: "货架",       icon: "📦" },
  { value: "printer",  label: "打印机",     icon: "🖨️" },
  { value: "ams_slot", label: "AMS 插槽",   icon: "🔲" },
  { value: "dryer",    label: "耗材干燥机", icon: "💨" },
  { value: "custom",   label: "自定义位置", icon: "📍" },
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number]["value"];

export function getLocationType(type: string) {
  return LOCATION_TYPES.find((t) => t.value === type) ?? LOCATION_TYPES[4]; // fallback to custom
}
