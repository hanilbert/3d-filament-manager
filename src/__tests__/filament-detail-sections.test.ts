import { describe, it, expect } from "vitest";
import {
  hasDetailValue,
  hasVisibleItems,
  getFilamentDetailSections,
} from "@/lib/filament-detail-sections";
import type { DetailItem } from "@/lib/filament-detail-sections";

describe("hasDetailValue", () => {
  it("非空字符串返回 true", () => expect(hasDetailValue("hello")).toBe(true));
  it("空字符串返回 false", () => expect(hasDetailValue("")).toBe(false));
  it("纯空格返回 false", () => expect(hasDetailValue("   ")).toBe(false));
  it("null 返回 false", () => expect(hasDetailValue(null)).toBe(false));
  it("undefined 返回 false", () => expect(hasDetailValue(undefined)).toBe(false));
});

describe("hasVisibleItems", () => {
  it("有非空 value 的 item 返回 true", () => {
    const items: DetailItem[] = [{ label: "A", value: "val" }];
    expect(hasVisibleItems(items)).toBe(true);
  });
  it("全部 value 为空返回 false", () => {
    const items: DetailItem[] = [{ label: "A", value: null }, { label: "B" }];
    expect(hasVisibleItems(items)).toBe(false);
  });
  it("空数组返回 false", () => {
    expect(hasVisibleItems([])).toBe(false);
  });
});

describe("getFilamentDetailSections", () => {
  const minimalFilament = {
    brand: "Bambu",
    material: "PLA",
    variant: "Basic",
    color_name: "白色",
    color_hex: "#FFFFFF",
    density: null, diameter: null, nominal_weight: null,
    softening_temp: null, print_speed: null, chamber_temp: null,
    ironing_flow: null, ironing_speed: null, shrinkage: null,
    empty_spool_weight: null, pressure_advance: null,
    nozzle_temp: null, bed_temp: null,
    fan_min: null, fan_max: null,
    first_layer_walls: null, first_layer_infill: null,
    first_layer_outer_wall: null, first_layer_top_surface: null,
    other_layers_walls: null, other_layers_infill: null,
    other_layers_outer_wall: null, other_layers_top_surface: null,
    max_volumetric_speed: null, flow_ratio: null,
    drying_temp: null, dry_time: null,
    measured_rgb: null, top_voted_td: null, num_td_votes: null,
    ams_compatibility: null, build_plates: null,
    upc_gtin: null,
  };

  it("返回 10 个 section", () => {
    const sections = getFilamentDetailSections(minimalFilament);
    expect(sections).toHaveLength(10);
  });

  it("第一个 section key 为 basic", () => {
    const sections = getFilamentDetailSections(minimalFilament);
    expect(sections[0].key).toBe("basic");
  });

  it("basic section 包含品牌信息", () => {
    const sections = getFilamentDetailSections(minimalFilament);
    const basic = sections.find((s) => s.key === "basic")!;
    const brandItem = basic.items.find((i) => i.label === "品牌");
    expect(brandItem?.value).toBe("Bambu");
  });

  it("temperature section layout 为 metric", () => {
    const sections = getFilamentDetailSections(minimalFilament);
    const temp = sections.find((s) => s.key === "temperature")!;
    expect(temp.layout).toBe("metric");
  });
});
