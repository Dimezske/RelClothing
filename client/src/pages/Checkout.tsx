import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PayPalButton } from "@/components/PayPalButton";
import { Gift, X } from "lucide-react";

export default function Checkout() {
  const [, navigate] = useLocation();
  const cartQuery = trpc.cart.list.useQuery();
  const paypalConfigQuery = trpc.orders.paypalConfig.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedGiftCardCode, setAppliedGiftCardCode] = useState<string | null>(null);

  const items = cartQuery.data ?? [];
  const subtotalCents = items.reduce((sum, item) => sum + item.product.effectivePriceCents * item.quantity, 0);
  const originalSubtotalCents = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const totalSavingsCents = originalSubtotalCents - subtotalCents;

  const giftCardPreview = trpc.orders.previewGiftCard.useQuery(
    { code: appliedGiftCardCode ?? "" },
    { enabled: !!appliedGiftCardCode && !pendingOrderId },
  );

  const checkout = trpc.orders.checkout.useMutation({
    onSuccess: (order) => {
      setPaymentError(null);
      setPendingOrderId(order.id);
    },
  });

  const createPayment = trpc.orders.createPayment.useMutation();
  const capturePayment = trpc.orders.capturePayment.useMutation({
    onSuccess: (order) => {
      utils.cart.list.invalidate();
      if (order) navigate(`/order/${order.id}`);
    },
  });
  const finalizeWithGiftCardOnly = trpc.orders.finalizeWithGiftCardOnly.useMutation({
    onSuccess: (order) => {
      utils.cart.list.invalidate();
      if (order) navigate(`/order/${order.id}`);
    },
  });

  if (!cartQuery.isLoading && items.length === 0 && !pendingOrderId) {
    return (
      <div className="container py-24 text-center">
        <p className="font-display text-xl">Your bag is empty.</p>
        <Button className="mt-6" onClick={() => navigate("/shop")}>
          Continue shopping
        </Button>
      </div>
    );
  }

  const paypalReady = paypalConfigQuery.data?.configured;
  const giftCardAppliedCents = giftCardPreview.data?.appliedCents ?? 0;
  const amountDueCents = Math.max(0, subtotalCents - giftCardAppliedCents);
  const fullyCoveredByGiftCard = giftCardAppliedCents > 0 && amountDueCents === 0;

  return (
    <div className="container py-12">
      <h1 className="font-display text-3xl tracking-tight">Checkout</h1>

      <div className="mt-10 grid gap-12 sm:grid-cols-2">
        <div className="space-y-5">
          {!pendingOrderId ? (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                checkout.mutate({
                  customerName: name,
                  customerEmail: email,
                  shippingAddress: address,
                  giftCardCode: appliedGiftCardCode ?? undefined,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Shipping address</Label>
                <Textarea
                  id="address"
                  required
                  rows={4}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, state, postal code"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gift-card">Gift card code (optional)</Label>
                {appliedGiftCardCode ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{appliedGiftCardCode}</span>
                      {giftCardPreview.data && (
                        <span className="text-muted-foreground">
                          — applying {formatPrice(giftCardPreview.data.appliedCents)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Remove gift card"
                      onClick={() => {
                        setAppliedGiftCardCode(null);
                        setGiftCardCode("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="gift-card"
                      placeholder="REL-XXXX-XXXX"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value)}
                      className="font-mono uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!giftCardCode.trim()}
                      onClick={() => setAppliedGiftCardCode(giftCardCode.trim())}
                    >
                      Apply
                    </Button>
                  </div>
                )}
                {appliedGiftCardCode && giftCardPreview.isError && (
                  <p className="text-sm text-destructive">{giftCardPreview.error.message}</p>
                )}
              </div>

              {checkout.error && (
                <p className="text-sm text-destructive">{checkout.error.message}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={checkout.isPending}>
                {checkout.isPending ? "Continuing…" : `Continue to payment — ${formatPrice(amountDueCents)}`}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{name}</p>
                <p className="text-muted-foreground">{email}</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{address}</p>
                <button
                  type="button"
                  className="mt-2 text-xs underline underline-offset-4"
                  onClick={() => setPendingOrderId(null)}
                >
                  Edit details
                </button>
              </div>

              {fullyCoveredByGiftCard ? (
                <div>
                  <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Covered by gift card
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Your gift card covers the full order total — no card payment needed.
                  </p>
                  <Button
                    size="lg"
                    className="mt-4 w-full"
                    disabled={finalizeWithGiftCardOnly.isPending}
                    onClick={() => finalizeWithGiftCardOnly.mutate({ orderId: pendingOrderId })}
                  >
                    {finalizeWithGiftCardOnly.isPending ? "Placing order…" : "Place order"}
                  </Button>
                  {finalizeWithGiftCardOnly.error && (
                    <p className="mt-3 text-sm text-destructive">{finalizeWithGiftCardOnly.error.message}</p>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Pay with PayPal
                  </h2>

                  {!paypalReady ? (
                    <p className="text-sm text-muted-foreground">
                      PayPal isn't configured yet. Add <code>PAYPAL_CLIENT_ID</code> and{" "}
                      <code>PAYPAL_CLIENT_SECRET</code> to the server's <code>.env</code> file (free PayPal
                      Sandbox credentials work for testing) and restart the server.
                    </p>
                  ) : (
                    <PayPalButton
                      clientId={paypalConfigQuery.data!.clientId}
                      createOrder={async () => {
                        const result = await createPayment.mutateAsync({ orderId: pendingOrderId });
                        return result.paypalOrderId;
                      }}
                      onApprove={async () => {
                        await capturePayment.mutateAsync({ orderId: pendingOrderId });
                      }}
                      onError={(message) => setPaymentError(message)}
                    />
                  )}

                  {paymentError && <p className="mt-3 text-sm text-destructive">{paymentError}</p>}
                  {capturePayment.isPending && (
                    <p className="mt-3 text-sm text-muted-foreground">Confirming your payment…</p>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Payments are processed securely by PayPal. Sandbox mode means no real money moves while
            testing.
          </p>
        </div>

        <div>
          <h2 className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">Order summary</h2>
          <ul className="divide-y border-t">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-4">
                <img
                  src={item.variant?.imageUrl || item.product.imageUrl}
                  alt={item.product.name}
                  className="h-16 w-14 flex-none rounded-sm object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <div className="tag-line">
                    <span className="text-sm">{item.product.name}</span>
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
                  <p className="text-xs text-muted-foreground">
                    {!item.product.oneSizeFitsAll && <>Size {item.size} · </>}
                    {item.variant && <>{item.variant.name} · </>}
                    Qty {item.quantity}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t pt-4">
            <div className="tag-line">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="tag-line__rule" />
              <span className="text-sm tabular-nums">{formatPrice(subtotalCents)}</span>
            </div>
            {totalSavingsCents > 0 && (
              <div className="tag-line mt-2">
                <span className="text-sm text-muted-foreground">Sale savings</span>
                <span className="tag-line__rule" />
                <span className="text-sm tabular-nums">-{formatPrice(totalSavingsCents)}</span>
              </div>
            )}
            {giftCardAppliedCents > 0 && (
              <div className="tag-line mt-2">
                <span className="text-sm text-muted-foreground">Gift card</span>
                <span className="tag-line__rule" />
                <span className="text-sm tabular-nums">-{formatPrice(giftCardAppliedCents)}</span>
              </div>
            )}
            <div className="tag-line mt-2">
              <span className="font-display text-base">Total due</span>
              <span className="tag-line__rule" />
              <span className="text-base font-medium tabular-nums">{formatPrice(amountDueCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
