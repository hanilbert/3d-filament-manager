export function ParamSection({ title, items }: { title: string; items: { label: string; value?: string | null }[] }) {
  const filled = items.filter((i) => i.value);
  if (filled.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filled.map(({ label, value }) => (
          <div key={label} className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
