import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { randomUUID } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { CART_SESSION_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

export type SafeUser = Omit<User, "passwordHash">;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
  cartSessionId: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: SafeUser | null = null;

  try {
    const authedUser = await sdk.authenticateRequest(opts.req);
    // Never let the password hash leave the server, even via ctx.user in a
    // procedure response (e.g. auth.me returning opts.ctx.user directly).
    if (authedUser) {
      const { passwordHash, ...safeUser } = authedUser;
      user = safeUser;
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Guest shoppers need a stable cart identity even when logged out.
  // Reuse an existing cookie if present, otherwise mint one and set it.
  const incomingCookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  let cartSessionId = incomingCookies[CART_SESSION_COOKIE_NAME];
  if (!cartSessionId) {
    cartSessionId = randomUUID();
    opts.res.cookie(CART_SESSION_COOKIE_NAME, cartSessionId, {
      ...getSessionCookieOptions(opts.req),
      maxAge: ONE_YEAR_MS,
    });
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    cartSessionId,
  };
}
