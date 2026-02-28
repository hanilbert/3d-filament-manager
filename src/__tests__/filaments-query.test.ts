import { describe, expect, it } from "vitest";
import {
  aggregateMaterialTypeCounts,
  buildTextSearchCondition,
  parseExactSearchParam,
} from "@/lib/filaments-query";

describe("filaments query helpers", () => {
  it("exact=1 时材料过滤使用 equals，避免误匹配", () => {
    const exact = parseExactSearchParam("1");
    const condition = buildTextSearchCondition("PLA", exact);

    expect(condition).toEqual({ equals: "PLA" });
  });

  it("未开启 exact 时保持 contains 模糊匹配", () => {
    const exact = parseExactSearchParam(null);
    const condition = buildTextSearchCondition("PLA", exact);

    expect(condition).toEqual({ contains: "PLA" });
  });

  it("材料类型聚合可正确统计并保留空类型", () => {
    const result = aggregateMaterialTypeCounts([
      { variant: "Basic" },
      { variant: "Basic" },
      { variant: "" },
      { variant: " " },
      { variant: "CF" },
    ]);

    expect(result).toEqual([
      { materialType: "", count: 2 },
      { materialType: "Basic", count: 2 },
      { materialType: "CF", count: 1 },
    ]);
  });
});
