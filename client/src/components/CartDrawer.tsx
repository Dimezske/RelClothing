import { Link } from "wouter";
import { Minus, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCartUI } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ColorSwatches from "@/components/ColorSwatches";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

export default function CartDrawer() {
  const { isOpen, close } = useCartUI();
  const utils = trpc.useUtils();
  const cartQuery = trpc.cart.list.useQuery();

  const updateQuantity = trpc.cart.updateQuantity.useMutation({
    onSuccess: (data) => utils.cart.list.setData(undefined, data),
  });
  const removeItem = trpc.cart.remove.useMutation({
    onSuccess: (data) => utils.cart.list.setData(undefined, data),
  });

  const items = cartQuery.data ?? [];
  const subtotalCents = items.reduce((sum, item) => sum + item.product.effectivePriceCents * item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display text-xl tracking-tight">
            Your bag {items.length > 0 && `(${items.length})`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="font-display text-lg text-muted-foreground">Your bag is empty</p>
              <p className="text-sm text-muted-foreground">Add something you'll wear often.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <img
                    src={item.variant?.imageUrl || item.product.imageUrl}
                    alt={item.product.name}
                    className="h-24 w-20 flex-none rounded-sm object-cover"
                  />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="tag-line">
                      <span className="font-display text-sm leading-tight">{item.product.name}</span>
                      <span className="tag-line__rule" />
                      <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
                        {item.product.saleActive && item.product.effectivePriceCents < item.product.priceCents && (
                          <span className="text-muted-foreground line-through">
                            {formatPrice(item.product.priceCents * item.quantity)}
                          </span>
                        )}
                        <span>{formatPrice(item.product.effectivePriceCents * item.quantity)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      {!item.product.oneSizeFitsAll && <span>Size {item.size}</span>}
                      {item.variant && (
                        <>
                          {!item.product.oneSizeFitsAll && <span aria-hidden>·</span>}
                          <ColorSwatches
                            variants={[{ name: item.variant.name, colorHexes: JSON.parse(item.variant.colorHexes) }]}
                            size="xs"
                          />
                          <span>{item.variant.name}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-sm border hover:bg-accent disabled:opacity-40"
                        disabled={updateQuantity.isPending}
                        onClick={() =>
                          updateQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-sm border hover:bg-accent disabled:opacity-40"
                        disabled={updateQuantity.isPending}
                        onClick={() =>
                          updateQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove item"
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        disabled={removeItem.isPending}
                        onClick={() => removeItem.mutate({ id: item.id })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t px-5 py-4">
            <div className="tag-line mb-3">
              <span className="font-display text-base">Subtotal</span>
              <span className="tag-line__rule" />
              <span className="text-base font-medium tabular-nums">{formatPrice(subtotalCents)}</span>
            </div>
            <Link href="/checkout" onClick={close} className="w-full">
              <Button className="w-full" size="lg">
                Checkout
              </Button>
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
