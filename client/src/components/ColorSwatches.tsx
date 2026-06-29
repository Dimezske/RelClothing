import { cn } from "@/lib/utils";

/**
 * Renders a row of small color "spheres" for a product's variants — a
 * solid color renders as a flat-tinted sphere, multiple colors render as a
 * conic-gradient sphere (e.g. a tie-dye or multi-tone colorway) so it reads
 * at a glance as "this one has several colors in it".
 */
function swatchBackground(colorHexes: string[]): string {
  if (colorHexes.length <= 1) {
    return colorHexes[0] ?? "#cccccc";
  }
  const step = 360 / colorHexes.length;
  const stops = colorHexes
    .map((hex, i) => `${hex} ${i * step}deg ${(i + 1) * step}deg`)
    .join(", ");
  return `conic-gradient(${stops})`;
}

export type SwatchVariant = {
  id?: number;
  name: string;
  colorHexes: string[];
};

export default function ColorSwatches({
  variants,
  selectedId,
  onSelect,
  size = "sm",
  className,
}: {
  variants: SwatchVariant[];
  /** Selected variant id (or name, for cases without a stable id) for the ring highlight. */
  selectedId?: number | string | null;
  onSelect?: (variant: SwatchVariant) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  if (!variants || variants.length === 0) return null;

  const dims = size === "xs" ? "h-3.5 w-3.5" : size === "md" ? "h-6 w-6" : "h-4.5 w-4.5";

  return (
    <div className={cn("flex items-center gap-1.5", className)} role={onSelect ? "radiogroup" : undefined}>
      {variants.map((variant, i) => {
        const key = variant.id ?? variant.name ?? i;
        const isSelected = selectedId != null && (variant.id ?? variant.name) === selectedId;
        const interactive = Boolean(onSelect);
        const Tag = interactive ? "button" : "span";

        return (
          <Tag
            key={key}
            type={interactive ? "button" : undefined}
            role={interactive ? "radio" : undefined}
            aria-checked={interactive ? isSelected : undefined}
            aria-label={variant.name}
            title={variant.name}
            onClick={interactive ? () => onSelect?.(variant) : undefined}
            className={cn(
              "shrink-0 rounded-full border border-black/10 shadow-sm transition-transform",
              dims,
              interactive && "hover:scale-110",
              isSelected && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
            )}
            style={{ background: swatchBackground(variant.colorHexes) }}
          />
        );
      })}
    </div>
  );
}
