import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { recordPageView } from "./db";

export const analyticsRouter = router({
  track: publicProcedure
    .input(
      z.object({
        path: z.string().min(1).max(256),
        referrer: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await recordPageView({
        path: input.path,
        sessionId: ctx.cartSessionId,
        userId: ctx.user?.id,
        referrer: input.referrer ?? null,
      });
      return { success: true } as const;
    }),
});
