"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import { apiFetch } from "@/lib/fetch";

interface CatalogItem {
  id: string;
  brand: string;
  material: string;
  material_type?: string | null;
  color_name: string;
  color_hex?: string | null;
  _count: { spools: number };
}

type SortField = "brand" | "material" | "material_type" | "color_name" | "color_hex";
type SortOrder = "asc" | "desc";

interface GroupedItems {
  key: string;
  materialType: string;
  material: string;
  items: CatalogItem[];
}

function normalizeHex(value?: string | null): string {
  return value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
    ? value.toUpperCase()
    : "--";
}

function getSwatchColor(value?: string | null): string {
  const normalized = normalizeHex(value);
  return normalized === "--" ? "#e5e7eb" : normalized;
}

export default function BrandDetailPage() {
  const { brand: encodedBrand } = useParams<{ brand: string }>();
  const brand = decodeURIComponent(encodedBrand);
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("color_name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          brand,
          sortBy,
          sortOrder,
        });
        const data = await apiFetch<CatalogItem[]>(`/api/catalog?${params.toString()}`);
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brand, sortBy, sortOrder]);

  const groupedItems = useMemo<GroupedItems[]>(() => {
    const groups = new Map<string, GroupedItems>();
    for (const item of items) {
      const materialType = item.material_type?.trim() || "未分类";
      const material = item.material?.trim() || "未命名类型";
      const key = `${materialType}__${material}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          key,
          materialType,
          material,
          items: [item],
        });
      }
    }
    return Array.from(groups.values());
  }, [items]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortOrder("asc");
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    const isActive = sortBy === field;
    const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-lg md:max-w-6xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">{brand}</h1>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">该品牌暂无耗材</p>
        ) : (
          <>
            <div className="hidden md:block border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                      <SortHeader field="brand" label="品牌" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                      <SortHeader field="material_type" label="材料" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                      <SortHeader field="material" label="类型" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                      <SortHeader field="color_name" label="颜色" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                      <SortHeader field="color_hex" label="RGB HEX" />
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const colorHex = normalizeHex(item.color_hex);
                    const swatchColor = getSwatchColor(item.color_hex);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/70 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/catalog/${item.id}`)}
                      >
                        <td className="px-4 py-3">{item.brand}</td>
                        <td className="px-4 py-3">{item.material_type || "-"}</td>
                        <td className="px-4 py-3">{item.material || "-"}</td>
                        <td className="px-4 py-3">{item.color_name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-block w-24 h-8 rounded-md border border-border/60"
                              style={{ backgroundColor: swatchColor }}
                            />
                            <span className="font-mono text-xs">{colorHex}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/catalog/${item.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
                          >
                            修改耗材
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {groupedItems.map((group) => (
                <section key={group.key} className="border border-border rounded-lg overflow-hidden bg-card">
                  <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                    <p className="text-sm font-medium">{group.materialType}</p>
                    <p className="text-xs text-muted-foreground">{group.material}</p>
                  </div>

                  <div>
                    {group.items.map((item) => (
                      <div key={item.id} className="px-4 py-3 border-b border-border/60 last:border-0 flex items-center gap-3">
                        <Link href={`/catalog/${item.id}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <ColorSwatch colorHex={item.color_hex} size="md" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.color_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{normalizeHex(item.color_hex)}</p>
                            </div>
                          </div>
                        </Link>

                        <Link
                          href={`/catalog/${item.id}/edit`}
                          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          修改耗材
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
