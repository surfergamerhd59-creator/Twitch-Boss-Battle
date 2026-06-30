import { Router, type Request, type Response } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: Router = Router();

// ── List all banners ──────────────────────────────────────────────────────────
router.get("/banners", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(bannersTable)
      .orderBy(bannersTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch banners");
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

// ── Get the currently active banner ──────────────────────────────────────────
router.get("/banners/active", async (req: Request, res: Response) => {
  try {
    const [row] = await db
      .select()
      .from(bannersTable)
      .where(eq(bannersTable.isActive, true))
      .limit(1);
    res.json(row ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch active banner");
    res.status(500).json({ error: "Failed to fetch active banner" });
  }
});

// ── Create banner ─────────────────────────────────────────────────────────────
router.post("/banners", async (req: Request, res: Response) => {
  const { title, bodyText, imageUrl, bgColor, ctaText } = req.body as {
    title?: string;
    bodyText?: string;
    imageUrl?: string;
    bgColor?: string;
    ctaText?: string;
  };

  if (!title || typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }

  try {
    const [row] = await db
      .insert(bannersTable)
      .values({
        title: title.trim(),
        bodyText: bodyText?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        bgColor: bgColor?.trim() || "#1a1a2e",
        ctaText: ctaText?.trim() || null,
        isActive: false,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create banner");
    res.status(500).json({ error: "Failed to create banner" });
  }
});

// ── Update banner ─────────────────────────────────────────────────────────────
router.put("/banners/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { title, bodyText, imageUrl, bgColor, ctaText } = req.body as {
    title?: string;
    bodyText?: string;
    imageUrl?: string;
    bgColor?: string;
    ctaText?: string;
  };

  try {
    const [row] = await db
      .update(bannersTable)
      .set({
        ...(title !== undefined && { title: title.trim() }),
        ...(bodyText !== undefined && { bodyText: bodyText.trim() || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl.trim() || null }),
        ...(bgColor !== undefined && { bgColor: bgColor.trim() }),
        ...(ctaText !== undefined && { ctaText: ctaText.trim() || null }),
      })
      .where(eq(bannersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Banner not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update banner");
    res.status(500).json({ error: "Failed to update banner" });
  }
});

// ── Activate a banner (deactivates all others) ────────────────────────────────
router.patch("/banners/:id/activate", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    // Deactivate all
    await db.update(bannersTable).set({ isActive: false });
    // Activate the chosen one
    const [row] = await db
      .update(bannersTable)
      .set({ isActive: true })
      .where(eq(bannersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Banner not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to activate banner");
    res.status(500).json({ error: "Failed to activate banner" });
  }
});

// ── Deactivate all banners ────────────────────────────────────────────────────
router.patch("/banners/deactivate-all", async (req: Request, res: Response) => {
  try {
    await db.update(bannersTable).set({ isActive: false });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to deactivate banners");
    res.status(500).json({ error: "Failed to deactivate banners" });
  }
});

// ── Delete banner ─────────────────────────────────────────────────────────────
router.delete("/banners/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(bannersTable).where(eq(bannersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete banner");
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
