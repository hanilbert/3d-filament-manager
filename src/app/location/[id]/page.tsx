"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailKeyValueList } from "@/components/DetailKeyValueList";
import { DetailMetricGrid } from "@/components/DetailMetricGrid";
import { DetailSectionCard } from "@/components/DetailSectionCard";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { apiFetch } from "@/lib/fetch";
import { getLocationType } from "@/lib/location-types";
import { LocationLabelPrinter } from "./print/location-label-printer";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface LocationDetail {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
  created_at: string;
  updated_at: string;
  spools: Array<{
    id: string;
    filament: {
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
    <PageShell size="wide">
      <PageHeader
        title={loc.name}
        back={
          <button onClick={() => router.back()} className="text-muted-foreground">
            <ArrowLeft className="size-5" />
          </button>
        }
      />

      <div className="app-content space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {/* 左列 */}
        <div className="space-y-4">
          {/* 线轴状态卡片 */}
          <DetailSectionCard title="线轴状态">
            <DetailMetricGrid
              columns={2}
              items={[
                { label: "位置类型", value: `${typeInfo.icon} ${typeInfo.label}` },
                { label: "线轴数", value: `${loc.spools.length} 轴` },
              ]}
            />
          </DetailSectionCard>

          {/* 位置详情卡片 */}
          <DetailSectionCard title="位置详情">
            <div className="mb-3 flex items-center justify-end">
              <Link href={`/location/${id}/edit`} className="text-sm text-primary">
                编辑
              </Link>
            </div>
            <DetailKeyValueList
              items={[
                { label: "名称", value: loc.name },
                { label: "类型", value: `${typeInfo.icon} ${typeInfo.label}` },
                { label: "默认位置", value: loc.is_default ? "是" : "否" },
                { label: "打印机", value: loc.type === "ams_slot" ? loc.printer_name : null },
                { label: "AMS 单元", value: loc.type === "ams_slot" ? loc.ams_unit : null },
                { label: "AMS 插槽", value: loc.type === "ams_slot" ? loc.ams_slot : null },
                { label: "创建时间", value: new Date(loc.created_at).toLocaleDateString("zh-CN") },
                { label: "更新时间", value: new Date(loc.updated_at).toLocaleDateString("zh-CN") },
              ]}
            />
          </DetailSectionCard>

          {/* 线轴列表 */}
          <DetailSectionCard title={`此位置的线轴（${loc.spools.length} 轴）`}>
            {loc.spools.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">暂无线轴</p>
            ) : (
              <div className="space-y-2">
                {loc.spools.map((s) => (
                  <Link key={s.id} href={`/spools/${s.id}`}>
                    <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                      <ColorSwatch colorHex={s.filament.color_hex} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.filament.brand} {s.filament.material}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.filament.color_name}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DetailSectionCard>
        </div>

        {/* 右列 */}
        <div className="space-y-4">
          {/* QR 标签卡片 */}
          <DetailSectionCard title="QR 标签">
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
          </DetailSectionCard>

          {showLabelPrinter && loc && (
            <LocationLabelPrinter
              location={loc}
              qrUrl={`${window.location.origin}/location/${id}`}
            />
          )}

          {/* 危险操作 */}
          <DetailSectionCard title="危险操作">
            <Button
              variant="destructive"
              className="w-full h-12"
              onClick={() => setShowDeleteConfirm(true)}
            >
              删除位置
            </Button>
          </DetailSectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除位置"
        description={`确认删除「${loc.name}」？该位置下 ${loc.spools.length} 个线轴的位置信息将被清空。`}
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </PageShell>
  );
}
