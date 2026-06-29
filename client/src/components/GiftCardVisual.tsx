import { cn } from "@/lib/utils";

/**
 * A gift card face sized to the real-world standard — ISO/IEC 7810 ID-1
 * (a.k.a. CR80), the same physical proportions as an actual credit or gift
 * card: 85.6mm x 53.98mm, ~1.586:1. Scales to fill its container (a grid
 * cell, or a fixed max-width wrapper for the one-off "here's your card"
 * screens) rather than a hardcoded pixel size, so it never forces its own
 * horizontal scrollbar — but the shape is always a true, shrunk-to-fit
 * version of a real card, not an arbitrary rectangle.
 */
export default function GiftCardVisual({
  label,
  sublabel,
  selected = false,
  onClick,
  className,
}: {
  /** Big focal text — usually the dollar amount, e.g. "$50". */
  label: string;
  /** Small text under the label — a code, "store credit", etc. */
  sublabel?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      aria-pressed={onClick ? selected : undefined}
      onClick={onClick}
      className={cn(
        "relative flex aspect-[85.6/53.98] w-full min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-4 text-left transition-all",
        "bg-linear-to-br from-primary to-[oklch(0.26_0.05_45)] text-primary-foreground",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "shadow-sm",
        className,
      )}
    >
      {/* Faint decorative rings, like a card's chip/texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-white/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-1 h-14 w-14 rounded-full border border-white/15"
      />

      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-white/70 sm:text-xs">
        <span>RelClothing</span>
        <span>Gift Card</span>
      </div>

      <div>
        <p className="font-display text-2xl tracking-tight sm:text-3xl">{label}</p>
        {sublabel && <p className="mt-1 truncate text-[11px] text-white/70 sm:text-xs">{sublabel}</p>}
      </div>
    </Tag>
  );
}
