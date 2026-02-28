"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { apiFetch } from "@/lib/fetch";

interface MaterialRow {
  material: string;
  count: number;
}

interface MaterialTypeRow {
  materialType: string;
  count: number;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [materialData, materialTypeData] = await Promise.all([
          apiFetch<MaterialRow[]>("/api/filaments?groupBy=material"),
          apiFetch<MaterialTypeRow[]>("/api/filaments?groupBy=materialType"),
        ]);
        if (!cancelled) {
          setMaterials(materialData);
          setMaterialTypes(materialTypeData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedMaterials = [...materials].sort((a, b) => a.material.localeCompare(b.material));
  const sortedMaterialTypes = [...materialTypes].sort((a, b) => a.materialType.localeCompare(b.materialType));

  return (
    <PageShell size="wide">
      <PageHeader
        title="材料"
        actions={
          <Link href="/filaments/new" className="text-sm font-medium text-primary">
            + 新建
          </Link>
        }
      />

      <div className="app-content">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : sortedMaterials.length === 0 && sortedMaterialTypes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            暂无数据，
            <Link href="/filaments/new" className="text-primary underline">新建耗材</Link>
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">材料</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">耗材数</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">暂无材料数据</td>
                    </tr>
                  ) : (
                    sortedMaterials.map((item) => (
                      <tr key={item.material} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          {item.material ? (
                            <Link href={`/filaments/material/${encodeURIComponent(item.material)}`} className="font-medium hover:text-primary transition-colors">
                              {item.material}
                            </Link>
                          ) : (
                            <span className="font-medium">未命名材料</span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3 tabular-nums">{item.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">材料类型</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">耗材数</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMaterialTypes.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">暂无材料类型数据</td>
                    </tr>
                  ) : (
                    sortedMaterialTypes.map((item) => (
                      <tr key={item.materialType || "__empty"} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{item.materialType || "未命名类型"}</td>
                        <td className="text-right px-4 py-3 tabular-nums">{item.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
