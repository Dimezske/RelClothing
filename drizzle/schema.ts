import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /**
   * Stable external identifier for the account. For email/password signups this
   * is a generated id (see server/auth.ts); kept around for compatibility with
   * any future OAuth providers.
   */
  openId: text("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: text("email", { length: 320 }).unique(),
  /** Salted password hash (scrypt). Null for accounts created without a password. */
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod", { length: 64 }),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSignedIn: text("lastSignedIn").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Catalog of clothing items available in the store. Also doubles as the
 * catalog for accessories (bands, watches, bracelets, hats, sunglasses)
 * and crystals — they're all "products", just with different categories.
 * priceCents avoids floating point rounding issues with money.
 */
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug", { length: 160 }).notNull().unique(),
  name: text("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  priceCents: integer("priceCents").notNull(),
  category: text("category", { length: 80 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  sizes: text("sizes").notNull(), // JSON array of available sizes, e.g. ["S","M","L"]
  inStock: integer("inStock", { mode: "boolean" }).default(true).notNull(),
  /**
   * True for "one size" style products (crystals, most accessories) where a
   * size selector doesn't make sense. The shop/PDP UI skips size selection
   * for these even though `sizes` still stores a placeholder size.
   */
  oneSizeFitsAll: integer("oneSizeFitsAll", { mode: "boolean" }).default(false).notNull(),
  /**
   * Percent off (1-99) to apply to priceCents when saleActive is true.
   * Kept separate from the toggle so an admin can set up a discount ahead
   * of time and flip it on/off without re-entering the percentage.
   */
  salePercent: integer("salePercent"),
  saleActive: integer("saleActive", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Color variants for a product, rendered as small swatch spheres on the
 * product card / detail page. `colorHexes` stores a JSON array of one or
 * more hex codes — a single entry renders a solid sphere, multiple entries
 * render a multi-color/gradient sphere (e.g. a tie-dye or marbled colorway).
 */
export const productVariants = sqliteTable("productVariants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("productId").notNull(),
  name: text("name", { length: 80 }).notNull(),
  colorHexes: text("colorHexes").notNull(), // JSON array, e.g. ["#1c1c1c"] or ["#ff0080","#7928ca","#2afadf"]
  /** Optional override image shown when this variant is selected. Falls back to the product's imageUrl. */
  imageUrl: text("imageUrl"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = typeof productVariants.$inferInsert;

/**
 * Items sitting in a shopper's cart, keyed by a sessionId so guests
 * (not just logged-in users) can shop. userId is set once known.
 */
export const cartItems = sqliteTable("cartItems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("sessionId", { length: 128 }).notNull(),
  userId: integer("userId"),
  productId: integer("productId").notNull(),
  size: text("size", { length: 16 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  /** Selected color variant, if the product has any. Null = no variant chosen/applicable. */
  variantId: integer("variantId"),
  variantName: text("variantName", { length: 80 }),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

/**
 * A placed order (checkout complete). No real payment processing —
 * this captures order intent/details for fulfillment.
 */
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("sessionId", { length: 128 }).notNull(),
  userId: integer("userId"),
  customerName: text("customerName", { length: 160 }).notNull(),
  customerEmail: text("customerEmail", { length: 320 }).notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  totalCents: integer("totalCents").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "shipped", "cancelled"] })
    .default("pending")
    .notNull(),
  /** PayPal order id created client-side when the PayPal button renders. */
  paypalOrderId: text("paypalOrderId", { length: 64 }),
  /** PayPal capture id returned once funds are actually captured. */
  paypalCaptureId: text("paypalCaptureId", { length: 64 }),
  paymentStatus: text("paymentStatus", {
    enum: ["unpaid", "paid", "refunded", "partially_refunded"],
  })
    .default("unpaid")
    .notNull(),
  /** Total amount refunded so far, in cents. Lets partial refunds accumulate. */
  refundedCents: integer("refundedCents").default(0).notNull(),
  refundReason: text("refundReason"),
  /** Store-credit gift card code applied at checkout, if any. */
  giftCardCode: text("giftCardCode", { length: 32 }),
  /** Amount of the order total covered by gift card / store credit, in cents. */
  giftCardCents: integer("giftCardCents").default(0).notNull(),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/** Line items belonging to a placed order, snapshotting price/name at purchase time. */
export const orderItems = sqliteTable("orderItems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("orderId").notNull(),
  productId: integer("productId").notNull(),
  productName: text("productName", { length: 160 }).notNull(),
  size: text("size", { length: 16 }).notNull(),
  /** Snapshot of the chosen color variant's name, if any (e.g. "Marbled Sky"). */
  variantName: text("variantName", { length: 80 }),
  quantity: integer("quantity").notNull(),
  priceCents: integer("priceCents").notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * One row per page load on the storefront. Intentionally minimal/anonymous —
 * just enough for the admin traffic dashboard (path, referrer, day, session).
 */
export const pageViews = sqliteTable("pageViews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path", { length: 256 }).notNull(),
  sessionId: text("sessionId", { length: 128 }).notNull(),
  userId: integer("userId"),
  referrer: text("referrer", { length: 512 }),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * A gift card / store-credit balance. Codes are purchasable by anyone (they
 * become a "product" of sorts in the GIFT CARDS tab) and can be redeemed at
 * checkout by anyone who has the code — like a real gift card. `balanceCents`
 * decreases as it's spent; `initialValueCents` is kept for receipts/history.
 */
export const giftCards = sqliteTable("giftCards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Human-typeable redemption code, e.g. "REL-7F3K-9QXZ". */
  code: text("code", { length: 32 }).notNull().unique(),
  initialValueCents: integer("initialValueCents").notNull(),
  balanceCents: integer("balanceCents").notNull(),
  /** User who purchased the card, if they were logged in. */
  purchaserUserId: integer("purchaserUserId"),
  purchaserEmail: text("purchaserEmail", { length: 320 }),
  recipientName: text("recipientName", { length: 160 }),
  recipientEmail: text("recipientEmail", { length: 320 }),
  message: text("message"),
  /**
   * "pending_payment": created but not yet paid for, can't be redeemed yet.
   * "active": paid for and has remaining balance. "depleted": balance is 0.
   * "disabled": manually deactivated (e.g. fraud, refund) by an admin.
   */
  status: text("status", { enum: ["pending_payment", "active", "depleted", "disabled"] })
    .default("pending_payment")
    .notNull(),
  /** PayPal order id created client-side when the PayPal button renders. */
  paypalOrderId: text("paypalOrderId", { length: 64 }),
  /** PayPal capture id returned once funds are actually captured. */
  paypalCaptureId: text("paypalCaptureId", { length: 64 }),
  /** Order that purchased this gift card, so it shows up in order history. */
  purchaseOrderId: integer("purchaseOrderId"),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GiftCard = typeof giftCards.$inferSelect;
export type InsertGiftCard = typeof giftCards.$inferInsert;

/**
 * Ledger of every redemption/adjustment against a gift card so balances are
 * always auditable rather than just trusting the running `balanceCents`.
 * Positive amountCents = credit added (e.g. initial purchase), negative =
 * spent against an order.
 */
export const giftCardTransactions = sqliteTable("giftCardTransactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  giftCardId: integer("giftCardId").notNull(),
  orderId: integer("orderId"),
  amountCents: integer("amountCents").notNull(),
  note: text("note", { length: 200 }),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GiftCardTransaction = typeof giftCardTransactions.$inferSelect;
export type InsertGiftCardTransaction = typeof giftCardTransactions.$inferInsert;