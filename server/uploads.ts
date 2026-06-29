import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { createContext } from "./_core/context";

const UPLOAD_DIR = path.resolve(import.meta.dirname, "../../client/public/uploads");

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Minimal local image-upload endpoint for the admin product form.
 * Accepts { dataUrl: "data:image/png;base64,..." } and writes the decoded
 * file into client/public/uploads, returning a URL the product `imageUrl`
 * field can store directly (e.g. "/uploads/abc123.png").
 *
 * Lives outside tRPC because it needs a large JSON body and a plain file
 * response; the admin check below mirrors the adminProcedure middleware.
 */
export function registerUploadRoute(app: Express) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  app.post("/api/uploads/product-image", async (req: Request, res: Response) => {
    try {
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user || ctx.user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      const { dataUrl } = req.body as { dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== "string") {
        res.status(400).json({ error: "Missing dataUrl" });
        return;
      }

      const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
      if (!match) {
        res.status(400).json({ error: "Invalid image data URL" });
        return;
      }

      const [, mimeType, base64] = match;
      const ext = ALLOWED_TYPES[mimeType];
      if (!ext) {
        res.status(400).json({ error: "Unsupported image type. Use PNG, JPEG, WEBP, or GIF." });
        return;
      }

      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > MAX_BYTES) {
        res.status(400).json({ error: "Image is too large (max 8MB)" });
        return;
      }

      const filename = `${randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

      res.json({ url: `/uploads/${filename}` });
    } catch (error) {
      console.error("[Uploads] Failed to save product image:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });
}
