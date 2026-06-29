import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { listProducts, getProductBySlug } from "./db";

export const productsRouter = router({
  list: publicProcedure.query(async () => {
    return listProducts();
  }),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const product = await getProductBySlug(input.slug);
    return product ?? null;
  }),
});
