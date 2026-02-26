"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";

interface MaterialGroup {
  material: string;
  variantCount: number;
  brandCount: number;
  count: number;
  spoolCount: number;
}

export default function MaterialsPage() {
  const [types, setTypes] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<MaterialGroup[]>("/api/filaments?groupBy=material");
        setTypes(data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-lg md:max-w-5xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">材料</h1>
        <Link href="/filaments/new" className="text-sm text-primary font-medium">+ 新建</Link>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : types.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            暂无数据，
            <Link href="/filaments/new" className="text-primary underline">新建耗材</Link>
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">材料</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">细分类型数</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">品牌数</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">耗材数</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">线轴数</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.material} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/filaments/material-type/${encodeURIComponent(t.material)}`} className="font-medium hover:text-primary transition-colors">
                        {t.material}
                      </Link>
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums">{t.variantCount}</td>
                    <td className="text-right px-3 py-3 tabular-nums">{t.brandCount}</td>
                    <td className="text-right px-3 py-3 tabular-nums">{t.count}</td>
                    <td className="text-right px-4 py-3 tabular-nums">{t.spoolCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
