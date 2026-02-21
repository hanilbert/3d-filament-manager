"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/fetch";

interface CatalogDetail {
  id: string;
  brand: string;
  material: string;
  color_name: string;
  color_hex?: string | null;
  nozzle_temp: string;
  bed_temp: string;
  print_speed: string;
  logo_url?: string | null;
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
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold flex-1">字典详情</h1>
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
            <p className="text-muted-foreground">{item.material}</p>
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
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "喷嘴温度", value: item.nozzle_temp },
            { label: "热床温度", value: item.bed_temp },
            { label: "打印速度", value: item.print_speed },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>

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
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 删除按钮 */}
        {canDelete && (
          <Button variant="destructive" className="w-full h-12" onClick={() => setShowDeleteConfirm(true)}>
            删除字典
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除字典"
        description="确认删除此耗材字典？此操作不可撤销。"
        confirmLabel="确认删除"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
