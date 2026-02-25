import { cn } from "@/lib/utils";
import { DetailItem, hasDetailValue } from "@/lib/filament-detail-sections";

interface DetailKeyValueListProps {
  items: DetailItem[];
  className?: string;
}

export function DetailKeyValueList({ items, className }: DetailKeyValueListProps) {
  const visibleItems = items.filter((item) => hasDetailValue(item.value));
  if (visibleItems.length === 0) return null;

  return (
    <div className={cn(className)}>
      {visibleItems.map((item) => (
        <div key={item.label} className="flex items-start justify-between border-b border-border py-2.5 last:border-0 last:pb-0">
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <span className="text-sm font-medium text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
