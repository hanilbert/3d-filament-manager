import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOrder = "asc" | "desc";

interface SortHeaderProps<T extends string> {
  field: T;
  label: string;
  sortBy: T;
  sortOrder: SortOrder;
  onToggle: (field: T) => void;
}

export function SortHeader<T extends string>({
  field,
  label,
  sortBy,
  sortOrder,
  onToggle,
}: SortHeaderProps<T>) {
  const isActive = sortBy === field;
  const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:text-foreground",
        isActive ? "text-foreground" : ""
      )}
    >
      <span>{label}</span>
      <Icon className="size-3.5" />
    </button>
  );
}
