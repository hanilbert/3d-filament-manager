import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailSectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DetailSectionCard({ title, icon, children, className }: DetailSectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm transition-colors md:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        {icon ? <span>{icon}</span> : null}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}
