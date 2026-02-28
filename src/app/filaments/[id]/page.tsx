"use client";

import { useParams } from "next/navigation";
import { FilamentDetailView } from "@/components/filament/FilamentDetailView";

export default function FilamentDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <FilamentDetailView
      filamentId={id}
      titleMode="full"
      subtitleMode="material"
      spoolSectionLabel="线轴列表"
    />
  );
}
