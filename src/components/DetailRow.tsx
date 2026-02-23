interface DetailRowProps {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}

export function DetailRow({ label, value, icon }: DetailRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  );
}
