import { Link } from "wouter";
import type { Product, ProductVariant } from "@shared/types";
import { formatPrice } from "@/lib/utils";
import ColorSwatches from "./ColorSwatches";

type ProductWithVariants = Product & { variants?: ProductVariant[]; effectivePriceCents?: number };

export default function ProductCard({ product }: { product: ProductWithVariants }) {
  const variants = product.variants ?? [];
  const effectivePriceCents = product.effectivePriceCents ?? product.priceCents;
  const onSale = product.saleActive && effectivePriceCents < product.priceCents;

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {onSale && (
          <span className="absolute left-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
            {product.salePercent}% off
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="bg-background px-3 py-1 text-xs uppercase tracking-wide">
              Sold out
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base leading-tight">{product.name}</h3>
        <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
          {onSale && (
            <span className="text-muted-foreground line-through">{formatPrice(product.priceCents)}</span>
          )}
          <span className={onSale ? "font-medium text-foreground" : "text-muted-foreground"}>
            {formatPrice(effectivePriceCents)}
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.category}</p>
        {variants.length > 0 && (
          <ColorSwatches
            variants={variants.map((v) => ({ id: v.id, name: v.name, colorHexes: JSON.parse(v.colorHexes) }))}
            size="xs"
          />
        )}
      </div>
    </Link>
  );
}
