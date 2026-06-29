/**
 * Seeds the local database with sample products (and their color variants)
 * so the storefront has something to display. Run with: pnpm run db:seed
 *
 * Re-running is safe: products are skipped if their slug already exists,
 * and a product's variants are only inserted the first time it's created.
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { products, productVariants } from "../drizzle/schema";

type SeedVariant = {
  name: string;
  colorHexes: string[];
};

type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string;
  sizes: string[];
  inStock?: boolean;
  oneSizeFitsAll?: boolean;
  /** Percent off (1-99) for products seeded with an active sale already turned on. */
  salePercent?: number;
  saleActive?: boolean;
  variants?: SeedVariant[];
};

const SAMPLE_PRODUCTS: SeedProduct[] = [
  // ── Outerwear ───────────────────────────────────────────────────────────
  {
    slug: "ridge-canvas-jacket",
    name: "Ridge Canvas Jacket",
    description:
      "A heavyweight cotton canvas jacket built for everyday wear. Brushed interior, corozo buttons, and a boxy cut that layers well over anything.",
    priceCents: 18800,
    category: "Outerwear",
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900&q=80",
    sizes: ["S", "M", "L", "XL"],
    salePercent: 20,
    saleActive: true,
    variants: [
      { name: "Field Tan", colorHexes: ["#b89968"] },
      { name: "Ink Black", colorHexes: ["#1c1c1c"] },
      { name: "Olive Drab", colorHexes: ["#5a5e3f"] },
    ],
  },
  {
    slug: "harbor-wool-overcoat",
    name: "Harbor Wool Overcoat",
    description:
      "Double-breasted overcoat in a dense Italian wool blend. Cut long and lean, with a half-belt back for shape in the cold months.",
    priceCents: 32000,
    category: "Outerwear",
    imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=900&q=80",
    sizes: ["S", "M", "L"],
    variants: [
      { name: "Charcoal", colorHexes: ["#3a3a3d"] },
      { name: "Camel", colorHexes: ["#c19a6b"] },
    ],
  },

  // ── Tops ────────────────────────────────────────────────────────────────
  {
    slug: "everyday-crew-tee",
    name: "Everyday Crew Tee",
    description:
      "205gsm combed cotton, garment-dyed for a worn-in feel from the first wash. The shirt you reach for on repeat.",
    priceCents: 4200,
    category: "Tops",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=80",
    sizes: ["XS", "S", "M", "L", "XL"],
    variants: [
      { name: "Bone White", colorHexes: ["#f2ede1"] },
      { name: "Ink Black", colorHexes: ["#1c1c1c"] },
      { name: "Clay", colorHexes: ["#a8765a"] },
      { name: "Moss", colorHexes: ["#6b7656"] },
      { name: "Sunwashed Tie-Dye", colorHexes: ["#e3b04b", "#c1573a", "#7a8c64"] },
    ],
  },
  {
    slug: "field-flannel-shirt",
    name: "Field Flannel Shirt",
    description:
      "Brushed flannel in a muted plaid, cut for layering. Two chest pockets, mother-of-pearl snaps, built to soften with age.",
    priceCents: 7600,
    category: "Tops",
    imageUrl: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&q=80",
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { name: "Red Buffalo Check", colorHexes: ["#7a2e2e", "#1c1c1c"] },
      { name: "Forest Plaid", colorHexes: ["#3f4d3a", "#23281f"] },
    ],
  },

  // ── Bottoms ─────────────────────────────────────────────────────────────
  {
    slug: "straight-leg-denim",
    name: "Straight Leg Denim",
    description:
      "13oz Japanese selvedge denim in a relaxed straight cut. Sits at the natural waist, breaks clean over the boot.",
    priceCents: 12800,
    category: "Bottoms",
    imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=900&q=80",
    sizes: ["28", "30", "32", "34", "36"],
    variants: [
      { name: "Raw Indigo", colorHexes: ["#2c3e63"] },
      { name: "Washed Black", colorHexes: ["#2a2a2a"] },
    ],
  },
  {
    slug: "utility-twill-pant",
    name: "Utility Twill Pant",
    description:
      "Cotton twill workpant with a tapered leg and reinforced knees. Quietly tough, dressed up or down.",
    priceCents: 9800,
    category: "Bottoms",
    imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=900&q=80",
    sizes: ["28", "30", "32", "34", "36"],
    variants: [
      { name: "Stone", colorHexes: ["#cabfa9"] },
      { name: "Olive", colorHexes: ["#5d5f3f"] },
      { name: "Black", colorHexes: ["#1c1c1c"] },
    ],
  },

  // ── Knitwear ────────────────────────────────────────────────────────────
  {
    slug: "merino-crew-sweater",
    name: "Merino Crew Sweater",
    description:
      "Fine-gauge merino wool, knitted to a clean crew silhouette. Breathable enough for layering, warm enough on its own.",
    priceCents: 14200,
    category: "Knitwear",
    imageUrl: "https://images.unsplash.com/photo-1614975059251-992f11792b9f?w=900&q=80",
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { name: "Heather Grey", colorHexes: ["#9a978f"] },
      { name: "Burgundy", colorHexes: ["#6e2738"] },
      { name: "Navy", colorHexes: ["#222d42"] },
    ],
  },
  {
    slug: "cableknit-half-zip",
    name: "Cableknit Half-Zip",
    description:
      "Heavier cableknit in a relaxed fit, half-zip collar for a bit of structure. The kind of sweater that gets better every winter.",
    priceCents: 16500,
    category: "Knitwear",
    imageUrl: "https://images.unsplash.com/photo-1599391398131-cc1d99c0e4f2?w=900&q=80",
    sizes: ["S", "M", "L"],
    inStock: false,
    salePercent: 50,
    saleActive: true,
    variants: [{ name: "Oatmeal", colorHexes: ["#ddd2bd"] }],
  },

  // ── Accessories: watches ────────────────────────────────────────────────
  {
    slug: "ridgeline-leather-watch",
    name: "Ridgeline Leather Watch",
    description:
      "A clean 38mm case on a vegetable-tanned leather strap. Quartz movement, sapphire-coated crystal, the kind of watch that goes with everything in your closet.",
    priceCents: 14800,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1758887952896-8491d393afe2?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Black Case / Black Strap", colorHexes: ["#1c1c1c"] },
      { name: "Silver Case / Tan Strap", colorHexes: ["#c0c2c4", "#b08c5e"] },
      { name: "Gold Case / Brown Strap", colorHexes: ["#cda050", "#5a3a23"] },
    ],
  },
  {
    slug: "trail-digital-watch",
    name: "Trail Digital Watch",
    description:
      "Lightweight resin-case digital watch with a stopwatch, backlight, and a band that doesn't quit on long days outside.",
    priceCents: 6800,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Black", colorHexes: ["#1c1c1c"] },
      { name: "Army Green", colorHexes: ["#4b5320"] },
      { name: "Rust", colorHexes: ["#b5552e"] },
    ],
  },

  // ── Accessories: bands & bracelets ──────────────────────────────────────
  {
    slug: "woven-friendship-band",
    name: "Woven Friendship Band",
    description:
      "Hand-loomed cotton band that's equal parts wristwear and keepsake. Adjustable sliding knot, fits most wrists.",
    priceCents: 1800,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1663730373311-b4dc7523e00a?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Sunset Multi", colorHexes: ["#e3b04b", "#c1573a", "#7a8c64", "#3c5a78"] },
      { name: "Ocean Multi", colorHexes: ["#2c3e63", "#3f9c9c", "#dbe6e6"] },
      { name: "Black & White", colorHexes: ["#1c1c1c", "#f2ede1"] },
    ],
  },
  {
    slug: "leather-cuff-bracelet",
    name: "Leather Cuff Bracelet",
    description:
      "A single piece of vegetable-tanned leather, hand-stitched and snapped closed. Ages into a deeper patina the more you wear it.",
    priceCents: 3400,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1629224316810-9d8805b95e76?w=900&q=80",
    sizes: ["S/M", "L/XL"],
    variants: [
      { name: "Saddle Brown", colorHexes: ["#7a4a2b"] },
      { name: "Black", colorHexes: ["#1c1c1c"] },
    ],
  },
  {
    slug: "beaded-stack-bracelet-set",
    name: "Beaded Stack Bracelet Set",
    description:
      "Three thin beaded bracelets meant to be worn together or split up. Stretch cord fits most wrists without a clasp.",
    priceCents: 2600,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1663730373311-b4dc7523e00a?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Earth Tones Multi", colorHexes: ["#a8765a", "#6b7656", "#cabfa9"] },
      { name: "Jewel Tones Multi", colorHexes: ["#6e2738", "#222d42", "#3f9c9c"] },
      { name: "Natural Stone", colorHexes: ["#cabfa9"] },
    ],
  },

  // ── Accessories: hats ────────────────────────────────────────────────────
  {
    slug: "canvas-five-panel-cap",
    name: "Canvas Five-Panel Cap",
    description:
      "Unstructured five-panel cap in washed cotton canvas, with a curved brim and a brass slide buckle in back.",
    priceCents: 3800,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Stone", colorHexes: ["#cabfa9"] },
      { name: "Black", colorHexes: ["#1c1c1c"] },
      { name: "Olive", colorHexes: ["#5d5f3f"] },
    ],
  },
  {
    slug: "wide-brim-bucket-hat",
    name: "Wide Brim Bucket Hat",
    description:
      "Reversible bucket hat in a sturdy cotton twill — one solid side, one patterned, so it's really two hats in one.",
    priceCents: 4400,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=900&q=80",
    sizes: ["S/M", "L/XL"],
    variants: [
      { name: "Khaki / Paisley Multi", colorHexes: ["#cabfa9", "#7a2e2e", "#3f4d3a"] },
      { name: "Black / Stripe Multi", colorHexes: ["#1c1c1c", "#f2ede1"] },
    ],
  },

  // ── Accessories: sunglasses ──────────────────────────────────────────────
  {
    slug: "horizon-acetate-sunglasses",
    name: "Horizon Acetate Sunglasses",
    description:
      "Classic square frame in hand-polished acetate with polarized lenses and 100% UV protection. Comes with a hard case.",
    priceCents: 8800,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1523884156331-22cc4f5df98d?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    salePercent: 30,
    saleActive: true,
    variants: [
      { name: "Black / Grey Lens", colorHexes: ["#1c1c1c"] },
      { name: "Tortoise / Amber Lens", colorHexes: ["#6b4a2b", "#c1573a"] },
      { name: "Crystal Multi", colorHexes: ["#dbe6e6", "#e3b04b", "#3c5a78"] },
    ],
  },
  {
    slug: "aviator-metal-sunglasses",
    name: "Aviator Metal Sunglasses",
    description:
      "Thin metal aviators with mirrored lenses and adjustable nose pads. A warm-weather staple that never quite goes out of style.",
    priceCents: 7600,
    category: "Accessories",
    imageUrl: "https://images.unsplash.com/photo-1523884156331-22cc4f5df98d?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      { name: "Gold / Green Lens", colorHexes: ["#cda050", "#4b5320"] },
      { name: "Silver / Blue Lens", colorHexes: ["#c0c2c4", "#3c5a78"] },
    ],
  },

  // ── Crystals ────────────────────────────────────────────────────────────
  {
    slug: "amethyst-point",
    name: "Amethyst Point",
    description:
      "A natural amethyst point with deep violet banding, polished smooth at the base so it stands on its own. Each piece is one of a kind — no two grow exactly alike.",
    priceCents: 2800,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    salePercent: 15,
    saleActive: true,
    variants: [{ name: "Deep Violet", colorHexes: ["#6b3fa0"] }],
  },
  {
    slug: "rose-quartz-palm-stone",
    name: "Rose Quartz Palm Stone",
    description:
      "Hand-polished rose quartz, shaped to sit comfortably in your palm. Soft pink, smooth finish, weighty in the hand.",
    priceCents: 1600,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [{ name: "Blush Pink", colorHexes: ["#e3b6bd"] }],
  },
  {
    slug: "clear-quartz-cluster",
    name: "Clear Quartz Cluster",
    description:
      "A raw cluster of clear quartz points, left unpolished to show the natural crystal formation. No two clusters are quite the same shape.",
    priceCents: 3600,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [{ name: "Clear", colorHexes: ["#e8e6f0"] }],
  },
  {
    slug: "black-tourmaline-tower",
    name: "Black Tourmaline Tower",
    description:
      "A polished black tourmaline tower with a faceted point. Deep matte black with the occasional silvery streak where the light catches it.",
    priceCents: 2400,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [{ name: "Matte Black", colorHexes: ["#1a1a1a"] }],
  },
  {
    slug: "citrine-cluster",
    name: "Citrine Cluster",
    description:
      "A sunny, warm-toned citrine cluster with a honeyed yellow color throughout. Small enough for a shelf, a desk, or a windowsill.",
    priceCents: 3200,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [{ name: "Honey Gold", colorHexes: ["#d6a23c"] }],
  },
  {
    slug: "chakra-crystal-set",
    name: "Chakra Crystal Set",
    description:
      "Seven tumbled stones, one for each chakra color, packaged together in a small drawstring pouch. A simple starter set if you're just getting into crystals.",
    priceCents: 4200,
    category: "Crystals",
    imageUrl: "https://images.unsplash.com/photo-1531452561397-2d94cd08987f?w=900&q=80",
    sizes: ["One Size"],
    oneSizeFitsAll: true,
    variants: [
      {
        name: "Rainbow Multi",
        colorHexes: ["#a13838", "#d6a23c", "#d6c93c", "#4b8a4f", "#3c5a78", "#3f3f8a", "#6b3fa0"],
      },
    ],
  },
];

async function seed() {
  const url = process.env.DATABASE_URL ?? "file:./local.db";
  const client = createClient({ url });
  const db = drizzle(client);

  console.log(`Seeding ${SAMPLE_PRODUCTS.length} products into ${url}...`);

  for (const product of SAMPLE_PRODUCTS) {
    const { variants, sizes, ...rest } = product;

    const existing = await db.select().from(products).where(eq(products.slug, product.slug)).limit(1);
    if (existing.length > 0) {
      continue;
    }

    const [created] = await db
      .insert(products)
      .values({ ...rest, sizes: JSON.stringify(sizes) })
      .returning();

    if (variants && variants.length > 0) {
      await db.insert(productVariants).values(
        variants.map((v, i) => ({
          productId: created.id,
          name: v.name,
          colorHexes: JSON.stringify(v.colorHexes),
          sortOrder: i,
        })),
      );
    }
  }

  console.log("Done.");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .then(() => process.exit(0));
