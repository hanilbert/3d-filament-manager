"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilamentDetailSection } from "@/components/FilamentDetailSection";
import { DetailSectionCard } from "@/components/DetailSectionCard";
import { apiFetch } from "@/lib/fetch";
import { getFilamentDetailSections, hasVisibleItems } from "@/lib/filament-detail-sections";
import { GlobalFilament } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

interface CatalogDetail extends GlobalFilament {
  spools: Array<{ id: string }>;
}

export default function CatalogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CatalogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CatalogDetail>(`/api/catalog/${id}`);
      setItem(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAddSpool() {
    setAdding(true);
    try {
      const spool = await apiFetch<{ id: string }>("/api/spools", {
        method: "POST",
        body: JSON.stringify({ global_filament_id: id }),
      });
      router.push(`/spool/${spool.id}`);
    } catch {
      setAdding(false);
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    try {
      await apiFetch(`/api/catalog/${id}`, { method: "DELETE" });
      router.push("/catalog");
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  }

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!item) return <div className="p-4 text-center text-muted-foreground">未找到</div>;

  const canDelete = item.spools.length === 0;
  const detailSections = getFilamentDetailSections(item).filter((section) => hasVisibleItems(section.items));

  return (
    <div className="mx-auto max-w-lg md:max-w-6xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">耗材详情</h1>
        <Link href={`/catalog/${id}/edit`} className="text-sm text-primary font-medium">编辑</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <DetailSectionCard title="耗材概览" className="md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {item.logo_url ? (
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image src={item.logo_url} alt={item.brand} fill className="rounded-lg object-contain" unoptimized />
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-2xl font-bold text-muted-foreground">
                  {item.brand[0]}
                </div>
              )}
              <div>
                <p className="text-lg font-bold">{item.brand}</p>
                <p className="text-sm text-muted-foreground">{[item.material_type, item.material].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <ColorSwatch colorHex={item.color_hex} size="lg" />
              <div>
                <p className="text-xs text-muted-foreground">颜色</p>
                <p className="text-sm font-semibold">{item.color_name}</p>
                {item.color_hex ? <p className="text-xs text-muted-foreground">{item.color_hex}</p> : null}
              </div>
            </div>
          </div>
        </DetailSectionCard>

        {detailSections.map((section) => <FilamentDetailSection key={section.key} section={section} />)}

        <DetailSectionCard title="操作" className="md:col-span-2">
          <div className="space-y-3">
            <Button className="h-12 w-full text-base" onClick={handleAddSpool} disabled={adding}>
              {adding ? "创建中..." : "加入我的料卷"}
            </Button>
            {canDelete ? (
              <Button variant="destructive" className="h-12 w-full" onClick={() => setShowDeleteConfirm(true)}>
                删除耗材
              </Button>
            ) : null}
          </div>
        </DetailSectionCard>

      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除耗材"
        description="确认删除此耗材？此操作不可撤销。"
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

    </div>
  );
}
