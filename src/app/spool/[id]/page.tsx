"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ColorSwatch } from "@/components/ColorSwatch";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailKeyValueList } from "@/components/DetailKeyValueList";
import { DetailMetricGrid } from "@/components/DetailMetricGrid";
import { DetailSectionCard } from "@/components/DetailSectionCard";
import { QRScanner } from "@/components/QRScanner";
import { apiFetch } from "@/lib/fetch";
import { DetailSectionConfig, getFilamentDetailSections, hasVisibleItems } from "@/lib/filament-detail-sections";
import { SpoolLabelPrinter } from "./print/spool-label-printer";
import { GlobalFilament } from "@/lib/types";
import { ArrowLeft, Fan, FlaskConical, Info, ScanLine, Thermometer, Waves, Wind } from "lucide-react";

interface SpoolDetail {
  id: string;
  status: "ACTIVE" | "EMPTY";
  created_at: string;
  global_filament_id: string;
  globalFilament: Omit<GlobalFilament, "id" | "created_at">;
  location: { id: string; name: string } | null;
}

const sectionIconMap: Record<string, ReactNode> = {
  basic: <Info className="h-4 w-4" />,
  technical: <ScanLine className="h-4 w-4" />,
  temperature: <Thermometer className="h-4 w-4" />,
  fan: <Fan className="h-4 w-4" />,
  "first-layer": <Wind className="h-4 w-4" />,
  "other-layer": <Wind className="h-4 w-4" />,
  flow: <Waves className="h-4 w-4" />,
  drying: <FlaskConical className="h-4 w-4" />,
  "color-data": <ScanLine className="h-4 w-4" />,
  compatibility: <Info className="h-4 w-4" />,
};

export default function SpoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [spool, setSpool] = useState<SpoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SpoolDetail>(`/api/spools/${id}`);
      setSpool(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const message = searchParams.get("statusMsg");
    if (message) {
      setStatusMsg(message);
    }
  }, [searchParams]);

  async function handleScanResult(text: string) {
    setShowScanner(false);
    // 从 URL 或纯 UUID 中提取 location id
    const match = text.match(/\/location\/([0-9a-f-]{36})/i) ?? text.match(/^([0-9a-f-]{36})$/i);
    const locationId = match?.[1];
    if (!locationId) {
      setStatusMsg("无效的位置二维码");
      return;
    }
    try {
      const updated = await apiFetch<SpoolDetail>(`/api/spools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ location_id: locationId }),
      });
      setSpool(updated);
      setStatusMsg(`位置已更新为：${updated.location?.name ?? "未知"}`);
    } catch {
      setStatusMsg("更新位置失败，请重试");
    }
  }

  async function handleMarkEmpty() {
    setShowConfirm(false);
    try {
      const updated = await apiFetch<SpoolDetail>(`/api/spools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "EMPTY" }),
      });
      setSpool(updated);
    } catch {
      setStatusMsg("操作失败，请重试");
    }
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    try {
      await apiFetch(`/api/spools/${id}`, { method: "DELETE" });
      router.push("/spools");
    } catch {
      setStatusMsg("删除失败，请重试");
    }
  }

  async function handleRestock() {
    if (!spool) return;
    try {
      const newSpool = await apiFetch<{ id: string }>("/api/spools", {
        method: "POST",
        body: JSON.stringify({ global_filament_id: spool.global_filament_id }),
      });
      router.push(`/spool/${newSpool.id}`);
    } catch {
      setStatusMsg("重新入库失败，请重试");
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  }
  if (!spool) {
    return <div className="p-4 text-center text-muted-foreground">料卷不存在</div>;
  }

  const { globalFilament: gf, location } = spool;
  const detailSections = getFilamentDetailSections(gf).filter((section) => hasVisibleItems(section.items));

  function renderSection(section: DetailSectionConfig) {
    return (
      <DetailSectionCard key={section.key} title={section.title} icon={sectionIconMap[section.key]}>
        {section.layout === "metric" ? (
          <DetailMetricGrid items={section.items} columns={section.columns} />
        ) : (
          <DetailKeyValueList items={section.items} />
        )}
      </DetailSectionCard>
    );
  }

  return (
    <div className="mx-auto max-w-lg md:max-w-6xl">
      {/* 顶栏 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">料卷详情</h1>
        <StatusBadge status={spool.status} />
      </div>

      {/* EMPTY 警告横幅 */}
      {spool.status === "EMPTY" && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-800 font-medium text-center">
            此耗材已归档（已用完）
          </AlertDescription>
        </Alert>
      )}

      {/* 状态消息 */}
      {statusMsg && (
        <div className="mx-4 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm text-center">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <DetailSectionCard title="料卷概览" className="md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {gf.logo_url ? (
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image src={gf.logo_url} alt={gf.brand} fill className="rounded-lg object-contain" unoptimized />
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-2xl font-bold text-muted-foreground">
                  {gf.brand[0]}
                </div>
              )}
              <div>
                <p className="text-lg font-bold">{gf.brand}</p>
                <p className="text-sm text-muted-foreground">{[gf.material_type, gf.material].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <ColorSwatch colorHex={gf.color_hex} size="lg" />
              <div>
                <p className="text-xs text-muted-foreground">颜色</p>
                <p className="text-sm font-semibold">{gf.color_name}</p>
                {gf.color_hex ? <p className="text-xs text-muted-foreground">{gf.color_hex}</p> : null}
              </div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="料卷信息">
          <DetailKeyValueList
            items={[
              { label: "状态", value: spool.status === "ACTIVE" ? "使用中" : "已归档" },
              { label: "当前位置", value: location ? location.name : "暂未分配位置" },
              { label: "入库时间", value: new Date(spool.created_at).toLocaleString("zh-CN") },
            ]}
          />
        </DetailSectionCard>

        {detailSections.map((section) => renderSection(section))}

        <DetailSectionCard title="操作" className="md:col-span-2">
          <div className="space-y-3">
            {spool.status === "ACTIVE" ? (
              <>
                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowScanner(!showScanner)}>
                  {showScanner ? "关闭扫码" : "修改位置"}
                </Button>
                {showScanner ? <QRScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} /> : null}

                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowLabelPrinter(!showLabelPrinter)}>
                  {showLabelPrinter ? "关闭标签预览" : "标签预览"}
                </Button>
                {showLabelPrinter && spool ? (
                  <SpoolLabelPrinter globalFilament={spool.globalFilament} qrUrl={`${window.location.origin}/spool/${id}`} />
                ) : null}

                <Button className="h-12 w-full text-base" variant="destructive" onClick={() => setShowConfirm(true)}>
                  标记为已用完
                </Button>

                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                  删除料卷
                </Button>
              </>
            ) : (
              <>
                <Button className="h-12 w-full text-base" onClick={handleRestock}>
                  重新入库
                </Button>
                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                  删除料卷
                </Button>
              </>
            )}
          </div>
        </DetailSectionCard>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="标记为已用完"
        description="确认后此料卷将移入「已归档」列表，可在归档列表中「重新入库」。"
        confirmLabel="确认用完"
        onConfirm={handleMarkEmpty}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除料卷"
        description="确认删除此料卷？此操作不可撤销。"
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
