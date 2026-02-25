import { cn } from "@/lib/utils";
import { DetailItem, hasDetailValue } from "@/lib/filament-detail-sections";

interface DetailMetricGridProps {
  items: DetailItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClassMap: Record<NonNullable<DetailMetricGridProps["columns"]>, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function DetailMetricGrid({ items, columns = 2, className }: DetailMetricGridProps) {
  const visibleItems = items.filter((item) => hasDetailValue(item.value));
  if (visibleItems.length === 0) return null;

  return (
    <div className={cn("grid gap-2", columnClassMap[columns], className)}>
      {visibleItems.map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-xl font-semibold leading-tight">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
