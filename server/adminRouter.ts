import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { refundPaypalCapture } from "./paypal";

const colorVariantInput = z.object({
  name: z.string().trim().min(1, "Variant name is required").max(80),
  colorHexes: z
    .array(z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, "Use a hex color like #1c1c1c"))
    .min(1, "Add at least one color")
    .max(6, "Up to 6 colors per swatch"),
  imageUrl: z.string().trim().optional(),
});

const productInput = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  name: z.string().trim().min(1, "Name is required").max(160),
  description: z.string().trim().min(1, "Description is required"),
  priceCents: z.number().int().min(0, "Price can't be negative"),
  category: z.string().trim().min(1, "Category is required").max(80),
  imageUrl: z.string().trim().min(1, "Image is required"),
  sizes: z.array(z.string().trim().min(1)).min(1, "Add at least one size"),
  inStock: z.boolean().default(true),
  oneSizeFitsAll: z.boolean().default(false),
  /** Percent off (1-99) to use when saleActive is toggled on. Null/undefined clears the sale entirely. */
  salePercent: z.number().int().min(1, "Minimum discount is 1%").max(99, "Maximum discount is 99%").nullable().optional(),
  saleActive: z.boolean().default(false),
  /** Color variants to fully replace on save. Omit to leave existing variants untouched. */
  variants: z.array(colorVariantInput).max(12).optional(),
});

export const adminRouter = router({
  // ── Traffic ───────────────────────────────────────────────────────────
  traffic: adminProcedure.input(z.object({ days: z.number().int().min(1).max(90).default(14) })).query(({ input }) => {
    return db.getTrafficSummary(input.days);
  }),

  // ── Orders / refunds ─────────────────────────────────────────────────
  orders: adminProcedure.query(() => db.listOrders()),

  updateOrderStatus: adminProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        status: z.enum(["pending", "confirmed", "shipped", "cancelled"]),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateOrderStatus(input.orderId, input.status);
      return db.getOrderById(input.orderId);
    }),

  refundOrder: adminProcedure
    .input(
      z.object({
        orderId: z.number().int().positive(),
        // Omit for a full refund of whatever remains uncaptured-back.
        amountCents: z.number().int().positive().optional(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const order = await db.getOrderById(input.orderId);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.paymentStatus === "unpaid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order was never paid, so there's nothing to refund" });
      }
      if (order.paymentStatus === "refunded") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order is already fully refunded" });
      }
      if (!order.paypalCaptureId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No PayPal capture found for this order" });
      }

      const remaining = order.totalCents - order.refundedCents;
      const amountCents = input.amountCents ?? remaining;

      if (amountCents > remaining) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Refund amount exceeds the remaining refundable balance ($${(remaining / 100).toFixed(2)})`,
        });
      }

      try {
        await refundPaypalCapture(order.paypalCaptureId, amountCents);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "PayPal refund failed",
        });
      }

      return db.recordRefund(input.orderId, amountCents, input.reason);
    }),

  // ── Products ──────────────────────────────────────────────────────────
  createProduct: adminProcedure.input(productInput).mutation(async ({ input }) => {
    const existing = await db.getProductBySlug(input.slug);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "A product with that slug already exists" });
    }
    const { variants, ...productFields } = input;
    const created = await db.createProduct({ ...productFields, sizes: JSON.stringify(input.sizes) });

    if (variants && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        await db.createVariant({
          productId: created.id,
          name: v.name,
          colorHexes: JSON.stringify(v.colorHexes),
          imageUrl: v.imageUrl || null,
          sortOrder: i,
        });
      }
    }

    return db.getProductById(created.id);
  }),

  updateProduct: adminProcedure
    .input(productInput.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, sizes, variants, ...rest } = input;
      const updated = await db.updateProduct(id, {
        ...rest,
        ...(sizes ? { sizes: JSON.stringify(sizes) } : {}),
      });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      // Variants are replaced wholesale when provided, since the admin form
      // always submits its full current list rather than a diff.
      if (variants) {
        await db.deleteVariantsForProduct(id);
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          await db.createVariant({
            productId: id,
            name: v.name,
            colorHexes: JSON.stringify(v.colorHexes),
            imageUrl: v.imageUrl || null,
            sortOrder: i,
          });
        }
      }

      return db.getProductById(id);
    }),

  deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.deleteProduct(input.id);
    return { success: true } as const;
  }),

  /**
   * Quick on/off switch for a product's sale, used by the table-row toggle
   * so an admin doesn't have to open the full edit form just to flip it.
   * Turning a sale on without a salePercent set is rejected — there's
   * nothing to discount by yet.
   */
  toggleProductSale: adminProcedure
    .input(z.object({ id: z.number().int().positive(), saleActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const product = await db.getProductById(input.id);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      if (input.saleActive && !product.salePercent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Set a discount percentage before turning the sale on" });
      }
      return db.updateProduct(input.id, { saleActive: input.saleActive });
    }),

  /** Sets (or clears) a product's discount percentage independent of whether the sale is currently on. */
  setProductSalePercent: adminProcedure
    .input(z.object({ id: z.number().int().positive(), salePercent: z.number().int().min(1).max(99).nullable() }))
    .mutation(async ({ input }) => {
      const updated = await db.updateProduct(input.id, {
        salePercent: input.salePercent,
        // Clearing the percentage also turns the sale off, so the product
        // never ends up "active" with no discount applied.
        ...(input.salePercent === null ? { saleActive: false } : {}),
      });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return updated;
    }),

  // ── Users ─────────────────────────────────────────────────────────────
  users: adminProcedure.query(async () => {
    const allUsers = await db.listUsers();
    return allUsers.map(db.toSafeUser);
  }),

  setUserRole: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove your own admin access" });
      }
      await db.updateUserRole(input.userId, input.role);
      const updated = await db.getUserById(input.userId);
      return updated ? db.toSafeUser(updated) : null;
    }),

  // ── Gift cards ────────────────────────────────────────────────────────
  giftCards: adminProcedure.query(async () => {
    const cards = await db.listGiftCards();
    // Pending-payment cards that never completed checkout are just noise here.
    return cards.filter((c) => c.status !== "pending_payment");
  }),

  giftCardTransactions: adminProcedure
    .input(z.object({ giftCardId: z.number().int().positive() }))
    .query(({ input }) => db.listGiftCardTransactions(input.giftCardId)),

  setGiftCardStatus: adminProcedure
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "disabled"]) }))
    .mutation(async ({ input }) => {
      await db.setGiftCardStatus(input.id, input.status);
      return { success: true } as const;
    }),
});
