"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow } from "@/components/DetailRow";
import { apiFetch } from "@/lib/fetch";
import { getLocationType } from "@/lib/location-types";
import { LocationLabelPrinter } from "./print/location-label-printer";

interface LocationDetail {
  id: string;
  name: string;
  type: string;
  short_code?: string | null;
  is_default: boolean;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
  created_at: string;
  updated_at: string;
  spools: Array<{
    id: string;
    globalFilament: {
      brand: string;
      material: string;
      color_name: string;
      color_hex?: string | null;
    };
  }>;
}

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loc, setLoc] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<LocationDetail>(`/api/locations/${id}`);
      setLoc(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    setShowDeleteConfirm(false);
    try {
      await apiFetch(`/api/locations/${id}`, { method: "DELETE" });
      router.push("/locations");
    } catch {
      alert("删除失败");
    }
  }

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!loc) return <div className="p-4 text-center text-muted-foreground">位置不存在</div>;

  const typeInfo = getLocationType(loc.type);

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      {/* 顶部 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold flex-1 truncate">{loc.name}</h1>
      </div>

      <div className="p-4 space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {/* 左列 */}
        <div className="space-y-4">
          {/* 料卷状态卡片 */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              料卷状态
            </p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{typeInfo.icon}</span>
              <div>
                <p className="text-2xl font-bold">{loc.spools.length}</p>
                <p className="text-xs text-muted-foreground">卷活跃料卷</p>
              </div>
            </div>
          </div>

          {/* 位置详情卡片 */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">位置详情</p>
              <Link href={`/location/${id}/edit`} className="text-sm text-primary">
                编辑
              </Link>
            </div>
            <div>
              <DetailRow label="名称" value={loc.name} />
              <DetailRow label="类型" value={`${typeInfo.icon} ${typeInfo.label}`} />
              {loc.short_code && <DetailRow label="短代码" value={loc.short_code} />}
              <DetailRow label="默认位置" value={loc.is_default ? "是" : "否"} />
              {loc.type === "ams_slot" && (
                <>
                  <DetailRow label="打印机" value={loc.printer_name} />
                  <DetailRow label="AMS 单元" value={loc.ams_unit} />
                  <DetailRow label="AMS 插槽" value={loc.ams_slot} />
                </>
              )}
              <DetailRow
                label="创建时间"
                value={new Date(loc.created_at).toLocaleDateString("zh-CN")}
              />
              <DetailRow
                label="更新时间"
                value={new Date(loc.updated_at).toLocaleDateString("zh-CN")}
              />
            </div>
          </div>

          {/* 料卷列表 */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              此位置的料卷（{loc.spools.length} 卷）
            </p>
            {loc.spools.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">暂无料卷</p>
            ) : (
              <div className="space-y-2">
                {loc.spools.map((s) => (
                  <Link key={s.id} href={`/spool/${s.id}`}>
                    <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                      <ColorSwatch colorHex={s.globalFilament.color_hex} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.globalFilament.brand} {s.globalFilament.material}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.globalFilament.color_name}
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右列 */}
        <div className="space-y-4">
          {/* QR 标签卡片 */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">QR 标签</p>
            <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl block mb-2">{typeInfo.icon}</span>
                <p className="text-sm font-medium">{loc.name}</p>
                {loc.type === "ams_slot" && loc.printer_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {loc.printer_name} / AMS{loc.ams_unit} Slot{loc.ams_slot}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 mt-3"
              onClick={() => setShowLabelPrinter(!showLabelPrinter)}
            >
              {showLabelPrinter ? "关闭标签预览" : "标签预览"}
            </Button>
          </div>

          {showLabelPrinter && loc && (
            <LocationLabelPrinter
              location={loc}
              qrUrl={`${window.location.origin}/location/${id}`}
            />
          )}

          {/* 危险操作 */}
          <Button
            variant="destructive"
            className="w-full h-12"
            onClick={() => setShowDeleteConfirm(true)}
          >
            删除位置
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除位置"
        description={`确认删除「${loc.name}」？该位置下 ${loc.spools.length} 卷料卷的位置信息将被清空。`}
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
