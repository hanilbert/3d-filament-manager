"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ColorSwatch } from "@/components/ColorSwatch";
import { apiFetch } from "@/lib/fetch";

interface CatalogItem {
  id: string;
  brand: string;
  material: string;
  color_name: string;
  color_hex?: string | null;
  _count: { spools: number };
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = q ? `?q=${encodeURIComponent(q)}` : "";
        const data = await apiFetch<CatalogItem[]>(`/api/catalog${params}`);
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">耗材字典</h1>
        <Link href="/catalog/new" className="text-sm text-primary font-medium">
          + 新建
        </Link>
      </div>

      <div className="p-4 space-y-3">
        <Input
          placeholder="搜索品牌、材质、颜色..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11"
        />

        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">加载中...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              暂无数据，
              <Link href="/catalog/new" className="text-primary underline">
                新建字典
              </Link>
            </p>
          ) : (
            items.map((item) => (
              <Link key={item.id} href={`/catalog/${item.id}`}>
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors">
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
      </div>
    </div>
  );
}
