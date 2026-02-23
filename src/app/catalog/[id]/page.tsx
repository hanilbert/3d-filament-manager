"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/fetch";
import { ParamSection } from "@/components/ParamSection";
import { GlobalFilament } from "@/lib/types";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface CatalogDetail extends GlobalFilament {
  spools: Array<{
    id: string;
    status: string;
    location: { name: string } | null;
  }>;
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

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold flex-1">耗材详情</h1>
        <Link href={`/catalog/${id}/edit`} className="text-sm text-primary font-medium">编辑</Link>
      </div>

      <div className="p-4 space-y-4">
        {/* 品牌信息 */}
        <div className="flex items-center gap-4">
          {item.logo_url ? (
            <div className="w-16 h-16 relative flex-shrink-0">
              <Image src={item.logo_url} alt={item.brand} fill className="object-contain rounded-lg" unoptimized />
            </div>
          ) : (
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl font-bold text-muted-foreground flex-shrink-0">
              {item.brand[0]}
            </div>
          )}
          <div>
            <p className="font-bold text-lg">{item.brand}</p>
            <p className="text-muted-foreground">{item.material_type}{item.material ? ` · ${item.material}` : ""}</p>
          </div>
        </div>

        {/* 颜色 */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <ColorSwatch colorHex={item.color_hex} size="lg" />
          <div>
            <p className="text-xs text-muted-foreground">颜色</p>
            <p className="font-medium text-sm">{item.color_name}</p>
            {item.color_hex && <p className="text-xs text-muted-foreground">{item.color_hex}</p>}
          </div>
        </div>

        {/* 打印参数 */}
        <ParamSection title="打印参数" items={[
          { label: "喷嘴温度", value: item.nozzle_temp },
          { label: "热床温度", value: item.bed_temp },
          { label: "打印速度", value: item.print_speed },
        ]} />

        {/* 技术参数 */}
        <ParamSection title="技术参数" items={[
          { label: "密度", value: item.density },
          { label: "直径", value: item.diameter },
          { label: "标称重量", value: item.nominal_weight },
          { label: "软化温度", value: item.softening_temp },
          { label: "腔体温度", value: item.chamber_temp },
          { label: "熨烫流量", value: item.ironing_flow },
          { label: "熨烫速度", value: item.ironing_speed },
          { label: "收缩率", value: item.shrinkage },
          { label: "空卷重量", value: item.empty_spool_weight },
          { label: "压力提前 K", value: item.pressure_advance },
        ]} />

        {/* 风扇速度 */}
        <ParamSection title="风扇速度" items={[
          { label: "最小风扇", value: item.fan_min },
          { label: "最大风扇", value: item.fan_max },
        ]} />

        {/* 首层速度 */}
        <ParamSection title="首层速度" items={[
          { label: "墙速度", value: item.first_layer_walls },
          { label: "填充速度", value: item.first_layer_infill },
          { label: "外墙速度", value: item.first_layer_outer_wall },
          { label: "顶面速度", value: item.first_layer_top_surface },
        ]} />

        {/* 其他层速度 */}
        <ParamSection title="其他层速度" items={[
          { label: "墙速度", value: item.other_layers_walls },
          { label: "填充速度", value: item.other_layers_infill },
          { label: "外墙速度", value: item.other_layers_outer_wall },
          { label: "顶面速度", value: item.other_layers_top_surface },
        ]} />

        {/* 色彩数据 */}
        <ParamSection title="色彩数据" items={[
          { label: "实测 RGB", value: item.measured_rgb },
          { label: "最高投票 TD", value: item.top_voted_td },
          { label: "TD 投票数", value: item.num_td_votes },
        ]} />

        {/* 流量特性 */}
        <ParamSection title="流量特性" items={[
          { label: "最大体积速度", value: item.max_volumetric_speed },
          { label: "流量比", value: item.flow_ratio },
        ]} />

        {/* 干燥信息 */}
        <ParamSection title="干燥信息" items={[
          { label: "干燥温度", value: item.drying_temp },
          { label: "干燥时间", value: item.dry_time },
        ]} />

        {/* 兼容性 */}
        <ParamSection title="兼容性" items={[
          { label: "AMS 兼容性", value: item.ams_compatibility },
          { label: "适用热床板", value: item.build_plates },
        ]} />

        {/* 加入料卷按钮 */}
        <Button className="w-full h-14 text-base" onClick={handleAddSpool} disabled={adding}>
          {adding ? "创建中..." : "加入我的料卷"}
        </Button>

        {/* 关联料卷列表 */}
        {item.spools.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">当前活跃料卷（{item.spools.length} 卷）</p>
            <div className="space-y-2">
              {item.spools.map((s) => (
                <Link key={s.id} href={`/spool/${s.id}`}>
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                    <span className="text-sm">{s.location?.name ?? "未分配位置"}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 删除按钮 */}
        {canDelete && (
          <Button variant="destructive" className="w-full h-12" onClick={() => setShowDeleteConfirm(true)}>
            删除耗材
          </Button>
        )}
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
