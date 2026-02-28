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
        <div
          key={item.label}
          className="flex items-start justify-between gap-4 border-b border-border/70 py-3 last:border-0 last:pb-0"
        >
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <span className="text-right text-sm font-medium leading-relaxed">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
