import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  size?: "form" | "content" | "wide";
  className?: string;
}

const sizeClassMap: Record<NonNullable<PageShellProps["size"]>, string> = {
  form: "max-w-lg md:max-w-2xl",
  content: "max-w-lg md:max-w-5xl",
  wide: "max-w-lg md:max-w-7xl",
};

export function PageShell({ children, size = "content", className }: PageShellProps) {
  return <div className={cn("mx-auto w-full", sizeClassMap[size], className)}>{children}</div>;
}
