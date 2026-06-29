import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { addCartItem, getCartItems, removeCartItem, updateCartItemQuantity } from "./db";

export const cartRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return getCartItems(ctx.cartSessionId);
  }),

  add: publicProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        size: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        variantId: z.number().int().positive().optional(),
        variantName: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await addCartItem({ sessionId: ctx.cartSessionId, ...input });
      return getCartItems(ctx.cartSessionId);
    }),

  updateQuantity: publicProcedure
    .input(z.object({ id: z.number().int().positive(), quantity: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      await updateCartItemQuantity(input.id, ctx.cartSessionId, input.quantity);
      return getCartItems(ctx.cartSessionId);
    }),

  remove: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await removeCartItem(input.id, ctx.cartSessionId);
      return getCartItems(ctx.cartSessionId);
    }),
});
