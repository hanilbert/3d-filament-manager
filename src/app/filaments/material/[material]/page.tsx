"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ColorSwatch } from "@/components/ColorSwatch";
import { apiFetch } from "@/lib/fetch";

interface FilamentItem {
  id: string;
  brand: string;
  material: string;
  variant: string;
  color_name: string;
  color_hex?: string | null;
  _count: { spools: number };
}

export default function MaterialDetailPage() {
  const { material: encodedMaterial } = useParams<{ material: string }>();
  const searchParams = useSearchParams();
  const material = decodeURIComponent(encodedMaterial);
  const variant = searchParams.get("variant") || "";
  const router = useRouter();
  const [items, setItems] = useState<FilamentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const query = new URLSearchParams({ material });
        if (variant) query.set("variant", variant);
        const data = await apiFetch<FilamentItem[]>(`/api/filaments?${query.toString()}`);
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [material, variant]);

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-semibold">{variant ? `${material} · ${variant}` : material}</h1>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">该条件下暂无耗材</p>
        ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
            {items.map((item) => (
              <Link key={item.id} href={`/filaments/${item.id}`}>
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                  <ColorSwatch colorHex={item.color_hex} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.color_name}</p>
                    <p className="text-xs text-muted-foreground">{item.brand} · {item.variant || "-"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{item._count.spools} 轴</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
