import { Router, type Request, type Response } from "express";
import { db, userBansTable } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { logActivity } from "../lib/activity-log.js";

const router: Router = Router();

// ── List active bans / timeouts ───────────────────────────────────────────────
router.get("/moderation/bans", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(userBansTable)
      .where(
        and(
          eq(userBansTable.isActive, true),
          or(isNull(userBansTable.expiresAt), gt(userBansTable.expiresAt, now))
        )
      )
      .orderBy(userBansTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch bans");
    res.status(500).json({ error: "Failed to fetch bans" });
  }
});

// ── Create ban or timeout ─────────────────────────────────────────────────────
router.post("/moderation/ban", async (req: Request, res: Response) => {
  const { username, type, durationMinutes, reason } = req.body as {
    username?: string;
    type?: string;
    durationMinutes?: number;
    reason?: string;
  };

  if (!username || typeof username !== "string" || username.trim() === "") {
    res.status(400).json({ error: "username is required" });
    return;
  }
  if (type !== "ban" && type !== "timeout") {
    res.status(400).json({ error: "type must be 'ban' or 'timeout'" });
    return;
  }
  if (type === "timeout" && (!durationMinutes || durationMinutes <= 0)) {
    res.status(400).json({ error: "durationMinutes required for timeout" });
    return;
  }

  const expiresAt =
    type === "timeout" && durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;

  try {
    // Deactivate any existing active entry for this user
    await db
      .update(userBansTable)
      .set({ isActive: false })
      .where(and(eq(userBansTable.username, username.trim()), eq(userBansTable.isActive, true)));

    const [row] = await db
      .insert(userBansTable)
      .values({
        username: username.trim(),
        type,
        durationMinutes: durationMinutes ?? null,
        reason: reason?.trim() || null,
        expiresAt,
        isActive: true,
      })
      .returning();

    req.log.info({ username, type, durationMinutes }, "User moderation action");
    const performedBy = req.twitchUser?.username ?? "unknown";
    await logActivity(
      performedBy,
      type,
      `${type === "ban" ? "Banned" : "Timed out"} ${username.trim()}${durationMinutes ? ` for ${durationMinutes}m` : ""}${reason ? ` — ${reason.trim()}` : ""}`,
      performedBy
    );
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create ban");
    res.status(500).json({ error: "Failed to create ban" });
  }
});

// ── Remove (unban / untimeout) ────────────────────────────────────────────────
router.delete("/moderation/ban/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .update(userBansTable)
      .set({ isActive: false })
      .where(eq(userBansTable.id, id))
      .returning();
    if (row) {
      const performedBy = req.twitchUser?.username ?? "unknown";
      await logActivity(performedBy, "unban", `Removed ${row.type} on ${row.username}`, performedBy);
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove ban");
    res.status(500).json({ error: "Failed to remove ban" });
  }
});

export default router;
