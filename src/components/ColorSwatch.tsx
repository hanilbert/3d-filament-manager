interface ColorSwatchProps {
  colorHex?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ColorSwatch({ colorHex, size = "md", className = "" }: ColorSwatchProps) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  const isValidHex = colorHex && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colorHex);
  const bgColor = isValidHex ? colorHex : "#e5e7eb";

  return (
    <span
      className={`inline-block rounded-full border border-border flex-shrink-0 ${sizes[size]} ${className}`}
      style={{ backgroundColor: bgColor }}
      title={colorHex ?? "无颜色信息"}
    />
  );
}
