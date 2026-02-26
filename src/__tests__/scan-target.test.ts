import { describe, expect, it } from "vitest";
import { parseScanTarget } from "@/lib/scan-target";

const SPOOL_ID = "e4a375b6-9229-4be8-acad-36b591d2e311";
const LOCATION_ID = "2ee7d8f1-2d69-4adc-a6ad-64dc4479d10a";

describe("parseScanTarget", () => {
  it("支持 /spools/{id} 路径", () => {
    expect(parseScanTarget(`/spools/${SPOOL_ID}`)).toEqual({ type: "spool", spoolId: SPOOL_ID });
  });

  it("支持完整域名 URL", () => {
    expect(parseScanTarget(`https://example.com/spools/${SPOOL_ID}?from=qr`)).toEqual({
      type: "spool",
      spoolId: SPOOL_ID,
    });
  });

  it("支持纯 UUID（按线轴识别）", () => {
    expect(parseScanTarget(SPOOL_ID)).toEqual({ type: "spool", spoolId: SPOOL_ID });
  });

  it("支持位置二维码 URL", () => {
    expect(parseScanTarget(`https://example.com/location/${LOCATION_ID}`)).toEqual({
      type: "location",
      locationId: LOCATION_ID,
    });
  });

  it("支持 UPC/GTIN 识别", () => {
    expect(parseScanTarget("0123 4567 8905")).toEqual({
      type: "upc_gtin",
      upcGtin: "012345678905",
    });
  });

  it("未知内容返回 unknown", () => {
    expect(parseScanTarget("hello-world")).toEqual({ type: "unknown" });
  });
});
