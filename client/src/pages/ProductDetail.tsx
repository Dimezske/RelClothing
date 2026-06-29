import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useCartUI } from "@/contexts/CartContext";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ColorSwatches from "@/components/ColorSwatches";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const productQuery = trpc.products.bySlug.useQuery({ slug: slug ?? "" }, { enabled: !!slug });
  const utils = trpc.useUtils();
  const { open } = useCartUI();

  const [size, setSize] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const product = productQuery.data;
  const variants = product?.variants ?? [];

  // Default to the first variant once the product loads, so a swatch is
  // always pre-selected rather than leaving the picker in an empty state.
  useEffect(() => {
    if (variants.length > 0 && variantId === null) {
      setVariantId(variants[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // One-size products (most accessories, all crystals) skip size selection
  // entirely, so default it to the product's single size once loaded.
  useEffect(() => {
    if (product?.oneSizeFitsAll) {
      const sizes: string[] = JSON.parse(product.sizes);
      setSize(sizes[0] ?? "One Size");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: (data) => {
      utils.cart.list.setData(undefined, data);
      setJustAdded(true);
      open();
    },
  });

  if (productQuery.isLoading) {
    return (
      <div className="container grid gap-10 py-12 sm:grid-cols-2">
        <div className="aspect-[4/5] animate-pulse bg-muted" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse bg-muted" />
          <div className="h-4 w-1/4 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-24 text-center">
        <p className="font-display text-xl">We couldn't find that piece.</p>
        <Link href="/shop" className="mt-4 inline-block text-sm underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const sizes: string[] = JSON.parse(product.sizes);
  const swatchVariants = variants.map((v) => ({ id: v.id, name: v.name, colorHexes: JSON.parse(v.colorHexes) as string[] }));
  const selectedVariant = variants.find((v) => v.id === variantId) ?? null;
  const displayImage = selectedVariant?.imageUrl || product.imageUrl;
  const effectivePriceCents = product.effectivePriceCents ?? product.priceCents;
  const onSale = product.saleActive && effectivePriceCents < product.priceCents;

  return (
    <div className="container py-12">
      <div className="grid gap-10 sm:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <img src={displayImage} alt={product.name} className="h-full w-full object-cover" />
          {onSale && (
            <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-background">
              {product.salePercent}% off
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.category}
          </span>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{product.name}</h1>
          <p className="mt-2 flex items-baseline gap-2 text-lg tabular-nums">
            {onSale && (
              <span className="text-muted-foreground line-through">{formatPrice(product.priceCents)}</span>
            )}
            <span className={onSale ? "font-medium" : ""}>{formatPrice(effectivePriceCents)}</span>
          </p>
          <p className="mt-6 max-w-md text-muted-foreground">{product.description}</p>

          {product.inStock ? (
            <>
              {swatchVariants.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Color{selectedVariant ? ` — ${selectedVariant.name}` : ""}
                  </p>
                  <ColorSwatches
                    variants={swatchVariants}
                    selectedId={variantId}
                    onSelect={(v) => setVariantId(v.id as number)}
                    size="md"
                  />
                </div>
              )}

              {!product.oneSizeFitsAll && (
                <div className="mt-8">
                  <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={cn(
                          "flex h-10 min-w-10 items-center justify-center rounded-sm border px-3 text-sm",
                          size === s ? "border-foreground bg-foreground text-background" : "hover:bg-accent",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                size="lg"
                className="mt-8 w-full sm:w-auto"
                disabled={!size || addToCart.isPending}
                onClick={() => {
                  if (!size) return;
                  setJustAdded(false);
                  addToCart.mutate({
                    productId: product.id,
                    size,
                    quantity: 1,
                    variantId: selectedVariant?.id,
                    variantName: selectedVariant?.name,
                  });
                }}
              >
                {addToCart.isPending ? "Adding…" : justAdded ? "Added to bag" : "Add to bag"}
              </Button>
              {!size && !product.oneSizeFitsAll && (
                <p className="mt-2 text-xs text-muted-foreground">Select a size to continue.</p>
              )}
            </>
          ) : (
            <p className="mt-8 text-sm uppercase tracking-wide text-muted-foreground">
              Currently sold out
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
