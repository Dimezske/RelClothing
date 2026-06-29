import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "wouter";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/ProductCard";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export default function Shop() {
  const productsQuery = trpc.products.list.useQuery();
  const [category, setCategory] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Keep the input in sync if the URL's ?q= changes from elsewhere (e.g. the
  // header search bar navigating here with a new term).
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const categories = useMemo(() => {
    const set = new Set((productsQuery.data ?? []).map((p) => p.category));
    return Array.from(set);
  }, [productsQuery.data]);

  const filtered = useMemo(() => {
    const all = productsQuery.data ?? [];
    const byCategory = category ? all.filter((p) => p.category === category) : all;
    const q = urlQuery.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [productsQuery.data, category, urlQuery]);

  function submitSearch() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (query.trim()) {
        next.set("q", query.trim());
      } else {
        next.delete("q");
      }
      return next;
    });
  }

  return (
    <div className="container py-12">
      <h1 className="font-display text-3xl tracking-tight">Shop</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Every piece is made in small batches and restocked rarely. What's here is what's here.
      </p>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="mt-6 flex h-11 max-w-sm items-center gap-2 rounded-full border px-4"
      >
        <Search className="h-4 w-4 flex-none text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("q");
                return next;
              });
            }}
            className="flex-none text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="mt-6 flex flex-wrap gap-2 border-b pb-6">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs uppercase tracking-wide",
            category === null ? "bg-foreground text-background" : "hover:bg-accent",
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs uppercase tracking-wide",
              category === c ? "bg-foreground text-background" : "hover:bg-accent",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {urlQuery && (
        <p className="mt-6 text-sm text-muted-foreground">
          {filtered.length === 0
            ? `No results for "${urlQuery}"`
            : `${filtered.length} result${filtered.length === 1 ? "" : "s"} for "${urlQuery}"`}
        </p>
      )}

      {productsQuery.isLoading ? (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] bg-muted" />
              <div className="mt-3 h-4 w-3/4 bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {urlQuery ? "Try a different search term." : "No products in this category yet."}
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
