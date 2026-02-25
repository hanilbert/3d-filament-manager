import { describe, it, expect } from "vitest";
import {
  normalizeUpcGtin,
  isValidUpcGtin,
  parseBodyUpcGtin,
  parseQueryUpcGtin,
} from "@/lib/upc-gtin";

describe("normalizeUpcGtin", () => {
  it("移除空格", () => {
    expect(normalizeUpcGtin("012 345 678905")).toBe("012345678905");
  });
  it("移除连字符", () => {
    expect(normalizeUpcGtin("0123-4567-8905")).toBe("012345678905");
  });
  it("纯数字不变", () => {
    expect(normalizeUpcGtin("012345678905")).toBe("012345678905");
  });
  it("空字符串返回空字符串", () => {
    expect(normalizeUpcGtin("")).toBe("");
  });
});

describe("isValidUpcGtin", () => {
  it("8位有效", () => expect(isValidUpcGtin("12345678")).toBe(true));
  it("12位有效", () => expect(isValidUpcGtin("012345678905")).toBe(true));
  it("13位有效", () => expect(isValidUpcGtin("0123456789012")).toBe(true));
  it("14位有效", () => expect(isValidUpcGtin("01234567890128")).toBe(true));
  it("非法长度返回 false", () => expect(isValidUpcGtin("123456789")).toBe(false));
  it("含字母返回 false", () => expect(isValidUpcGtin("01234567890A")).toBe(false));
  it("空字符串返回 false", () => expect(isValidUpcGtin("")).toBe(false));
});

describe("parseBodyUpcGtin", () => {
  it("undefined → provided:false", () => {
    expect(parseBodyUpcGtin(undefined)).toEqual({ provided: false, normalized: null, error: null });
  });
  it("null → provided:true, normalized:null, 无错误", () => {
    expect(parseBodyUpcGtin(null)).toEqual({ provided: true, normalized: null, error: null });
  });
  it("非字符串 → 错误", () => {
    expect(parseBodyUpcGtin(123)).toEqual({ provided: true, normalized: null, error: "UPC/GTIN 格式无效" });
  });
  it("空字符串 → provided:true, normalized:null, 无错误", () => {
    expect(parseBodyUpcGtin("")).toEqual({ provided: true, normalized: null, error: null });
  });
  it("有效 UPC-A → 返回 normalized", () => {
    expect(parseBodyUpcGtin("012345678905")).toEqual({ provided: true, normalized: "012345678905", error: null });
  });
  it("带空格的有效 UPC → 返回 normalized", () => {
    expect(parseBodyUpcGtin("0123 4567 8905")).toEqual({ provided: true, normalized: "012345678905", error: null });
  });
  it("非法格式 → 错误", () => {
    expect(parseBodyUpcGtin("123")).toEqual({ provided: true, normalized: null, error: "UPC/GTIN 格式无效" });
  });
});

describe("parseQueryUpcGtin", () => {
  it("null → provided:false", () => {
    expect(parseQueryUpcGtin(null)).toEqual({ provided: false, normalized: null, error: null });
  });
  it("有效 UPC → 返回 normalized", () => {
    expect(parseQueryUpcGtin("012345678905")).toEqual({ provided: true, normalized: "012345678905", error: null });
  });
  it("空字符串 → 错误", () => {
    expect(parseQueryUpcGtin("")).toEqual({ provided: true, normalized: null, error: "UPC/GTIN 格式无效" });
  });
  it("非法格式 → 错误", () => {
    expect(parseQueryUpcGtin("abc")).toEqual({ provided: true, normalized: null, error: "UPC/GTIN 格式无效" });
  });
});
