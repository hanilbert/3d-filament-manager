import Link from "next/link";

interface ColorCardProps {
  id: string;
  colorName: string;
  colorHex?: string | null;
  brand: string;
  material: string;
  variant?: string | null;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function ColorCard({ id, colorName, colorHex, brand, material, variant }: ColorCardProps) {
  const isValidHex = colorHex && HEX_RE.test(colorHex);
  const displayHex = isValidHex ? colorHex.toUpperCase() : null;
  const bgColor = isValidHex ? colorHex : undefined;
  const subtitle = [brand, material, variant].filter(Boolean).join(" · ");

  return (
    <Link href={`/filaments/${id}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:shadow-md hover:border-border">
        <div
          className="aspect-square w-full relative"
          style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
          {!bgColor && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <svg className="h-8 w-8 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <line x1="4" y1="4" x2="20" y2="20" />
                <rect x="3" y="3" width="18" height="18" rx="1" />
              </svg>
            </div>
          )}
        </div>
        <div className="p-2.5">
          <p className="truncate text-sm font-medium leading-tight">{colorName}</p>
          <div className="mt-1 flex items-end justify-between gap-1">
            <p className="truncate text-[11px] text-muted-foreground leading-tight">{subtitle}</p>
            {displayHex && (
              <p className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/60 leading-tight">{displayHex}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
