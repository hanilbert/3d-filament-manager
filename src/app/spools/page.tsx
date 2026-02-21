"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorSwatch } from "@/components/ColorSwatch";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/fetch";

interface Spool {
  id: string;
  status: "ACTIVE" | "EMPTY";
  created_at: string;
  globalFilament: {
    brand: string;
    material: string;
    color_name: string;
    color_hex?: string | null;
  };
  location: { id: string; name: string } | null;
}

function SpoolCard({ spool }: { spool: Spool }) {
  return (
    <Link href={`/spool/${spool.id}`}>
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors">
        <ColorSwatch colorHex={spool.globalFilament.color_hex} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {spool.globalFilament.brand} {spool.globalFilament.material}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {spool.globalFilament.color_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {spool.location ? spool.location.name : "未分配位置"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusBadge status={spool.status} />
          <span className="text-xs text-muted-foreground">
            {new Date(spool.created_at).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function SpoolsPage() {
  const [activeSpools, setActiveSpools] = useState<Spool[]>([]);
  const [emptySpools, setEmptySpools] = useState<Spool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [active, empty] = await Promise.all([
          apiFetch<Spool[]>("/api/spools?status=ACTIVE"),
          apiFetch<Spool[]>("/api/spools?status=EMPTY"),
        ]);
        setActiveSpools(active);
        setEmptySpools(empty);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">我的料卷</h1>
        <Link
          href="/catalog"
          className="text-sm text-primary font-medium"
        >
          + 新增
        </Link>
      </div>

      <div className="p-4">
        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              使用中 ({activeSpools.length})
            </TabsTrigger>
            <TabsTrigger value="empty" className="flex-1">
              已归档 ({emptySpools.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">加载中...</p>
            ) : activeSpools.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                暂无使用中的料卷，
                <Link href="/catalog" className="text-primary underline">
                  去添加
                </Link>
              </p>
            ) : (
              activeSpools.map((s) => <SpoolCard key={s.id} spool={s} />)
            )}
          </TabsContent>

          <TabsContent value="empty" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">加载中...</p>
            ) : emptySpools.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无已归档的料卷</p>
            ) : (
              emptySpools.map((s) => <SpoolCard key={s.id} spool={s} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
