import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const orderQuery = trpc.orders.byId.useQuery(
    { id: Number(id) },
    { enabled: !!id && !Number.isNaN(Number(id)) },
  );

  if (orderQuery.isLoading) {
    return <div className="container py-24 text-center text-muted-foreground">Loading order…</div>;
  }

  const order = orderQuery.data;

  if (!order) {
    return (
      <div className="container py-24 text-center">
        <p className="font-display text-xl">We couldn't find that order.</p>
        <Link href="/shop">
          <Button className="mt-6">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-xl py-16">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Order #{order.id}</span>
      <h1 className="mt-2 font-display text-3xl tracking-tight">Thanks, {order.customerName.split(" ")[0]}.</h1>
      <p className="mt-2 text-muted-foreground">
        Your order is confirmed. A note has been sent to {order.customerEmail}.
      </p>

      <ul className="mt-8 divide-y border-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {item.size !== "One Size" && <>Size {item.size} · </>}
                {item.variantName && <>{item.variantName} · </>}
                Qty {item.quantity}
              </p>
            </div>
            <span className="text-sm tabular-nums">{formatPrice(item.priceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <div className="tag-line">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="tag-line__rule" />
          <span className="text-sm tabular-nums">{formatPrice(order.totalCents)}</span>
        </div>
        {order.giftCardCents > 0 && (
          <div className="tag-line mt-2">
            <span className="text-sm text-muted-foreground">Gift card {order.giftCardCode}</span>
            <span className="tag-line__rule" />
            <span className="text-sm tabular-nums">-{formatPrice(order.giftCardCents)}</span>
          </div>
        )}
        <div className="tag-line mt-2">
          <span className="font-display text-base">Total paid</span>
          <span className="tag-line__rule" />
          <span className="text-base font-medium tabular-nums">
            {formatPrice(order.totalCents - order.giftCardCents)}
          </span>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">Shipping to: {order.shippingAddress}</p>

      <Link href="/shop">
        <Button className="mt-8">Continue shopping</Button>
      </Link>
    </div>
  );
}
