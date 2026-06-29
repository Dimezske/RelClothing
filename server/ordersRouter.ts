import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  createOrder,
  getCartItems,
  getGiftCardByCode,
  getOrderById,
  markOrderPaid,
  markOrderPaidByGiftCardOnly,
  setOrderPaypalOrderId,
} from "./db";
import { capturePaypalOrder, createPaypalOrder, paypalClientConfig } from "./paypal";

export const ordersRouter = router({
  /** Public PayPal client id + whether the server has sandbox/live credentials configured. */
  paypalConfig: publicProcedure.query(() => paypalClientConfig),

  /**
   * Validates a gift card code against the current cart subtotal so the
   * checkout page can show "you'll pay $X by card" before the order is
   * even created. Does not touch the balance — that only happens once the
   * order is actually finalized in capturePayment/instant-finalize below.
   */
  previewGiftCard: publicProcedure
    .input(z.object({ code: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const card = await getGiftCardByCode(input.code);
      if (!card || card.status === "pending_payment" || card.status === "disabled") {
        throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find an active gift card with that code" });
      }
      if (card.balanceCents <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This gift card has no remaining balance" });
      }

      const cartItems = await getCartItems(ctx.cartSessionId);
      const subtotalCents = cartItems.reduce((sum, item) => sum + item.product.effectivePriceCents * item.quantity, 0);
      const appliedCents = Math.min(card.balanceCents, subtotalCents);

      return {
        code: card.code,
        balanceCents: card.balanceCents,
        appliedCents,
        remainingAfterCents: subtotalCents - appliedCents,
      };
    }),

  checkout: publicProcedure
    .input(
      z.object({
        customerName: z.string().min(1, "Name is required"),
        customerEmail: z.string().email("Enter a valid email"),
        shippingAddress: z.string().min(1, "Shipping address is required"),
        giftCardCode: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cartItems = await getCartItems(ctx.cartSessionId);

      if (cartItems.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty" });
      }

      const subtotalCents = cartItems.reduce((sum, item) => sum + item.product.effectivePriceCents * item.quantity, 0);

      let giftCardCode: string | undefined;
      let giftCardCents = 0;

      if (input.giftCardCode) {
        const card = await getGiftCardByCode(input.giftCardCode);
        if (!card || card.status === "pending_payment" || card.status === "disabled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That gift card code isn't valid" });
        }
        if (card.balanceCents <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This gift card has no remaining balance" });
        }
        giftCardCode = card.code;
        giftCardCents = Math.min(card.balanceCents, subtotalCents);
      }

      // Creates the order record (status: pending / unpaid). The cart is kept
      // intact until payment is actually captured via PayPal below, or the
      // order is fully covered by gift card balance.
      const order = await createOrder({
        sessionId: ctx.cartSessionId,
        userId: ctx.user?.id,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        shippingAddress: input.shippingAddress,
        giftCardCode,
        giftCardCents,
        items: cartItems.map((item) => ({
          productId: item.productId,
          productName: item.product.name,
          size: item.size,
          variantName: item.variantName,
          quantity: item.quantity,
          // Snapshot the price actually being charged (post-sale-discount),
          // so the order total matches what the customer saw at checkout
          // even if the sale is later turned off or the percent changes.
          priceCents: item.product.effectivePriceCents,
        })),
      });

      return order;
    }),

  /**
   * Finalizes an order that's fully covered by gift card balance — no
   * PayPal step needed at all. Safe to call repeatedly; a no-op once paid.
   */
  finalizeWithGiftCardOnly: publicProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.sessionId !== ctx.cartSessionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.paymentStatus === "paid") {
        return order;
      }
      if (order.giftCardCents < order.totalCents) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order isn't fully covered by a gift card" });
      }

      return markOrderPaidByGiftCardOnly(order.id);
    }),

  /** Creates the PayPal order for the remaining balance (after any gift card credit) of a pending RelClothing order. */
  createPayment: publicProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.sessionId !== ctx.cartSessionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.paymentStatus === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is already paid" });
      }

      const amountCents = order.totalCents - order.giftCardCents;
      if (amountCents <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This order is fully covered by a gift card — no PayPal payment is needed",
        });
      }

      const paypalOrder = await createPaypalOrder({
        amountCents,
        referenceId: String(order.id),
      });

      await setOrderPaypalOrderId(order.id, paypalOrder.id);

      return { paypalOrderId: paypalOrder.id };
    }),

  /** Captures funds after the buyer approves in the PayPal popup, then finalizes the order. */
  capturePayment: publicProcedure
    .input(z.object({ orderId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order || order.sessionId !== ctx.cartSessionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (!order.paypalOrderId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No PayPal order to capture" });
      }
      if (order.paymentStatus === "paid") {
        return getOrderById(order.id);
      }

      const result = await capturePaypalOrder(order.paypalOrderId);

      if (result.status !== "COMPLETED" || !result.captureId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment was not completed" });
      }

      await markOrderPaid(order.id, result.captureId);

      return getOrderById(order.id);
    }),

  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const order = await getOrderById(input.id);
    return order ?? null;
  }),
});
