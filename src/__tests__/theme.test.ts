import { describe, it, expect } from "vitest";
import { normalizeThemeMode, THEME_MODES } from "@/lib/theme";

describe("normalizeThemeMode", () => {
  it("returns valid values as-is", () => {
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("system")).toBe("system");
  });

  it("falls back to system for null/undefined/invalid values", () => {
    expect(normalizeThemeMode(null)).toBe("system");
    expect(normalizeThemeMode(undefined)).toBe("system");
    expect(normalizeThemeMode("")).toBe("system");
    expect(normalizeThemeMode("LIGHT")).toBe("system");
    expect(normalizeThemeMode("auto")).toBe("system");
  });
});

describe("THEME_MODES", () => {
  it("contains exactly system, light, dark", () => {
    expect([...THEME_MODES]).toEqual(["system", "light", "dark"]);
  });
});
