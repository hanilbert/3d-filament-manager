"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCATION_TYPES, type LocationType } from "@/lib/location-types";
import { apiFetch } from "@/lib/fetch";

interface FormValues {
  name: string;
  type: LocationType;
  is_default: boolean;
  printer_name: string;
  ams_unit: string;
  ams_slot: string;
}

interface LocationFormProps {
  initialValues?: Partial<FormValues>;
  locationId?: string;
}

const DEFAULT: FormValues = {
  name: "",
  type: "custom",
  is_default: false,
  printer_name: "",
  ams_unit: "",
  ams_slot: "",
};

export function LocationForm({ initialValues, locationId }: LocationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ ...DEFAULT, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const body = {
        name: values.name,
        type: values.type,
        is_default: values.is_default,
        printer_name: values.type === "ams_slot" ? values.printer_name : undefined,
        ams_unit: values.type === "ams_slot" ? values.ams_unit : undefined,
        ams_slot: values.type === "ams_slot" ? values.ams_slot : undefined,
      };

      if (locationId) {
        await apiFetch(`/api/locations/${locationId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        router.push(`/location/${locationId}`);
      } else {
        const created = await apiFetch<{ id: string }>("/api/locations", {
          method: "POST",
          body: JSON.stringify(body),
        });
        router.push(`/location/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* 类型选择 */}
      <div className="space-y-2">
        <Label>位置类型 *</Label>
        <div className="grid grid-cols-2 gap-2">
          {LOCATION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update("type", t.value)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                values.type === t.value
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 名称 */}
      <div className="space-y-2">
        <Label htmlFor="name">名称 *</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="如：防潮箱 A"
          required
          className="h-12"
        />
      </div>

      {/* 默认位置 */}
      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
        <div>
          <p className="text-sm font-medium">设为默认位置</p>
          <p className="text-xs text-muted-foreground">新料卷将自动分配到此位置</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={values.is_default}
          onClick={() => update("is_default", !values.is_default)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            values.is_default ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              values.is_default ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* AMS Slot 条件字段 */}
      {values.type === "ams_slot" && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">AMS 插槽信息</p>
          <div className="space-y-2">
            <Label htmlFor="printer_name">打印机名称 *</Label>
            <Input
              id="printer_name"
              value={values.printer_name}
              onChange={(e) => update("printer_name", e.target.value)}
              placeholder="如：X1C-01"
              required
              className="h-12"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ams_unit">AMS 单元 *</Label>
              <Input
                id="ams_unit"
                value={values.ams_unit}
                onChange={(e) => update("ams_unit", e.target.value)}
                placeholder="如：1"
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ams_slot">插槽号 *</Label>
              <Input
                id="ams_slot"
                value={values.ams_slot}
                onChange={(e) => update("ams_slot", e.target.value)}
                placeholder="如：1"
                required
                className="h-12"
              />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full h-14 text-base" disabled={saving}>
        {saving ? "保存中..." : locationId ? "保存修改" : "创建位置"}
      </Button>
    </form>
  );
}
