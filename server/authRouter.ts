import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  EMAIL_IN_USE_ERR_MSG,
  INVALID_CREDENTIALS_ERR_MSG,
  ONE_YEAR_MS,
} from "@shared/const";
import { publicProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./passwords";
import * as db from "./db";

const emailSchema = z.string().trim().min(1, "Email is required").email("Enter a valid email");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  signup: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Name is required").max(160),
        email: emailSchema,
        password: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: EMAIL_IN_USE_ERR_MSG });
      }

      // The very first account created on a fresh store becomes the admin/owner.
      // Anyone can promote/demote other accounts from the admin dashboard afterwards.
      const existingUserCount = await db.countUsers();
      const role = existingUserCount === 0 ? "admin" : "user";

      const passwordHash = await hashPassword(input.password);
      const openId = `local_${randomUUID()}`;

      const user = await db.createUserWithPassword({
        openId,
        name: input.name,
        email: input.email,
        passwordHash,
        role,
      });

      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create account" });
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return db.toSafeUser(user);
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : false;

      if (!user || !passwordOk) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_CREDENTIALS_ERR_MSG });
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date().toISOString() });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return db.toSafeUser(user);
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
