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
import { formatDate } from "@/lib/utils";
import { getFilamentDetailSections, hasVisibleItems } from "@/lib/filament-detail-sections";
import { GlobalFilament } from "@/lib/types";
import {
  ArrowLeft, ExternalLink, Trash2,
} from "lucide-react";

interface FilamentWithSpools extends GlobalFilament {  spools: Array<{
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    location: { name: string } | null;
  }>;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export default function SpoolFilamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<FilamentWithSpools | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingSpoolId, setDeletingSpoolId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<FilamentWithSpools>(`/api/catalog/${id}`);
      setItem(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAddSpool() {
    setAdding(true);
    try {
      await apiFetch<{ id: string }>("/api/spools", {
        method: "POST",
        body: JSON.stringify({ global_filament_id: id }),
      });
      setAdding(false);
      load();
    } catch {
      setAdding(false);
    }
  }

  async function handleDeleteSpool() {
    if (!deletingSpoolId) return;
    try {
      await apiFetch(`/api/spools/${deletingSpoolId}`, { method: "DELETE" });
      setDeletingSpoolId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除料卷失败");
      setDeletingSpoolId(null);
    }
  }

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!item) return <div className="p-4 text-center text-muted-foreground">未找到</div>;

  const title = [item.brand, item.material, item.color_name].filter(Boolean).join(" ");
  const detailSections = getFilamentDetailSections(item).filter((s) => hasVisibleItems(s.items));

  return (
    <div className="mx-auto max-w-lg md:max-w-6xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          <p className="text-xs text-muted-foreground">{item.material_type}</p>
        </div>
        <Link href={`/catalog/${id}/edit`} className="text-sm text-primary font-medium">编辑</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {/* 料盘卡片 - 最上面 */}
        <DetailSectionCard title={`我的线轴（${item.spools.length} 卷）`} className="md:col-span-2">
          <div className="mb-3">
            <Button size="sm" onClick={handleAddSpool} disabled={adding}>
              {adding ? "创建中..." : "+ 加入新料卷"}
            </Button>
          </div>
          {item.spools.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">暂无料卷</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground">位置</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">料卷 ID</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">状态</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">入库时间</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">最后更新</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.spools.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2.5">{s.location?.name ?? "未分配位置"}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{shortId(s.id)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "ACTIVE" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                            {s.status === "ACTIVE" ? "使用中" : "空"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{formatDate(s.created_at)}</td>
                        <td className="px-3 py-2.5">{formatDate(s.updated_at)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/spool/${s.id}`}
                              className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-medium hover:bg-muted transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              查看
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeletingSpoolId(s.id)}
                              className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2">
                {item.spools.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-background px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{s.location?.name ?? "未分配位置"}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "ACTIVE" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {s.status === "ACTIVE" ? "使用中" : "空"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      ID: {shortId(s.id)} · 入库：{formatDate(s.created_at)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/spool/${s.id}`}
                        className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        查看
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeletingSpoolId(s.id)}
                        className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DetailSectionCard>

        {/* 耗材概览 */}
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

        {/* 耗材详情 */}
        {detailSections.map((section) => <FilamentDetailSection key={section.key} section={section} />)}
      </div>

      <ConfirmDialog
        open={!!deletingSpoolId}
        title="删除料卷"
        description="确认删除此料卷？此操作不可撤销。"
        confirmLabel="确认删除"
        onConfirm={handleDeleteSpool}
        onCancel={() => setDeletingSpoolId(null)}
      />
    </div>
  );
}
