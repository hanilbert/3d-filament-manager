"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/fetch";

interface VariantGroup {
  variant: string;
  brandCount: number;
  colorCount: number;
  spoolCount: number;
}

export default function MaterialTypePage() {
  const { type: encodedType } = useParams<{ type: string }>();
  const material = decodeURIComponent(encodedType);
  const router = useRouter();
  const [variants, setVariants] = useState<VariantGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<VariantGroup[]>(
          `/api/filaments?groupBy=variant&material=${encodeURIComponent(material)}`
        );
        setVariants(data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [material]);

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-semibold">{material}</h1>
        <span className="text-sm text-muted-foreground ml-auto">细分类型</span>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : variants.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">该材料暂无细分类型</p>
        ) : (
          <div className="space-y-2">
            {variants.map((v) => (
              <Link key={v.variant || "__none"} href={`/filaments/material/${encodeURIComponent(material)}?variant=${encodeURIComponent(v.variant || "")}`}>
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-sm font-semibold">{(v.variant || "-").slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{v.variant || "未命名细分"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{v.brandCount} 个品牌 · {v.colorCount} 种颜色</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">{v.spoolCount}</p>
                    <p className="text-xs text-muted-foreground">轴</p>
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
