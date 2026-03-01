import { describe, it, expect } from "vitest";
import {
  classifyHueGroup,
  parseGroupMode,
  HUE_GROUP_LABELS,
  HUE_GROUP_ORDER,
  type HueGroup,
} from "@/lib/color-hue";

describe("classifyHueGroup", () => {
  it("returns unknown for null/undefined/empty and invalid hex", () => {
    expect(classifyHueGroup(null)).toBe("unknown");
    expect(classifyHueGroup(undefined)).toBe("unknown");
    expect(classifyHueGroup("")).toBe("unknown");
    expect(classifyHueGroup("123456")).toBe("unknown");
    expect(classifyHueGroup("#12")).toBe("unknown");
    expect(classifyHueGroup("#GGGGGG")).toBe("unknown");
  });

  it("supports 3-digit and 6-digit hex", () => {
    expect(classifyHueGroup("#f00")).toBe("red");
    expect(classifyHueGroup("#00ff00")).toBe("green");
    expect(classifyHueGroup("#00F")).toBe("blue");
  });

  it("classifies black, white, and low-saturation gray", () => {
    expect(classifyHueGroup("#000000")).toBe("black");
    expect(classifyHueGroup("#0a0a0a")).toBe("black");
    expect(classifyHueGroup("#FFFFFF")).toBe("white");
    expect(classifyHueGroup("#F5F5F5")).toBe("white");
    expect(classifyHueGroup("#808080")).toBe("gray");
    expect(classifyHueGroup("#333333")).toBe("gray");
  });

  it("classifies representative hue groups", () => {
    expect(classifyHueGroup("#ff0000")).toBe("red");
    expect(classifyHueGroup("#ff8000")).toBe("orange");
    expect(classifyHueGroup("#ffff00")).toBe("yellow");
    expect(classifyHueGroup("#80ff00")).toBe("lime");
    expect(classifyHueGroup("#00ff00")).toBe("green");
    expect(classifyHueGroup("#00ffd5")).toBe("teal");
    expect(classifyHueGroup("#00bfff")).toBe("cyan");
    expect(classifyHueGroup("#0066ff")).toBe("blue");
    expect(classifyHueGroup("#3300ff")).toBe("indigo");
    expect(classifyHueGroup("#aa00ff")).toBe("purple");
    expect(classifyHueGroup("#ff00ff")).toBe("magenta");
    expect(classifyHueGroup("#ff0080")).toBe("magenta");
    // pink requires hue >= 330 and < 345, e.g. #ff6699
    expect(classifyHueGroup("#ff6699")).toBe("pink");
  });
});

describe("parseGroupMode", () => {
  it("parses brand and hue as-is", () => {
    expect(parseGroupMode("brand")).toBe("brand");
    expect(parseGroupMode("hue")).toBe("hue");
  });

  it("falls back to material for material/null/invalid values", () => {
    expect(parseGroupMode("material")).toBe("material");
    expect(parseGroupMode(null)).toBe("material");
    expect(parseGroupMode("foo")).toBe("material");
    expect(parseGroupMode("")).toBe("material");
  });
});

describe("HUE_GROUP_LABELS and HUE_GROUP_ORDER", () => {
  it("HUE_GROUP_ORDER contains all groups from HUE_GROUP_LABELS", () => {
    const labelKeys = Object.keys(HUE_GROUP_LABELS) as HueGroup[];
    for (const key of labelKeys) {
      expect(HUE_GROUP_ORDER).toContain(key);
    }
  });

  it("HUE_GROUP_LABELS has entry for every group in HUE_GROUP_ORDER", () => {
    for (const group of HUE_GROUP_ORDER) {
      expect(HUE_GROUP_LABELS[group]).toBeDefined();
      expect(typeof HUE_GROUP_LABELS[group]).toBe("string");
    }
  });

  it("HUE_GROUP_ORDER has no duplicates", () => {
    const unique = new Set(HUE_GROUP_ORDER);
    expect(unique.size).toBe(HUE_GROUP_ORDER.length);
  });
});
