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
  materialTypes: string[];
  spoolCount: number;
}

interface CatalogItem {
  id: string;
  brand: string;
  material: string;
  material_type?: string | null;
  color_name: string;
  color_hex?: string | null;
  _count: { spools: number };
}

export default function CatalogPage() {
  const [brands, setBrands] = useState<BrandGroup[]>([]);
  const [searchItems, setSearchItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const isSearching = q.trim().length > 0;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isSearching) {
          const data = await apiFetch<CatalogItem[]>(`/api/catalog?q=${encodeURIComponent(q)}`);
          setSearchItems(data);
        } else {
          const data = await apiFetch<BrandGroup[]>("/api/catalog?groupBy=brand");
          setBrands(data);
        }
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, isSearching]);

  return (
    <div className="mx-auto max-w-lg md:max-w-5xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">品牌</h1>
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
                        {item.brand}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.material_type || ""}{item.material ? ` ${item.material}` : ""} · {item.color_name}
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
        ) : (
          /* 品牌表格视图 */
          <BrandTable brands={brands} />
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

  // 收集所有出现过的材料大类
  const allMaterialTypes = new Set<string>();
  brands.forEach((b) => b.materialTypes.forEach((mt) => allMaterialTypes.add(mt)));
  const materialTypeCols = Array.from(allMaterialTypes).sort();

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">品牌</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">耗材数</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">材料种类</th>
            {materialTypeCols.map((mt) => (
              <th key={mt} className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                {mt}
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
              <td className="text-right px-3 py-3 tabular-nums">{b.materialTypes.length}</td>
              {materialTypeCols.map((mt) => (
                <td key={mt} className="text-right px-3 py-3 tabular-nums text-muted-foreground hidden lg:table-cell">
                  {b.materialTypes.includes(mt) ? "·" : ""}
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
