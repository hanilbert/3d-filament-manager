import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

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
      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>{label}</span>
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
