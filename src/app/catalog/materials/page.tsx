"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";

interface MaterialGroup {
  material: string;
  count: number;
  brands: string[];
  spoolCount: number;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<MaterialGroup[]>("/api/catalog?groupBy=material");
        setMaterials(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">材料分类</h1>
        <Link href="/catalog/new" className="text-sm text-primary font-medium">
          + 新建
        </Link>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            暂无数据，
            <Link href="/catalog/new" className="text-primary underline">新建耗材</Link>
          </p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
