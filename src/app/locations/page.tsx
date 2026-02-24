"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch";
import { getLocationType } from "@/lib/location-types";

interface Location {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  _count: { spools: number };
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Location[]>("/api/locations");
        setLocations(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 按类型分组
  const grouped = locations.reduce<Record<string, Location[]>>((acc, loc) => {
    const key = loc.type || "custom";
    if (!acc[key]) acc[key] = [];
    acc[key].push(loc);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-lg md:max-w-4xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">位置管理</h1>
        <Link href="/locations/new" className="text-sm text-primary font-medium">
          + 新建
        </Link>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">加载中...</p>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            暂无位置，
            <Link href="/locations/new" className="text-primary underline">
              新建位置
            </Link>
          </p>
        ) : (
          Object.entries(grouped).map(([type, locs]) => {
            const typeInfo = getLocationType(type);
            return (
              <div key={type}>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <span>{typeInfo.icon}</span>
                  <span>{typeInfo.label}</span>
                  <span className="text-muted-foreground/60">({locs.length})</span>
                </p>
                <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
                  {locs.map((loc) => (
                    <Link key={loc.id} href={`/location/${loc.id}`}>
                      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg active:bg-muted transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{typeInfo.icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {loc.name}
                              {loc.is_default && (
                                <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">默认</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {loc._count.spools} 卷活跃料卷
                            </p>
                          </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
