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
  material_type?: string | null;
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
  const [editing, setEditing] = useState(false);
  const [newBrand, setNewBrand] = useState(brand);
  const [saving, setSaving] = useState(false);

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

  async function handleRenameBrand() {
    const trimmed = newBrand.trim();
    if (!trimmed || trimmed === brand) {
      setEditing(false);
      setNewBrand(brand);
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/catalog/brand-rename", {
        method: "POST",
        body: JSON.stringify({ oldBrand: brand, newBrand: trimmed }),
      });
      router.replace(`/catalog/brand/${encodeURIComponent(trimmed)}`);
    } catch {
      setNewBrand(brand);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameBrand(); if (e.key === "Escape") { setEditing(false); setNewBrand(brand); } }}
            />
            <button onClick={handleRenameBrand} disabled={saving} className="text-sm text-primary font-medium whitespace-nowrap">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => { setEditing(false); setNewBrand(brand); }} className="text-sm text-muted-foreground">取消</button>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold flex-1">{brand}</h1>
            <button onClick={() => setEditing(true)} className="text-sm text-primary font-medium">修改品牌</button>
          </>
        )}
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
                    <p className="text-xs text-muted-foreground">{item.material_type || ""}{item.material ? ` ${item.material}` : ""}</p>
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
