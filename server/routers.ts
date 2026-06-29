import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { productsRouter } from "./productsRouter";
import { cartRouter } from "./cartRouter";
import { ordersRouter } from "./ordersRouter";
import { authRouter } from "./authRouter";
import { adminRouter } from "./adminRouter";
import { analyticsRouter } from "./analyticsRouter";
import { giftCardsRouter } from "./giftCardsRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,

  products: productsRouter,
  cart: cartRouter,
  orders: ordersRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  giftCards: giftCardsRouter,
});

export type AppRouter = typeof appRouter;
