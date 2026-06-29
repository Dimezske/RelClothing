import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/ProductCard";

export default function Crystals() {
  const productsQuery = trpc.products.list.useQuery();

  const crystals = useMemo(
    () => (productsQuery.data ?? []).filter((p) => p.category === "Crystals"),
    [productsQuery.data],
  );

  return (
    <div className="container py-12">
      <h1 className="font-display text-3xl tracking-tight">Crystals</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Raw and polished stones, sourced in small lots. Each piece is natural, so color and shape
        vary a little from what's pictured.
      </p>

      {productsQuery.isLoading ? (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] bg-muted" />
              <div className="mt-3 h-4 w-3/4 bg-muted" />
            </div>
          ))}
        </div>
      ) : crystals.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          We're between batches — check back soon for new stones.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {crystals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
