import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OrderRow = {
  id: number;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  refundedCents: number;
  giftCardCents: number;
  giftCardCode: string | null;
  status: "pending" | "confirmed" | "shipped" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded" | "partially_refunded";
  createdAt: string;
};

const statusVariant: Record<OrderRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "secondary",
  shipped: "default",
  cancelled: "destructive",
};

const paymentVariant: Record<OrderRow["paymentStatus"], "default" | "secondary" | "destructive" | "outline"> = {
  unpaid: "outline",
  paid: "default",
  refunded: "destructive",
  partially_refunded: "secondary",
};

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.admin.orders.useQuery();
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);

  const updateStatus = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => utils.admin.orders.invalidate(),
  });

  const orders = ordersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Manage fulfillment status and issue refunds.</p>
      </div>

      {ordersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>
                    <div className="text-sm">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPrice(order.totalCents)}
                    {order.refundedCents > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(order.refundedCents)} refunded
                      </div>
                    )}
                    {order.giftCardCents > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatPrice(order.giftCardCents)} via gift card {order.giftCardCode}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentVariant[order.paymentStatus]}>
                      {order.paymentStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(status) =>
                        updateStatus.mutate({ orderId: order.id, status: status as OrderRow["status"] })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue>
                          <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">pending</SelectItem>
                        <SelectItem value="confirmed">confirmed</SelectItem>
                        <SelectItem value="shipped">shipped</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={order.paymentStatus === "unpaid" || order.paymentStatus === "refunded"}
                      onClick={() => setRefundTarget(order)}
                    >
                      Refund
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RefundDialog
        order={refundTarget}
        onClose={() => setRefundTarget(null)}
        onRefunded={() => utils.admin.orders.invalidate()}
      />
    </div>
  );
}

function RefundDialog({
  order,
  onClose,
  onRefunded,
}: {
  order: OrderRow | null;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const refund = trpc.admin.refundOrder.useMutation({
    onSuccess: () => {
      onRefunded();
      onClose();
      setAmount("");
      setReason("");
    },
  });

  const remainingCents = order ? order.totalCents - order.refundedCents : 0;

  return (
    <Dialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund order #{order?.id}</DialogTitle>
          <DialogDescription>
            Remaining refundable balance: {order ? formatPrice(remainingCents) : ""}. Leave amount blank for a
            full refund of that balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount (USD)</Label>
            <Input
              id="refund-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder={order ? (remainingCents / 100).toFixed(2) : ""}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason (optional)</Label>
            <Input
              id="refund-reason"
              placeholder="e.g. Item arrived damaged"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {refund.error && <p className="text-sm text-destructive">{refund.error.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={refund.isPending || !order}
            onClick={() => {
              if (!order) return;
              const amountCents = amount ? Math.round(parseFloat(amount) * 100) : undefined;
              refund.mutate({ orderId: order.id, amountCents, reason: reason || undefined });
            }}
          >
            {refund.isPending ? "Refunding…" : "Issue refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
