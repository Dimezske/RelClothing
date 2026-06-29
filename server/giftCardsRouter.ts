import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { capturePaypalOrder, createPaypalOrder, paypalClientConfig } from "./paypal";

/** Preset denominations shown on the Gift Cards tab; the client also offers a custom amount. */
export const GIFT_CARD_PRESET_CENTS = [2500, 5000, 10000, 15000, 25000] as const;

export const giftCardsRouter = router({
  paypalConfig: publicProcedure.query(() => paypalClientConfig),

  /** Public lookup so anyone with a code can check their remaining store credit. */
  checkBalance: publicProcedure
    .input(z.object({ code: z.string().trim().min(1, "Enter a gift card code") }))
    .query(async ({ input }) => {
      const card = await db.getGiftCardByCode(input.code);
      if (!card || card.status === "pending_payment") {
        throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find a gift card with that code" });
      }
      return {
        code: card.code,
        balanceCents: card.balanceCents,
        initialValueCents: card.initialValueCents,
        status: card.status,
      };
    }),

  /** Step 1: create a pending gift card record so we have an id/code to attach payment to. */
  purchase: publicProcedure
    .input(
      z.object({
        valueCents: z
          .number()
          .int()
          .min(500, "Minimum gift card value is $5")
          .max(100000, "Maximum gift card value is $1,000"),
        recipientName: z.string().trim().max(160).optional(),
        recipientEmail: z.string().trim().email().optional().or(z.literal("")),
        message: z.string().trim().max(500).optional(),
        purchaserEmail: z.string().trim().email().optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const card = await db.createGiftCard({
        valueCents: input.valueCents,
        purchaserUserId: ctx.user?.id,
        purchaserEmail: input.purchaserEmail || ctx.user?.email || undefined,
        recipientName: input.recipientName || undefined,
        recipientEmail: input.recipientEmail || undefined,
        message: input.message || undefined,
      });
      return card;
    }),

  /** Step 2: create the PayPal order for an existing pending gift card. */
  createPayment: publicProcedure
    .input(z.object({ giftCardId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const card = await db.getGiftCardById(input.giftCardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Gift card not found" });
      if (card.status !== "pending_payment") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This gift card has already been paid for" });
      }

      const paypalOrder = await createPaypalOrder({
        amountCents: card.initialValueCents,
        referenceId: `giftcard-${card.id}`,
      });

      await db.setGiftCardPaypalOrderId(card.id, paypalOrder.id);

      return { paypalOrderId: paypalOrder.id };
    }),

  /** Step 3: capture funds and activate the card so its code becomes redeemable. */
  capturePayment: publicProcedure
    .input(z.object({ giftCardId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const card = await db.getGiftCardById(input.giftCardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Gift card not found" });
      if (card.status !== "pending_payment") {
        return card;
      }
      if (!card.paypalOrderId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No PayPal order to capture" });
      }

      const result = await capturePaypalOrder(card.paypalOrderId);
      if (result.status !== "COMPLETED" || !result.captureId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment was not completed" });
      }

      return db.activateGiftCard(card.id, result.captureId);
    }),

  byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const card = await db.getGiftCardById(input.id);
    return card ?? null;
  }),

  /** Gift cards the signed-in user has purchased and successfully paid for. */
  myGiftCards: protectedProcedure.query(async ({ ctx }) => {
    const cards = await db.listGiftCardsForUser(ctx.user.id);
    return cards.filter((c) => c.status !== "pending_payment");
  }),
});
