import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { Gem, Gift } from "lucide-react";

export default function Home() {
  const productsQuery = trpc.products.list.useQuery();
  const featured = (productsQuery.data ?? []).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-background">
        <div className="container flex flex-col items-start gap-6 py-20 sm:py-28">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Autumn essentials
          </span>
          <h1 className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Clothes built to be worn often, not just bought once.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Considered fabrics, relaxed cuts, and a small catalog we actually stand behind.
            No drops, no hype — just the things you'll reach for every week.
          </p>
          <Link href="/shop">
            <Button size="lg">Shop the catalog</Button>
          </Link>
        </div>
      </section>

      {/* Featured products */}
      <section className="container py-16">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight">New &amp; notable</h2>
          <Link href="/shop" className="text-sm uppercase tracking-wide text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>

        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-muted" />
                <div className="mt-3 h-4 w-3/4 bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Crystals + Gift Cards */}
      <section className="border-t bg-muted/30">
        <div className="container grid gap-px sm:grid-cols-2">
          <Link
            href="/crystals"
            className="group flex flex-col gap-3 bg-background p-8 transition-colors hover:bg-accent sm:p-12"
          >
            <Gem className="h-6 w-6 text-muted-foreground" />
            <h3 className="font-display text-xl tracking-tight">Crystals</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Raw and polished stones, sourced in small lots — amethyst, rose quartz, citrine, and
              more.
            </p>
            <span className="mt-1 text-sm underline underline-offset-4 group-hover:no-underline">
              Browse crystals
            </span>
          </Link>
          <Link
            href="/gift-cards"
            className="group flex flex-col gap-3 bg-background p-8 transition-colors hover:bg-accent sm:p-12"
          >
            <Gift className="h-6 w-6 text-muted-foreground" />
            <h3 className="font-display text-xl tracking-tight">Gift Cards</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Digital store credit for anything in the shop — clothing, accessories, or crystals.
            </p>
            <span className="mt-1 text-sm underline underline-offset-4 group-hover:no-underline">
              Buy a gift card
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
