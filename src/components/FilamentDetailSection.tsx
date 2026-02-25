import { Fan, FlaskConical, Info, ScanLine, Thermometer, Waves, Wind } from "lucide-react";
import { DetailKeyValueList } from "@/components/DetailKeyValueList";
import { DetailMetricGrid } from "@/components/DetailMetricGrid";
import { DetailSectionCard } from "@/components/DetailSectionCard";
import { DetailSectionConfig } from "@/lib/filament-detail-sections";
import { ReactNode } from "react";

export const sectionIconMap: Record<string, ReactNode> = {
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

export function FilamentDetailSection({ section }: { section: DetailSectionConfig }) {
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
