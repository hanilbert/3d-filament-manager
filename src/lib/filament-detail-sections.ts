import { GlobalFilament } from "@/lib/types";

export type DetailLayout = "list" | "metric";

export interface DetailItem {
  label: string;
  value?: string | null;
}

export interface DetailSectionConfig {
  key: string;
  title: string;
  layout: DetailLayout;
  columns?: 2 | 3 | 4;
  items: DetailItem[];
}

export function hasDetailValue(value?: string | null): boolean {
  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

export function hasVisibleItems(items: DetailItem[]): boolean {
  return items.some((item) => hasDetailValue(item.value));
}

type FilamentDetailSource = Omit<GlobalFilament, "id" | "created_at">;

export function getFilamentDetailSections(filament: FilamentDetailSource): DetailSectionConfig[] {
  return [
    {
      key: "basic",
      title: "基础信息",
      layout: "list",
      items: [
        { label: "品牌", value: filament.brand },
        { label: "材料", value: filament.material_type },
        { label: "类型", value: filament.material },
        { label: "颜色名称", value: filament.color_name },
        { label: "颜色 HEX", value: filament.color_hex },
      ],
    },
    {
      key: "technical",
      title: "技术细节",
      layout: "list",
      items: [
        { label: "密度", value: filament.density },
        { label: "直径", value: filament.diameter },
        { label: "标称重量", value: filament.nominal_weight },
        { label: "软化温度", value: filament.softening_temp },
        { label: "默认打印速度", value: filament.print_speed },
        { label: "腔室温度", value: filament.chamber_temp },
        { label: "熨烫流量", value: filament.ironing_flow },
        { label: "熨烫速度", value: filament.ironing_speed },
        { label: "收缩率", value: filament.shrinkage },
        { label: "空卷重量", value: filament.empty_spool_weight },
        { label: "压力提前 K 值", value: filament.pressure_advance },
      ],
    },
    {
      key: "temperature",
      title: "温度",
      layout: "metric",
      columns: 2,
      items: [
        { label: "喷嘴温度", value: filament.nozzle_temp },
        { label: "热床温度", value: filament.bed_temp },
        { label: "腔室温度", value: filament.chamber_temp },
      ],
    },
    {
      key: "fan",
      title: "风扇速度",
      layout: "metric",
      columns: 2,
      items: [
        { label: "最小风扇", value: filament.fan_min },
        { label: "最大风扇", value: filament.fan_max },
      ],
    },
    {
      key: "first-layer",
      title: "首层速度",
      layout: "metric",
      columns: 4,
      items: [
        { label: "墙速度", value: filament.first_layer_walls },
        { label: "填充速度", value: filament.first_layer_infill },
        { label: "外墙速度", value: filament.first_layer_outer_wall },
        { label: "顶面速度", value: filament.first_layer_top_surface },
      ],
    },
    {
      key: "other-layer",
      title: "其他层速度",
      layout: "metric",
      columns: 4,
      items: [
        { label: "墙速度", value: filament.other_layers_walls },
        { label: "填充速度", value: filament.other_layers_infill },
        { label: "外墙速度", value: filament.other_layers_outer_wall },
        { label: "顶面速度", value: filament.other_layers_top_surface },
      ],
    },
    {
      key: "flow",
      title: "流动特性",
      layout: "metric",
      columns: 2,
      items: [
        { label: "最大体积速度", value: filament.max_volumetric_speed },
        { label: "流量比", value: filament.flow_ratio },
      ],
    },
    {
      key: "drying",
      title: "干燥信息",
      layout: "metric",
      columns: 2,
      items: [
        { label: "干燥温度", value: filament.drying_temp },
        { label: "干燥时间", value: filament.dry_time },
      ],
    },
    {
      key: "color-data",
      title: "测试颜色数据",
      layout: "metric",
      columns: 3,
      items: [
        { label: "实测 RGB", value: filament.measured_rgb },
        { label: "最高投票 TD", value: filament.top_voted_td },
        { label: "TD 投票数", value: filament.num_td_votes },
      ],
    },
    {
      key: "compatibility",
      title: "兼容性",
      layout: "list",
      items: [
        { label: "AMS 兼容性", value: filament.ams_compatibility },
        { label: "适用热床板", value: filament.build_plates },
      ],
    },
  ];
}
