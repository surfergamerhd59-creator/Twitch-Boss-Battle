import { Router, type Request, type Response } from "express";
import { db, socialLinksTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: Router = Router();

// ── List all social links ─────────────────────────────────────────────────────
router.get("/social-links", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(socialLinksTable)
      .orderBy(asc(socialLinksTable.sortOrder), asc(socialLinksTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch social links");
    res.status(500).json({ error: "Failed to fetch social links" });
  }
});

// ── Create social link ────────────────────────────────────────────────────────
router.post("/social-links", async (req: Request, res: Response) => {
  const { name, url, platform, color, sortOrder } = req.body as {
    name?: string;
    url?: string;
    platform?: string;
    color?: string;
    sortOrder?: number;
  };

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!url || typeof url !== "string" || url.trim() === "") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const [row] = await db
      .insert(socialLinksTable)
      .values({
        name: name.trim(),
        url: url.trim(),
        platform: platform?.trim() || "custom",
        color: color?.trim() || "#9146ff",
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create social link");
    res.status(500).json({ error: "Failed to create social link" });
  }
});

// ── Update social link ────────────────────────────────────────────────────────
router.put("/social-links/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, url, platform, color, sortOrder } = req.body as {
    name?: string;
    url?: string;
    platform?: string;
    color?: string;
    sortOrder?: number;
  };

  try {
    const [row] = await db
      .update(socialLinksTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        ...(url !== undefined && { url: url.trim() }),
        ...(platform !== undefined && { platform: platform.trim() }),
        ...(color !== undefined && { color: color.trim() }),
        ...(sortOrder !== undefined && { sortOrder }),
      })
      .where(eq(socialLinksTable.id, id))
      .returning();

    if (!row) { res.status(404).json({ error: "Social link not found" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update social link");
    res.status(500).json({ error: "Failed to update social link" });
  }
});

// ── Trigger (post link to chat) ───────────────────────────────────────────────
router.post("/social-links/:id/trigger", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [link] = await db
      .select()
      .from(socialLinksTable)
      .where(eq(socialLinksTable.id, id))
      .limit(1);

    if (!link) { res.status(404).json({ error: "Social link not found" }); return; }

    req.log.info({ name: link.name, url: link.url }, "Social link triggered");

    // FUTURE ACTION SLOT: send `!socials ${link.name} → ${link.url}` via Twitch chat API
    // FUTURE ACTION SLOT: broadcast to OBS overlay SSE stream

    res.json({ ok: true, link });
  } catch (err) {
    req.log.error({ err }, "Failed to trigger social link");
    res.status(500).json({ error: "Failed to trigger social link" });
  }
});

// ── Delete social link ────────────────────────────────────────────────────────
router.delete("/social-links/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.delete(socialLinksTable).where(eq(socialLinksTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete social link");
    res.status(500).json({ error: "Failed to delete social link" });
  }
});

export default router;
