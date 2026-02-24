"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LocationForm } from "@/components/LocationForm";
import { apiFetch } from "@/lib/fetch";

interface LocationData {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  printer_name?: string | null;
  ams_unit?: string | null;
  ams_slot?: string | null;
}

export default function EditLocationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const loc = await apiFetch<LocationData>(`/api/locations/${id}`);
        setData(loc);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
  if (!data) return <div className="p-4 text-center text-muted-foreground">位置不存在</div>;

  return (
    <div className="mx-auto max-w-lg md:max-w-2xl">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">编辑位置</h1>
      </div>
      <LocationForm
        locationId={id}
        initialValues={{
          name: data.name,
          type: data.type as "shelf" | "printer" | "ams_slot" | "dryer" | "custom",
          is_default: data.is_default,
          printer_name: data.printer_name ?? "",
          ams_unit: data.ams_unit ?? "",
          ams_slot: data.ams_slot ?? "",
        }}
      />
    </div>
  );
}
