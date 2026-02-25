import { describe, it, expect } from "vitest";
import { LOCATION_TYPES, getLocationType } from "@/lib/location-types";

describe("LOCATION_TYPES", () => {
  it("包含 5 种类型", () => {
    expect(LOCATION_TYPES).toHaveLength(5);
  });
  it("包含 custom 类型", () => {
    const values = LOCATION_TYPES.map((t) => t.value);
    expect(values).toContain("custom");
  });
});

describe("getLocationType", () => {
  it("返回已知类型", () => {
    const result = getLocationType("shelf");
    expect(result.value).toBe("shelf");
    expect(result.label).toBe("货架");
  });
  it("返回 printer 类型", () => {
    expect(getLocationType("printer").value).toBe("printer");
  });
  it("未知类型回退到 custom", () => {
    const result = getLocationType("unknown_type");
    expect(result.value).toBe("custom");
  });
  it("空字符串回退到 custom", () => {
    expect(getLocationType("").value).toBe("custom");
  });
});
