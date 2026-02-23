"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ColorSwatch } from "@/components/ColorSwatch";
import { apiFetch } from "@/lib/fetch";

interface BrandGroup {
  brand: string;
  logo_url?: string | null;
  count: number;
  materials: string[];
  spoolCount: number;
}

interface MaterialGroup {
  material: string;
  count: number;
  brands: string[];
  spoolCount: number;
}

interface CatalogItem {
  id: string;
  brand: string;
  material: string;
  color_name: string;
  color_hex?: string | null;
  _count: { spools: number };
}

type ViewMode = "brands" | "materials";

export default function CatalogPage() {
  const [brands, setBrands] = useState<BrandGroup[]>([]);
  const [materials, setMaterials] = useState<MaterialGroup[]>([]);
  const [searchItems, setSearchItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("brands");
  const isSearching = q.trim().length > 0;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isSearching) {
          const data = await apiFetch<CatalogItem[]>(`/api/catalog?q=${encodeURIComponent(q)}`);
          setSearchItems(data);
        } else if (view === "brands") {
          const data = await apiFetch<BrandGroup[]>("/api/catalog?groupBy=brand");
          setBrands(data);
        } else {
          const data = await apiFetch<MaterialGroup[]>("/api/catalog?groupBy=material");
          setMaterials(data);
        }
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, isSearching, view]);

  return (
    <div className="mx-auto max-w-lg md:max-w-5xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">品牌与材料</h1>
        <Link href="/catalog/new" className="text-sm text-primary font-medium">
          + 新建
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {/* 搜索 + 视图切换 */}
        <div className="flex gap-2">
          <Input
            placeholder="搜索品牌、材质、颜色..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 flex-1"
          />
        </div>

        {!isSearching && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setView("brands")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                view === "brands"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              品牌
            </button>
            <button
              onClick={() => setView("materials")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                view === "materials"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              材料
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : isSearching ? (
          /* 搜索模式 */
          <div className="space-y-2">
            {searchItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">未找到匹配结果</p>
            ) : (
              searchItems.map((item) => (
                <Link key={item.id} href={`/catalog/${item.id}`}>
                  <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                    <ColorSwatch colorHex={item.color_hex} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.brand} {item.material}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.color_name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {item._count.spools} 卷
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : view === "brands" ? (
          /* 品牌表格视图 */
          <BrandTable brands={brands} />
        ) : (
          /* 材料列表视图 */
          <MaterialList materials={materials} />
        )}
      </div>
    </div>
  );
}

function BrandTable({ brands }: { brands: BrandGroup[] }) {
  if (brands.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        暂无数据，
        <Link href="/catalog/new" className="text-primary underline">新建耗材</Link>
      </p>
    );
  }

  // 收集所有出现过的材料类型
  const allMaterials = new Set<string>();
  brands.forEach((b) => b.materials.forEach((m) => allMaterials.add(m)));
  const materialCols = Array.from(allMaterials).sort();

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">品牌</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">耗材数</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">材料种类</th>
            {materialCols.map((m) => (
              <th key={m} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                {m}
              </th>
            ))}
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">料卷数</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.brand} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/catalog/brand/${encodeURIComponent(b.brand)}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.brand} className="w-7 h-7 rounded object-contain bg-muted/30 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                      {b.brand.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium whitespace-nowrap">{b.brand}</span>
                </Link>
              </td>
              <td className="text-right px-3 py-3 tabular-nums">{b.count}</td>
              <td className="text-right px-3 py-3 tabular-nums">{b.materials.length}</td>
              {materialCols.map((m) => (
                <td key={m} className="text-right px-3 py-3 tabular-nums text-muted-foreground hidden lg:table-cell">
                  {b.materials.includes(m) ? "·" : ""}
                </td>
              ))}
              <td className="text-right px-4 py-3 tabular-nums">{b.spoolCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialList({ materials }: { materials: MaterialGroup[] }) {
  if (materials.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        暂无数据，
        <Link href="/catalog/new" className="text-primary underline">新建耗材</Link>
      </p>
    );
  }

  return (
    <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
      {materials.map((m) => (
        <Link key={m.material} href={`/catalog/material/${encodeURIComponent(m.material)}`}>
          <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{m.material}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {m.brands.length} 个品牌 · {m.count} 种颜色
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium">{m.spoolCount}</p>
              <p className="text-xs text-muted-foreground">卷</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
