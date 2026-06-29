import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  InsertUser,
  users,
  products,
  productVariants,
  cartItems,
  orders,
  orderItems,
  pageViews,
  giftCards,
  giftCardTransactions,
  type InsertProduct,
  type InsertProductVariant,
  type InsertGiftCard,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      const url = process.env.DATABASE_URL ?? "file:./local.db";
      const client = createClient({ url });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      const raw: unknown = user.lastSignedIn;
      const normalized = raw instanceof Date ? raw.toISOString() : (raw as string);
      values.lastSignedIn = normalized;
      updateSet.lastSignedIn = normalized;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date().toISOString();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date().toISOString();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Strips sensitive fields (passwordHash) before a user record is sent to the
 * client. Always pass user objects through this before returning them from
 * a tRPC procedure.
 */
export function toSafeUser<T extends { passwordHash?: string | null }>(
  user: T,
): Omit<T, "passwordHash"> {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: users.id }).from(users);
  return result.length;
}

export async function createUserWithPassword(input: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [created] = await db
    .insert(users)
    .values({
      openId: input.openId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      loginMethod: "email",
      role: input.role,
      lastSignedIn: new Date().toISOString(),
    })
    .returning();

  return created;
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.id);
}

// ── Products ────────────────────────────────────────────────────────────

/**
 * Computes the price a customer actually pays: priceCents minus salePercent
 * when the sale is toggled on. Rounds to the nearest cent rather than
 * truncating, so e.g. 20% off $19.99 reads as $15.99, not $15.98.
 */
export function getEffectivePriceCents(product: { priceCents: number; salePercent: number | null; saleActive: boolean }) {
  if (!product.saleActive || !product.salePercent) return product.priceCents;
  const pct = Math.min(99, Math.max(1, product.salePercent));
  return Math.round(product.priceCents * (1 - pct / 100));
}

/** Attaches each product's color variants (sorted) and effective sale price. */
async function attachVariants<T extends { id: number; priceCents: number; salePercent: number | null; saleActive: boolean }>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  items: T[],
) {
  const withPrice = (p: T) => ({ ...p, effectivePriceCents: getEffectivePriceCents(p) });

  if (items.length === 0) {
    return items.map((p) => ({ ...withPrice(p), variants: [] as (typeof productVariants.$inferSelect)[] }));
  }
  const ids = items.map((p) => p.id);
  const variants = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, ids))
    .orderBy(productVariants.sortOrder, productVariants.id);

  const byProduct = new Map<number, (typeof variants)[number][]>();
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v);
    byProduct.set(v.productId, list);
  }

  return items.map((p) => ({ ...withPrice(p), variants: byProduct.get(p.id) ?? [] }));
}

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(products).orderBy(products.id);
  return attachVariants(db, all);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (result.length === 0) return undefined;
  const [withVariants] = await attachVariants(db, result);
  return withVariants;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (result.length === 0) return undefined;
  const [withVariants] = await attachVariants(db, result);
  return withVariants;
}

// ── Product variants (color swatches) ──────────────────────────────────

export async function listVariantsForProduct(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.sortOrder, productVariants.id);
}

export async function createVariant(input: InsertProductVariant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(productVariants).values(input).returning();
  return created;
}

export async function updateVariant(id: number, input: Partial<InsertProductVariant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db.update(productVariants).set(input).where(eq(productVariants.id, id)).returning();
  return updated;
}

export async function deleteVariant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productVariants).where(eq(productVariants.id, id));
}

export async function deleteVariantsForProduct(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
}

// ── Cart ────────────────────────────────────────────────────────────────

export async function getCartItems(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      size: cartItems.size,
      quantity: cartItems.quantity,
      variantId: cartItems.variantId,
      variantName: cartItems.variantName,
      product: products,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.sessionId, sessionId));

  // Attach variant color info (hexes) so the cart drawer can show the swatch
  // next to each line item, not just its name.
  const variantIds = rows.map((r) => r.variantId).filter((id): id is number => id != null);
  const variants = variantIds.length
    ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds))
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));

  return rows.map((r) => ({
    ...r,
    product: { ...r.product, effectivePriceCents: getEffectivePriceCents(r.product) },
    variant: r.variantId ? variantById.get(r.variantId) ?? null : null,
  }));
}

export async function addCartItem(input: {
  sessionId: string;
  productId: number;
  size: string;
  quantity: number;
  variantId?: number | null;
  variantName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [
    eq(cartItems.sessionId, input.sessionId),
    eq(cartItems.productId, input.productId),
    eq(cartItems.size, input.size),
  ];
  if (input.variantId != null) {
    conditions.push(eq(cartItems.variantId, input.variantId));
  }

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + input.quantity })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({
      sessionId: input.sessionId,
      productId: input.productId,
      size: input.size,
      quantity: input.quantity,
      variantId: input.variantId ?? null,
      variantName: input.variantName ?? null,
    });
  }
}

export async function updateCartItemQuantity(id: number, sessionId: string, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)));
    return;
  }
  await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)));
}

export async function removeCartItem(id: number, sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.sessionId, sessionId)));
}

export async function clearCart(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
}

// ── Orders ──────────────────────────────────────────────────────────────

export async function createOrder(input: {
  sessionId: string;
  userId?: number;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  items: {
    productId: number;
    productName: string;
    size: string;
    variantName?: string | null;
    quantity: number;
    priceCents: number;
  }[];
  /** Gift card code applied at checkout, if any. Not debited until payment is finalized. */
  giftCardCode?: string | null;
  giftCardCents?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalCents = input.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

  const [order] = await db
    .insert(orders)
    .values({
      sessionId: input.sessionId,
      userId: input.userId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      shippingAddress: input.shippingAddress,
      totalCents,
      giftCardCode: input.giftCardCode ?? null,
      giftCardCents: input.giftCardCents ?? 0,
    })
    .returning();

  await db.insert(orderItems).values(
    input.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      variantName: item.variantName ?? null,
      quantity: item.quantity,
      priceCents: item.priceCents,
    })),
  );

  // NOTE: cart is intentionally left alone here. It's only cleared once
  // payment is actually captured (see markOrderPaid + ordersRouter.capturePayment),
  // so an abandoned PayPal popup doesn't silently lose the buyer's cart.
  return order;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (orderResult.length === 0) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...orderResult[0], items };
}

export async function listOrders() {
  const db = await getDb();
  if (!db) return [];
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const allItems = await db.select().from(orderItems);
  const itemsByOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  return allOrders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) ?? [] }));
}

export async function setOrderPaypalOrderId(orderId: number, paypalOrderId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ paypalOrderId }).where(eq(orders.id, orderId));
}

export async function markOrderPaid(orderId: number, paypalCaptureId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");

  await db
    .update(orders)
    .set({ paymentStatus: "paid", status: "confirmed", paypalCaptureId })
    .where(eq(orders.id, orderId));

  if (order.giftCardCode && order.giftCardCents > 0) {
    await debitGiftCard(order.giftCardCode, order.giftCardCents, order.id);
  }

  await clearCart(order.sessionId);
}

/**
 * Finalizes an order that's covered entirely by gift card balance, so no
 * PayPal step is needed at all.
 */
export async function markOrderPaidByGiftCardOnly(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");
  if (!order.giftCardCode || order.giftCardCents < order.totalCents) {
    throw new Error("Order is not fully covered by a gift card");
  }

  await db
    .update(orders)
    .set({ paymentStatus: "paid", status: "confirmed" })
    .where(eq(orders.id, orderId));

  await debitGiftCard(order.giftCardCode, order.giftCardCents, order.id);
  await clearCart(order.sessionId);

  return getOrderById(orderId);
}

export async function recordRefund(orderId: number, refundedCents: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new Error("Order not found");

  const newRefundedCents = Math.min(order.totalCents, order.refundedCents + refundedCents);
  const paymentStatus = newRefundedCents >= order.totalCents ? "refunded" : "partially_refunded";

  await db
    .update(orders)
    .set({
      refundedCents: newRefundedCents,
      paymentStatus,
      refundReason: reason ?? order.refundReason,
      status: paymentStatus === "refunded" ? "cancelled" : order.status,
    })
    .where(eq(orders.id, orderId));

  return getOrderById(orderId);
}

export async function updateOrderStatus(orderId: number, status: "pending" | "confirmed" | "shipped" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));
}

// ── Products (admin CRUD) ──────────────────────────────────────────────────

export async function createProduct(input: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [created] = await db.insert(products).values(input).returning();
  return created;
}

export async function updateProduct(id: number, input: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [updated] = await db.update(products).set(input).where(eq(products.id, id)).returning();
  return updated;
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productVariants).where(eq(productVariants.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

// ── Page views / traffic ───────────────────────────────────────────────────

export async function recordPageView(input: { path: string; sessionId: string; userId?: number; referrer?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pageViews).values({
    path: input.path,
    sessionId: input.sessionId,
    userId: input.userId,
    referrer: input.referrer ?? null,
  });
}

export async function getTrafficSummary(days = 14) {
  const db = await getDb();
  if (!db) return { totalViews: 0, uniqueSessions: 0, byDay: [], topPaths: [] };

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const rows = await db.select().from(pageViews).where(gte(pageViews.createdAt, sinceIso));

  const totalViews = rows.length;
  const uniqueSessions = new Set(rows.map((r) => r.sessionId)).size;

  const dayMap = new Map<string, number>();
  const pathMap = new Map<string, number>();
  for (const row of rows) {
    const day = row.createdAt.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    pathMap.set(row.path, (pathMap.get(row.path) ?? 0) + 1);
  }

  const byDay = Array.from(dayMap.entries())
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topPaths = Array.from(pathMap.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return { totalViews, uniqueSessions, byDay, topPaths };
}

// ── Gift cards / store credit ──────────────────────────────────────────────

/**
 * Generates a human-typeable redemption code like "REL-7F3K-9QXZ".
 * Excludes visually ambiguous characters (0/O, 1/I/L) to cut down on
 * support requests from mistyped codes.
 */
function generateGiftCardCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const randomChunk = (len: number) =>
    Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `REL-${randomChunk(4)}-${randomChunk(4)}`;
}

export async function createGiftCard(input: {
  valueCents: number;
  purchaserUserId?: number;
  purchaserEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Codes are short enough that collisions are possible (though unlikely);
  // retry a few times rather than letting a unique-constraint error bubble up.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGiftCardCode();
    try {
      const [created] = await db
        .insert(giftCards)
        .values({
          code,
          initialValueCents: input.valueCents,
          balanceCents: input.valueCents,
          purchaserUserId: input.purchaserUserId,
          purchaserEmail: input.purchaserEmail,
          recipientName: input.recipientName,
          recipientEmail: input.recipientEmail,
          message: input.message,
          status: "pending_payment",
        })
        .returning();

      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("UNIQUE")) throw error;
      // Code collision — loop and try a freshly generated one.
    }
  }
  throw new Error("Could not generate a unique gift card code, please try again");
}

export async function getGiftCardById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGiftCardByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = code.trim().toUpperCase();
  const result = await db.select().from(giftCards).where(eq(giftCards.code, normalized)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setGiftCardPaypalOrderId(id: number, paypalOrderId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(giftCards).set({ paypalOrderId }).where(eq(giftCards.id, id));
}

/** Activates a gift card once its PayPal payment has actually been captured. */
export async function activateGiftCard(id: number, paypalCaptureId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const card = await getGiftCardById(id);
  if (!card) throw new Error("Gift card not found");
  if (card.status !== "pending_payment") return card;

  await db
    .update(giftCards)
    .set({ status: "active", paypalCaptureId })
    .where(eq(giftCards.id, id));

  await db.insert(giftCardTransactions).values({
    giftCardId: id,
    amountCents: card.initialValueCents,
    note: "Gift card purchased and activated",
  });

  return getGiftCardById(id);
}

/** Debits a gift card's balance (e.g. when an order paid for with it is finalized). */
export async function debitGiftCard(code: string, amountCents: number, orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const card = await getGiftCardByCode(code);
  if (!card) throw new Error("Gift card not found");
  if (card.status !== "active") throw new Error("This gift card isn't active");
  if (amountCents > card.balanceCents) {
    throw new Error("Gift card balance is insufficient");
  }

  const newBalance = card.balanceCents - amountCents;
  await db
    .update(giftCards)
    .set({ balanceCents: newBalance, status: newBalance <= 0 ? "depleted" : "active" })
    .where(eq(giftCards.id, card.id));

  await db.insert(giftCardTransactions).values({
    giftCardId: card.id,
    orderId,
    amountCents: -amountCents,
    note: `Applied to order #${orderId}`,
  });

  return getGiftCardByCode(code);
}

export async function listGiftCardTransactions(giftCardId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(giftCardTransactions)
    .where(eq(giftCardTransactions.giftCardId, giftCardId))
    .orderBy(desc(giftCardTransactions.createdAt));
}

export async function listGiftCards() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(giftCards).orderBy(desc(giftCards.createdAt));
}

export async function listGiftCardsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(giftCards)
    .where(eq(giftCards.purchaserUserId, userId))
    .orderBy(desc(giftCards.createdAt));
}

export async function setGiftCardStatus(id: number, status: "pending_payment" | "active" | "depleted" | "disabled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(giftCards).set({ status }).where(eq(giftCards.id, id));
}
