"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorSwatch } from "@/components/ColorSwatch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/fetch";

interface LocationDetail {
  id: string;
  name: string;
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
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<LocationDetail>(`/api/locations/${id}`);
      setLoc(data);
      setEditName(data.name);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveName() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/locations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditing(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold flex-1">位置详情</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 位置名称 */}
        {editing ? (
          <div className="flex gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-12 flex-1" autoFocus />
            <Button onClick={handleSaveName} disabled={saving} className="h-12">保存</Button>
            <Button variant="outline" onClick={() => setEditing(false)} className="h-12">取消</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{loc.name}</h2>
            <button onClick={() => setEditing(true)} className="text-sm text-primary">编辑</button>
          </div>
        )}

        {/* 操作按钮 */}
        <Link href={`/location/${id}/print`} target="_blank">
          <Button variant="outline" className="w-full h-12">打印位置标签</Button>
        </Link>

        {/* 料卷列表 */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            此位置的料卷（{loc.spools.length} 卷）
          </p>
          {loc.spools.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">暂无料卷</p>
          ) : (
            <div className="space-y-2">
              {loc.spools.map((s) => (
                <Link key={s.id} href={`/spool/${s.id}`}>
                  <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg active:bg-muted transition-colors">
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

        <Button variant="destructive" className="w-full h-12" onClick={() => setShowDeleteConfirm(true)}>
          删除位置
        </Button>
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
