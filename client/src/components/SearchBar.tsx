import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Storefront search — a magnifying-glass button that expands into an input
 * on desktop (so it doesn't permanently eat header space), and a
 * plain always-visible input when rendered inside the mobile menu.
 */
export default function SearchBar({
  variant = "expandable",
  autoFocus = false,
  onNavigate,
}: {
  /** "expandable": icon-only until clicked (desktop header). "inline": always-open input (mobile menu). */
  variant?: "expandable" | "inline";
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(variant === "inline");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  function submit() {
    const q = value.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onNavigate?.();
    if (variant === "expandable") setExpanded(false);
  }

  if (variant === "expandable" && !expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setExpanded(true)}
        className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-accent"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "flex items-center gap-2 rounded-full border bg-background px-3",
        variant === "expandable" ? "h-9 w-56" : "h-10 w-full",
      )}
    >
      <Search className="h-4 w-4 flex-none text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products…"
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="flex-none text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {variant === "expandable" && (
        <button
          type="button"
          aria-label="Close search"
          onClick={() => {
            setExpanded(false);
            setValue("");
          }}
          className="flex-none text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
