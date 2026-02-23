"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

export default function BrandDetailPage() {
  const { brand: encodedBrand } = useParams<{ brand: string }>();
  const brand = decodeURIComponent(encodedBrand);
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<CatalogItem[]>(
          `/api/catalog?brand=${encodeURIComponent(brand)}`
        );
        setItems(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [brand]);

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">{brand}</h1>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">该品牌暂无耗材</p>
        ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
            {items.map((item) => (
              <Link key={item.id} href={`/catalog/${item.id}`}>
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                  <ColorSwatch colorHex={item.color_hex} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.color_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.material}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {item._count.spools} 卷
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
