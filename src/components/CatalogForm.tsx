"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/fetch";
import { getToken } from "@/lib/fetch";

interface FormValues {
  brand: string;
  material: string;
  color_name: string;
  color_hex: string;
  nozzle_temp: string;
  bed_temp: string;
  print_speed: string;
  logo_url: string;
}

interface CatalogFormProps {
  initialValues?: Partial<FormValues>;
  catalogId?: string; // 有则为编辑模式
}

const DEFAULT: FormValues = {
  brand: "",
  material: "",
  color_name: "",
  color_hex: "",
  nozzle_temp: "",
  bed_temp: "",
  print_speed: "",
  logo_url: "",
};

export function CatalogForm({ initialValues, catalogId }: CatalogFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ ...DEFAULT, ...initialValues });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPrintParams, setShowPrintParams] = useState(
    !!(initialValues?.nozzle_temp || initialValues?.bed_temp || initialValues?.print_speed)
  );

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
      const body = {
        ...values,
        color_hex: values.color_hex || undefined,
        logo_url: values.logo_url || undefined,
        nozzle_temp: values.nozzle_temp || undefined,
        bed_temp: values.bed_temp || undefined,
        print_speed: values.print_speed || undefined,
      };

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
        <Input id="brand" value={values.brand} onChange={(e) => update("brand", e.target.value)} placeholder="如：Bambu Lab" required className="h-12" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="material">材质 *</Label>
        <Input id="material" value={values.material} onChange={(e) => update("material", e.target.value)} placeholder="如：PLA Matte" required className="h-12" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color_name">颜色名称 *</Label>
        <Input id="color_name" value={values.color_name} onChange={(e) => update("color_name", e.target.value)} placeholder="如：草绿 11500" required className="h-12" />
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

      {/* 打印参数（选填）- 可折叠 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPrintParams(!showPrintParams)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span>打印参数（选填）</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform ${showPrintParams ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPrintParams && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <Label htmlFor="nozzle_temp">喷嘴温度</Label>
              <Input id="nozzle_temp" value={values.nozzle_temp} onChange={(e) => update("nozzle_temp", e.target.value)} placeholder="如：190-230°C" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bed_temp">热床温度</Label>
              <Input id="bed_temp" value={values.bed_temp} onChange={(e) => update("bed_temp", e.target.value)} placeholder="如：35-45°C" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="print_speed">打印速度</Label>
              <Input id="print_speed" value={values.print_speed} onChange={(e) => update("print_speed", e.target.value)} placeholder="如：≤300 mm/s" className="h-12" />
            </div>
          </div>
        )}
      </div>

      {/* Logo 管理 */}
      <div className="space-y-2">
        <Label>品牌 Logo（选填）</Label>
        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1">上传图片</TabsTrigger>
            <TabsTrigger value="url" className="flex-1">外部 URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-2">
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.svg"
              onChange={handleLogoUpload}
              disabled={uploading}
              className="h-12"
            />
            {uploading && <p className="text-xs text-muted-foreground mt-1">上传中...</p>}
            {values.logo_url?.startsWith("/api/logos/") && (
              <p className="text-xs text-green-600 mt-1">Logo 已上传</p>
            )}
          </TabsContent>
          <TabsContent value="url" className="mt-2">
            <Input
              value={values.logo_url?.startsWith("/api/logos/") ? "" : values.logo_url}
              onChange={(e) => update("logo_url", e.target.value)}
              placeholder="https://example.com/logo.png"
              className="h-12"
            />
          </TabsContent>
        </Tabs>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full h-14 text-base" disabled={saving || uploading}>
        {saving ? "保存中..." : catalogId ? "保存修改" : "创建耗材"}
      </Button>
    </form>
  );
}
