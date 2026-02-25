"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetch";
import { getToken } from "@/lib/fetch";
import { ChevronDown } from "lucide-react";

interface BrandOption {
  brand: string;
  logo_url: string | null;
}

interface FormValues {
  brand: string;
  material_type: string;
  material: string;
  color_name: string;
  upc_gtin: string;
  color_hex: string;
  nozzle_temp: string;
  bed_temp: string;
  print_speed: string;
  logo_url: string;
  // Technical Details
  density: string;
  diameter: string;
  nominal_weight: string;
  softening_temp: string;
  chamber_temp: string;
  ironing_flow: string;
  ironing_speed: string;
  shrinkage: string;
  empty_spool_weight: string;
  pressure_advance: string;
  // Fan Speed
  fan_min: string;
  fan_max: string;
  // First Layer Speeds
  first_layer_walls: string;
  first_layer_infill: string;
  first_layer_outer_wall: string;
  first_layer_top_surface: string;
  // Other Layers
  other_layers_walls: string;
  other_layers_infill: string;
  other_layers_outer_wall: string;
  other_layers_top_surface: string;
  // Tested Color Data
  measured_rgb: string;
  top_voted_td: string;
  num_td_votes: string;
  // Flow Characteristics
  max_volumetric_speed: string;
  flow_ratio: string;
  // Drying Info
  drying_temp: string;
  dry_time: string;
  // AMS & Build Plates
  ams_compatibility: string;
  build_plates: string;
}

interface CatalogFormProps {
  initialValues?: Partial<FormValues>;
  catalogId?: string; // 有则为编辑模式
}

const DEFAULT: FormValues = {
  brand: "",
  material_type: "",
  material: "",
  color_name: "",
  upc_gtin: "",
  color_hex: "",
  nozzle_temp: "",
  bed_temp: "",
  print_speed: "",
  logo_url: "",
  density: "",
  diameter: "",
  nominal_weight: "",
  softening_temp: "",
  chamber_temp: "",
  ironing_flow: "",
  ironing_speed: "",
  shrinkage: "",
  empty_spool_weight: "",
  pressure_advance: "",
  fan_min: "",
  fan_max: "",
  first_layer_walls: "",
  first_layer_infill: "",
  first_layer_outer_wall: "",
  first_layer_top_surface: "",
  other_layers_walls: "",
  other_layers_infill: "",
  other_layers_outer_wall: "",
  other_layers_top_surface: "",
  measured_rgb: "",
  top_voted_td: "",
  num_td_votes: "",
  max_volumetric_speed: "",
  flow_ratio: "",
  drying_temp: "",
  dry_time: "",
  ams_compatibility: "",
  build_plates: "",
};

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function FormField({ label, field, placeholder, values, update }: { label: string; field: keyof FormValues; placeholder: string; values: FormValues; update: (f: keyof FormValues, v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input id={field} value={values[field]} onChange={(e) => update(field, e.target.value)} placeholder={placeholder} className="h-12" />
    </div>
  );
}

export function CatalogForm({ initialValues, catalogId }: CatalogFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ ...DEFAULT, ...initialValues });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [materialTypes, setMaterialTypes] = useState<string[]>([]);
  const [brandList, setBrandList] = useState<BrandOption[]>([]);
  const [brandMode, setBrandMode] = useState<"select" | "custom">(
    initialValues?.brand ? "select" : "select"
  );
  const MATERIAL_PRESETS = [
    "PLA", "PLA+/Pro", "PETG", "ABS", "ABS+", "APLA", "ASA", "ASA+",
    "CoPA", "CPE", "HIPS", "HT-PLA", "PA (Nylon)", "PA12", "PA6", "PA612",
    "PAHT", "PBT", "PC", "PC-ABS", "PCL", "PCTG", "PE", "PEBA", "PEEK",
    "PET", "PETG+", "PHA", "PIPG", "PMMA", "PP", "PPA", "PPS", "PVA",
    "PVB", "SAN", "SBS", "SMP", "TPE", "TPR", "TPU",
  ];
  const allMaterialOptions = Array.from(new Set([...MATERIAL_PRESETS, ...materialTypes])).sort();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const iv = initialValues || {};
    return {
      filamentType: !!(iv.density || iv.diameter || iv.nominal_weight || iv.softening_temp || iv.shrinkage || iv.empty_spool_weight || iv.drying_temp || iv.dry_time || iv.ams_compatibility || iv.build_plates),
      color: !!(iv.measured_rgb || iv.top_voted_td || iv.num_td_votes),
      settingsOverrides: !!(iv.nozzle_temp || iv.bed_temp || iv.print_speed || iv.chamber_temp || iv.fan_min || iv.fan_max || iv.ironing_flow || iv.ironing_speed || iv.pressure_advance || iv.max_volumetric_speed || iv.flow_ratio || iv.first_layer_walls || iv.other_layers_walls),
    };
  });

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Load existing material types and brand list for dropdowns
  useEffect(() => {
    async function loadTypes() {
      try {
        const data = await apiFetch<{ material_type: string }[]>("/api/catalog?groupBy=material");
        setMaterialTypes(data.map((d) => d.material_type));
      } catch {
        // silently fail — user can still type manually
      }
    }
    async function loadBrands() {
      try {
        const data = await apiFetch<BrandOption[]>("/api/catalog?groupBy=brandList");
        setBrandList(data);
      } catch {
        // silently fail
      }
    }
    loadTypes();
    loadBrands();
  }, []);

  function update(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/logo", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error("上传失败");
      const { url } = await res.json();
      update("logo_url", url);
    } catch {
      setError("Logo 上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      // Validate brand is not empty or sentinel value
      const brandVal = values.brand?.trim();
      if (!brandVal || brandVal === "__custom") {
        setError("请选择或输入品牌");
        setSaving(false);
        return;
      }

      // Validate material_type is not empty or sentinel value
      const materialType = values.material_type?.trim();
      if (!materialType || materialType === "__custom") {
        setError("请选择或输入材料");
        setSaving(false);
        return;
      }

      const body: Record<string, string | undefined> = {
        brand: values.brand,
        material_type: materialType,
        material: values.material || undefined,
        color_name: values.color_name,
      };
      const optionalKeys: (keyof FormValues)[] = [
        "upc_gtin",
        "color_hex", "logo_url", "nozzle_temp", "bed_temp", "print_speed",
        "density", "diameter", "nominal_weight", "softening_temp", "chamber_temp",
        "ironing_flow", "ironing_speed", "shrinkage", "empty_spool_weight", "pressure_advance",
        "fan_min", "fan_max",
        "first_layer_walls", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface",
        "other_layers_walls", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface",
        "measured_rgb", "top_voted_td", "num_td_votes",
        "max_volumetric_speed", "flow_ratio",
        "drying_temp", "dry_time",
        "ams_compatibility", "build_plates",
      ];
      for (const k of optionalKeys) {
        body[k] = values[k] || undefined;
      }

      if (catalogId) {
        await apiFetch(`/api/catalog/${catalogId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        router.push(`/catalog/${catalogId}`);
      } else {
        const created = await apiFetch<{ id: string }>("/api/catalog", {
          method: "POST",
          body: JSON.stringify(body),
        });
        router.push(`/catalog/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brand">品牌 *</Label>
        <div className="relative">
          <select
            id="brand"
            value={brandList.some((b) => b.brand === values.brand) ? values.brand : brandMode === "custom" ? "__custom" : values.brand === "" ? "" : "__custom"}
            onChange={(e) => {
              if (e.target.value === "__custom") {
                setBrandMode("custom");
                update("brand", "");
                update("logo_url", "");
              } else {
                setBrandMode("select");
                update("brand", e.target.value);
                const match = brandList.find((b) => b.brand === e.target.value);
                if (match?.logo_url) {
                  update("logo_url", match.logo_url);
                } else {
                  update("logo_url", "");
                }
              }
            }}
            className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none"
            required
          >
            <option value="">选择品牌...</option>
            {brandList.map((b) => (
              <option key={b.brand} value={b.brand}>{b.brand}</option>
            ))}
            <option value="__custom">自定义...</option>
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-4 pointer-events-none text-muted-foreground" />
        </div>
        {brandMode === "custom" && !brandList.some((b) => b.brand === values.brand) && (
          <Input
            value={values.brand}
            onChange={(e) => update("brand", e.target.value)}
            placeholder="输入品牌名称，如：Bambu Lab"
            className="h-12 mt-1"
            autoFocus
            required
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="material_type">材料 *</Label>
        <div className="relative">
          <select
            id="material_type"
            value={allMaterialOptions.includes(values.material_type) ? values.material_type : values.material_type === "" ? "" : "__custom"}
            onChange={(e) => {
              if (e.target.value === "__custom") {
                update("material_type", "");
              } else {
                update("material_type", e.target.value);
              }
            }}
            className="w-full h-12 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none"
          >
            <option value="">选择材料...</option>
            {allMaterialOptions.map((mt) => (
              <option key={mt} value={mt}>{mt}</option>
            ))}
            <option value="__custom">自定义...</option>
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-4 pointer-events-none text-muted-foreground" />
        </div>
        {values.material_type !== "" && !allMaterialOptions.includes(values.material_type) && (
          <Input
            value={values.material_type}
            onChange={(e) => update("material_type", e.target.value)}
            placeholder="输入材料，如：ASA"
            className="h-12 mt-1"
            autoFocus
            required
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="material">类型（选填）</Label>
        <Input id="material" value={values.material} onChange={(e) => update("material", e.target.value)} placeholder="如：Matte、Silk、95A" className="h-12" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color_name">颜色名称 *</Label>
        <Input id="color_name" value={values.color_name} onChange={(e) => update("color_name", e.target.value)} placeholder="如：草绿 11500" required className="h-12" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="upc_gtin">UPC/GTIN（选填）</Label>
        <Input
          id="upc_gtin"
          value={values.upc_gtin}
          onChange={(e) => update("upc_gtin", e.target.value)}
          placeholder="如：6971234567890（支持空格或-）"
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color_hex">颜色 Hex（选填）</Label>
        <div className="flex gap-2 items-center">
          <Input
            id="color_hex"
            type="color"
            value={values.color_hex || "#ffffff"}
            onChange={(e) => update("color_hex", e.target.value)}
            className="w-14 h-12 p-1 cursor-pointer"
          />
          <Input
            value={values.color_hex}
            onChange={(e) => update("color_hex", e.target.value)}
            placeholder="#5C8A3C（可留空）"
            className="flex-1 h-12"
          />
        </div>
      </div>

      {/* Filament Type（耗材属性） */}
      <CollapsibleSection title="Filament Type（耗材属性）" open={openSections.filamentType} onToggle={() => toggleSection("filamentType")}>
        <FormField label="密度" field="density" placeholder="如：1.24g/cm³" values={values} update={update} />
        <FormField label="直径" field="diameter" placeholder="如：1.75mm" values={values} update={update} />
        <FormField label="标称重量" field="nominal_weight" placeholder="如：1000g" values={values} update={update} />
        <FormField label="软化温度" field="softening_temp" placeholder="如：78°C" values={values} update={update} />
        <FormField label="收缩率" field="shrinkage" placeholder="如：0.3%" values={values} update={update} />
        <FormField label="空卷重量" field="empty_spool_weight" placeholder="如：127g" values={values} update={update} />
        <FormField label="干燥温度" field="drying_temp" placeholder="如：70°C" values={values} update={update} />
        <FormField label="干燥时间" field="dry_time" placeholder="如：12小时" values={values} update={update} />
        <FormField label="AMS 兼容性" field="ams_compatibility" placeholder="如：兼容 AMS" values={values} update={update} />
        <FormField label="适用热床板" field="build_plates" placeholder="如：PEI / 纹理板" values={values} update={update} />
      </CollapsibleSection>

      {/* Color（颜色相关） */}
      <CollapsibleSection title="Color（颜色相关）" open={openSections.color} onToggle={() => toggleSection("color")}>
        <FormField label="实测 RGB" field="measured_rgb" placeholder="如：#5C8A3C" values={values} update={update} />
        <FormField label="最高投票 TD 值" field="top_voted_td" placeholder="如：2.5" values={values} update={update} />
        <FormField label="TD 投票数" field="num_td_votes" placeholder="如：12" values={values} update={update} />
      </CollapsibleSection>

      {/* Settings Overrides（打印参数覆盖） */}
      <CollapsibleSection title="Settings Overrides（打印参数覆盖）" open={openSections.settingsOverrides} onToggle={() => toggleSection("settingsOverrides")}>
        <FormField label="喷嘴温度" field="nozzle_temp" placeholder="如：190-230°C" values={values} update={update} />
        <FormField label="热床温度" field="bed_temp" placeholder="如：35-45°C" values={values} update={update} />
        <FormField label="打印速度" field="print_speed" placeholder="如：≤300 mm/s" values={values} update={update} />
        <FormField label="腔体温度" field="chamber_temp" placeholder="如：40°C" values={values} update={update} />
        <FormField label="最小风扇速度" field="fan_min" placeholder="如：10%" values={values} update={update} />
        <FormField label="最大风扇速度" field="fan_max" placeholder="如：80%" values={values} update={update} />
        <FormField label="熨烫流量" field="ironing_flow" placeholder="如：10%" values={values} update={update} />
        <FormField label="熨烫速度" field="ironing_speed" placeholder="如：100mm/s" values={values} update={update} />
        <FormField label="压力提前 K 值" field="pressure_advance" placeholder="如：0.014" values={values} update={update} />
        <FormField label="最大体积速度" field="max_volumetric_speed" placeholder="如：16mm³/s" values={values} update={update} />
        <FormField label="流量比" field="flow_ratio" placeholder="如：0.95" values={values} update={update} />
        <FormField label="首层墙速度" field="first_layer_walls" placeholder="如：50mm/s" values={values} update={update} />
        <FormField label="首层填充速度" field="first_layer_infill" placeholder="如：50mm/s" values={values} update={update} />
        <FormField label="首层外墙速度" field="first_layer_outer_wall" placeholder="如：30mm/s" values={values} update={update} />
        <FormField label="首层顶面速度" field="first_layer_top_surface" placeholder="如：40mm/s" values={values} update={update} />
        <FormField label="其他层墙速度" field="other_layers_walls" placeholder="如：200mm/s" values={values} update={update} />
        <FormField label="其他层填充速度" field="other_layers_infill" placeholder="如：250mm/s" values={values} update={update} />
        <FormField label="其他层外墙速度" field="other_layers_outer_wall" placeholder="如：150mm/s" values={values} update={update} />
        <FormField label="其他层顶面速度" field="other_layers_top_surface" placeholder="如：180mm/s" values={values} update={update} />
      </CollapsibleSection>

      {/* Logo 管理 */}
      <div className="space-y-2">
        <Label>品牌 Logo（选填）</Label>
        {values.logo_url && (
          <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30">
            <img src={values.logo_url} alt="Logo preview" className="w-10 h-10 rounded object-contain" />
            <span className="text-xs text-muted-foreground truncate flex-1">{values.logo_url}</span>
            <button type="button" onClick={() => update("logo_url", "")} className="text-xs text-destructive hover:underline">移除</button>
          </div>
        )}
        <Input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.svg"
          onChange={handleLogoUpload}
          disabled={uploading}
          className="h-12"
        />
        {uploading && <p className="text-xs text-muted-foreground mt-1">上传中...</p>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full h-14 text-base" disabled={saving || uploading}>
        {saving ? "保存中..." : catalogId ? "保存修改" : "创建耗材"}
      </Button>
    </form>
  );
}
