"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ColorSwatch } from "@/components/ColorSwatch";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilamentDetailSection } from "@/components/FilamentDetailSection";
import { DetailSectionCard } from "@/components/DetailSectionCard";
import { DetailKeyValueList } from "@/components/DetailKeyValueList";
import { QRScanner } from "@/components/QRScanner";
import { apiFetch } from "@/lib/fetch";
import { getFilamentDetailSections, hasVisibleItems } from "@/lib/filament-detail-sections";
import { SpoolLabelPrinter } from "./print/spool-label-printer";
import { Filament } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

interface SpoolDetail {
  id: string;
  status: "ACTIVE" | "EMPTY";
  created_at: string;
  filament_id: string;
  filament: Omit<Filament, "created_at">;
  location: { id: string; name: string } | null;
}

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const message = searchParams.get("statusMsg");
    if (message) setStatusMsg(message);
  }, [searchParams]);

  async function handleScanResult(text: string) {
    setShowScanner(false);
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
        body: JSON.stringify({ filament_id: spool.filament_id }),
      });
      router.push(`/spools/${newSpool.id}`);
    } catch {
      setStatusMsg("重新入库失败，请重试");
    }
  }

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!spool) return <div className="p-4 text-center text-muted-foreground">线轴不存在</div>;

  const { filament, location } = spool;
  const detailSections = getFilamentDetailSections(filament).filter((section) => hasVisibleItems(section.items));

  return (
    <div className="mx-auto max-w-lg md:max-w-6xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">线轴详情</h1>
        <StatusBadge status={spool.status} />
      </div>

      {spool.status === "EMPTY" && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-800 font-medium text-center">此线轴已归档（已用完）</AlertDescription>
        </Alert>
      )}

      {statusMsg && (
        <div className="mx-4 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm text-center">{statusMsg}</div>
      )}

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <DetailSectionCard title="线轴概览" className="md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {filament.logo_url ? (
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image src={filament.logo_url} alt={filament.brand} fill className="rounded-lg object-contain" unoptimized />
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-2xl font-bold text-muted-foreground">
                  {filament.brand[0]}
                </div>
              )}
              <div>
                <p className="text-lg font-bold">{filament.brand}</p>
                <p className="text-sm text-muted-foreground">{[filament.material, filament.variant].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <ColorSwatch colorHex={filament.color_hex} size="lg" />
              <div>
                <p className="text-xs text-muted-foreground">颜色</p>
                <p className="text-sm font-semibold">{filament.color_name}</p>
                {filament.color_hex ? <p className="text-xs text-muted-foreground">{filament.color_hex}</p> : null}
              </div>
            </div>
          </div>
        </DetailSectionCard>

        <DetailSectionCard title="线轴信息">
          <DetailKeyValueList
            items={[
              { label: "状态", value: spool.status === "ACTIVE" ? "使用中" : "已归档" },
              { label: "线轴 ID", value: spool.id },
              { label: "耗材 ID", value: spool.filament_id },
              { label: "当前位置", value: location ? location.name : "暂未分配位置" },
              { label: "入库时间", value: new Date(spool.created_at).toLocaleString("zh-CN") },
            ]}
          />
        </DetailSectionCard>

        {detailSections.map((section) => <FilamentDetailSection key={section.key} section={section} />)}

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
                {showLabelPrinter ? <SpoolLabelPrinter filament={spool.filament} qrUrl={`${window.location.origin}/spools/${id}`} /> : null}

                <Button className="h-12 w-full text-base" variant="destructive" onClick={() => setShowConfirm(true)}>
                  标记为已用完
                </Button>

                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                  删除线轴
                </Button>
              </>
            ) : (
              <>
                <Button className="h-12 w-full text-base" onClick={handleRestock}>
                  重新入库
                </Button>
                <Button className="h-12 w-full text-base" variant="outline" onClick={() => setShowDeleteConfirm(true)}>
                  删除线轴
                </Button>
              </>
            )}
          </div>
        </DetailSectionCard>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="标记为已用完"
        description="确认后此线轴将移入「已归档线轴」列表，可在归档列表中「重新入库」。"
        confirmLabel="确认用完"
        onConfirm={handleMarkEmpty}
        onCancel={() => setShowConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除线轴"
        description="确认删除此线轴？此操作不可撤销。"
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
