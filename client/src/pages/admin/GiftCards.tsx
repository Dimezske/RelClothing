import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type GiftCardStatus = "active" | "depleted" | "disabled";

const statusVariant: Record<GiftCardStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  depleted: "secondary",
  disabled: "destructive",
};

export default function AdminGiftCards() {
  const utils = trpc.useUtils();
  const giftCardsQuery = trpc.admin.giftCards.useQuery();

  const setStatus = trpc.admin.setGiftCardStatus.useMutation({
    onSuccess: () => utils.admin.giftCards.invalidate(),
  });

  const cards = giftCardsQuery.data ?? [];
  const totalOutstandingCents = cards
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + c.balanceCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gift Cards</h1>
          <p className="text-sm text-muted-foreground">
            Store credit issued through the storefront's Gift Cards tab.
          </p>
        </div>
        <div className="rounded-md border px-4 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding balance</p>
          <p className="text-lg font-semibold tabular-nums">{formatPrice(totalOutstandingCents)}</p>
        </div>
      </div>

      {giftCardsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading gift cards…</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gift cards purchased yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Purchaser</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Original value</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-mono text-sm">{card.code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {card.purchaserEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {card.recipientName ? (
                      <>
                        {card.recipientName}
                        {card.recipientEmail && (
                          <div className="text-xs">{card.recipientEmail}</div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatPrice(card.initialValueCents)}</TableCell>
                  <TableCell className="tabular-nums">{formatPrice(card.balanceCents)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[card.status as GiftCardStatus]}>{card.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(card.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {card.status === "disabled" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: card.id, status: "active" })}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: card.id, status: "disabled" })}
                      >
                        Disable
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
