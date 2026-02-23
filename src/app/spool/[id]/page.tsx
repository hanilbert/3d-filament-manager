"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ColorSwatch } from "@/components/ColorSwatch";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { QRScanner } from "@/components/QRScanner";
import { apiFetch } from "@/lib/fetch";

interface SpoolDetail {
  id: string;
  status: "ACTIVE" | "EMPTY";
  created_at: string;
  global_filament_id: string;
  globalFilament: {
    brand: string;
    material: string;
    color_name: string;
    color_hex?: string | null;
    nozzle_temp?: string | null;
    bed_temp?: string | null;
    print_speed?: string | null;
    logo_url?: string | null;
  };
  location: { id: string; name: string } | null;
}

export default function SpoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [spool, setSpool] = useState<SpoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      {/* 顶栏 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
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

      <div className="p-4 space-y-4">
        {/* Logo + 品牌信息 */}
        <div className="flex items-center gap-4">
          {gf.logo_url ? (
            <div className="w-16 h-16 relative flex-shrink-0">
              <Image
                src={gf.logo_url}
                alt={gf.brand}
                fill
                className="object-contain rounded-lg"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl font-bold text-muted-foreground flex-shrink-0">
              {gf.brand[0]}
            </div>
          )}
          <div>
            <p className="font-bold text-lg">{gf.brand}</p>
            <p className="text-muted-foreground">{gf.material}</p>
          </div>
        </div>

        {/* 颜色信息 */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <ColorSwatch colorHex={gf.color_hex} size="lg" />
          <div>
            <p className="text-xs text-muted-foreground">颜色</p>
            <p className="font-medium text-sm">{gf.color_name}</p>
          </div>
        </div>

        {/* 打印参数 */}
        {(gf.nozzle_temp || gf.bed_temp || gf.print_speed) && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "喷嘴温度", value: gf.nozzle_temp },
              { label: "热床温度", value: gf.bed_temp },
              { label: "打印速度", value: gf.print_speed },
            ].filter(({ value }) => value).map(({ label, value }) => (
              <div key={label} className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 当前位置 */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">当前位置</p>
            <p className="font-medium text-sm mt-0.5">
              {location ? location.name : "暂未分配位置"}
            </p>
          </div>
        </div>

        {/* 入库时间 */}
        <p className="text-xs text-muted-foreground text-center">
          入库时间：{new Date(spool.created_at).toLocaleString("zh-CN")}
        </p>

        {/* 操作按钮 */}
        <div className="space-y-3 pt-2">
          {spool.status === "ACTIVE" ? (
            <>
              <Button
                className="w-full h-14 text-base"
                variant="outline"
                onClick={() => setShowScanner(!showScanner)}
              >
                {showScanner ? "关闭扫码" : "修改位置"}
              </Button>

              {showScanner && (
                <QRScanner
                  onResult={handleScanResult}
                  onClose={() => setShowScanner(false)}
                />
              )}

              <Link href={`/spool/${id}/print`} target="_blank">
                <Button className="w-full h-14 text-base" variant="outline">
                  打印标签
                </Button>
              </Link>

              <Button
                className="w-full h-14 text-base"
                variant="destructive"
                onClick={() => setShowConfirm(true)}
              >
                标记为已用完
              </Button>
            </>
          ) : (
            <Button
              className="w-full h-14 text-base"
              onClick={handleRestock}
            >
              重新入库
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="标记为已用完"
        description="确认后此料卷将移入「已归档」列表，可在归档列表中「重新入库」。"
        confirmLabel="确认用完"
        onConfirm={handleMarkEmpty}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
