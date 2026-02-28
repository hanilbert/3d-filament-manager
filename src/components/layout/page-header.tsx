import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  sticky = true,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-border/80 bg-background/95 backdrop-blur",
        sticky ? "sticky top-0 z-10" : "",
        className
      )}
    >
      <div className="flex min-h-14 items-center gap-3 px-4 py-3 md:px-6">
        {back ? <div className="shrink-0 text-muted-foreground">{back}</div> : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
