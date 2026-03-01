"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Palette } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ColorCard } from "@/components/ColorCard";
import { apiFetch } from "@/lib/fetch";
import {
  GroupMode,
  GROUP_MODE_LABELS,
  HUE_GROUP_ORDER,
  HUE_GROUP_LABELS,
  classifyHueGroup,
  parseGroupMode,
} from "@/lib/color-hue";

interface FilamentItem {
  id: string;
  brand: string;
  material: string;
  variant: string;
  color_name: string;
  color_hex?: string | null;
}

const LS_KEY = "colors.groupMode";

function getStoredGroupMode(): GroupMode {
  if (typeof window === "undefined") return "material";
  try {
    return parseGroupMode(localStorage.getItem(LS_KEY));
  } catch {
    return "material";
  }
}

interface ColorGroup {
  key: string;
  label: string;
  items: FilamentItem[];
}

function groupByMaterial(items: FilamentItem[]): ColorGroup[] {
  const map = new Map<string, FilamentItem[]>();
  for (const item of items) {
    const key = item.material.trim() || "未知材料";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, label: key, items: list }));
}

function groupByBrand(items: FilamentItem[]): ColorGroup[] {
  const map = new Map<string, FilamentItem[]>();
  for (const item of items) {
    const key = item.brand.trim() || "未知品牌";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, label: key, items: list }));
}

function groupByHue(items: FilamentItem[]): ColorGroup[] {
  const map = new Map<string, FilamentItem[]>();
  for (const item of items) {
    const hue = classifyHueGroup(item.color_hex);
    const list = map.get(hue) ?? [];
    list.push(item);
    map.set(hue, list);
  }
  return HUE_GROUP_ORDER
    .filter((hue) => map.has(hue))
    .map((hue) => ({ key: hue, label: HUE_GROUP_LABELS[hue], items: map.get(hue)! }));
}

function ColorsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<FilamentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const groupMode = useMemo<GroupMode>(() => {
    if (searchParams.has("group")) {
      return parseGroupMode(searchParams.get("group"));
    }
    return getStoredGroupMode();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<FilamentItem[]>("/api/filaments")
      .then((data) => { if (!cancelled) setItems(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo<ColorGroup[]>(() => {
    if (groupMode === "brand") return groupByBrand(items);
    if (groupMode === "hue") return groupByHue(items);
    return groupByMaterial(items);
  }, [items, groupMode]);

  function handleGroupChange(value: string) {
    const mode = parseGroupMode(value);
    try { localStorage.setItem(LS_KEY, mode); } catch { /* ignore */ }
    const params = new URLSearchParams(searchParams.toString());
    params.set("group", mode);
    router.replace(`/colors?${params.toString()}`);
  }

  const totalCount = items.length;

  return (
    <>
      <PageHeader title="颜色库" />
      <div className="app-content">
        {/* 分组切换器 */}
        <div className="mb-4">
          <Tabs value={groupMode} onValueChange={handleGroupChange}>
            <TabsList>
              {(Object.entries(GROUP_MODE_LABELS) as [GroupMode, string][]).map(([mode, label]) => (
                <TabsTrigger key={mode} value={mode}>{label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border/40 bg-muted/30 animate-pulse">
                <div className="aspect-square w-full bg-muted/50" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Palette className="size-12 opacity-20" />
            <p className="text-sm">暂无颜色数据，请先添加耗材</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="text-xs text-muted-foreground">{group.items.length} 种</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
                  {group.items.map((item) => (
                    <ColorCard
                      key={item.id}
                      id={item.id}
                      colorName={item.color_name}
                      colorHex={item.color_hex}
                      brand={item.brand}
                      material={item.material}
                      variant={item.variant}
                    />
                  ))}
                </div>
              </section>
            ))}
            <p className="pb-2 text-center text-xs text-muted-foreground/60">
              共 {totalCount} 种颜色
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function ColorsPage() {
  return (
    <PageShell>
      <Suspense fallback={
        <div className="app-content pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border/40 bg-muted/30 animate-pulse">
                <div className="aspect-square w-full bg-muted/50" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      }>
        <ColorsContent />
      </Suspense>
    </PageShell>
  );
}
