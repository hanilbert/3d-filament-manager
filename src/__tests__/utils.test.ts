import { describe, it, expect } from "vitest";
import { cn, formatDate } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to zh-CN locale", () => {
    const result = formatDate("2024-01-15T00:00:00.000Z");
    expect(result).toMatch(/2024/);
  });

  it("returns a non-empty string for valid dates", () => {
    const result = formatDate("2023-06-01");
    expect(result.length).toBeGreaterThan(0);
  });
});
