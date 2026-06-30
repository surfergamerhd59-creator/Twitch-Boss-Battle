import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, streamersTable, authorizedModeratorsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getUserByLogin } from "../lib/twitch-api.js";

const router: Router = Router();

// ── Get mods I've authorized (as a streamer) ──────────────────────────────────
router.get("/mods", requireAuth, async (req: Request, res: Response) => {
  const { twitchId } = req.twitchUser!;

  const mods = await db
    .select()
    .from(authorizedModeratorsTable)
    .where(
      and(
        eq(authorizedModeratorsTable.streamerId, twitchId),
        eq(authorizedModeratorsTable.isActive, true)
      )
    )
    .orderBy(authorizedModeratorsTable.createdAt);

  res.json(mods);
});

// ── Authorize a new moderator ─────────────────────────────────────────────────
router.post("/mods", requireAuth, async (req: Request, res: Response) => {
  const { username: streamerUsername, twitchId: streamerId } = req.twitchUser!;
  const { moderatorUsername } = req.body as { moderatorUsername?: string };

  if (!moderatorUsername?.trim()) {
    res.status(400).json({ error: "moderatorUsername is required" });
    return;
  }

  const cleanUsername = moderatorUsername.trim().toLowerCase().replace(/^@/, "");

  if (cleanUsername === streamerUsername) {
    res.status(400).json({ error: "You cannot authorize yourself as a moderator" });
    return;
  }

  // Get the streamer's record (need their access token for Helix lookup)
  const [streamer] = await db
    .select()
    .from(streamersTable)
    .where(eq(streamersTable.twitchId, streamerId))
    .limit(1);

  if (!streamer) {
    res.status(404).json({ error: "Streamer record not found" });
    return;
  }

  // Look up the moderator by Twitch username
  let modInfo: { id: string; login: string; displayName: string } | null;
  try {
    modInfo = await getUserByLogin(streamer, cleanUsername);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to look up moderator on Twitch");
    res.status(502).json({ error: "Failed to look up Twitch username. Is the name correct?" });
    return;
  }

  if (!modInfo) {
    res.status(404).json({ error: `Twitch user @${cleanUsername} not found` });
    return;
  }

  // Upsert — reactivate if previously revoked
  const existing = await db
    .select()
    .from(authorizedModeratorsTable)
    .where(
      and(
        eq(authorizedModeratorsTable.streamerId, streamerId),
        eq(authorizedModeratorsTable.moderatorTwitchId, modInfo.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(authorizedModeratorsTable)
      .set({ isActive: true, moderatorUsername: modInfo.login })
      .where(eq(authorizedModeratorsTable.id, existing[0]!.id))
      .returning();
    req.log.info({ streamerUsername, modUsername: modInfo.login }, "Mod re-authorized");
    res.json({ mod: updated, alreadyExisted: true });
    return;
  }

  const [inserted] = await db
    .insert(authorizedModeratorsTable)
    .values({
      streamerId,
      streamerUsername,
      moderatorTwitchId: modInfo.id,
      moderatorUsername: modInfo.login,
      isActive: true,
    })
    .returning();

  req.log.info({ streamerUsername, modUsername: modInfo.login }, "Mod authorized");
  res.status(201).json({ mod: inserted, alreadyExisted: false });
});

// ── Revoke mod access ─────────────────────────────────────────────────────────
router.delete("/mods/:modId", requireAuth, async (req: Request, res: Response) => {
  const { twitchId: streamerId } = req.twitchUser!;
  const modId = parseInt((req.params as { modId: string }).modId ?? "0", 10);

  if (!modId) { res.status(400).json({ error: "Invalid modId" }); return; }

  // Only the streamer can revoke their own mods
  const [mod] = await db
    .select()
    .from(authorizedModeratorsTable)
    .where(
      and(
        eq(authorizedModeratorsTable.id, modId),
        eq(authorizedModeratorsTable.streamerId, streamerId)
      )
    )
    .limit(1);

  if (!mod) { res.status(404).json({ error: "Mod not found or access denied" }); return; }

  await db
    .update(authorizedModeratorsTable)
    .set({ isActive: false })
    .where(eq(authorizedModeratorsTable.id, modId));

  req.log.info({ streamerId, modUsername: mod.moderatorUsername }, "Mod access revoked");
  res.json({ ok: true });
});

// ── Channels where I am an authorized moderator ───────────────────────────────
router.get("/mods/channels", requireAuth, async (req: Request, res: Response) => {
  const { twitchId: moderatorTwitchId } = req.twitchUser!;

  const channels = await db
    .select({
      id: authorizedModeratorsTable.id,
      streamerId: authorizedModeratorsTable.streamerId,
      streamerUsername: authorizedModeratorsTable.streamerUsername,
      streamerDisplayName: streamersTable.displayName,
    })
    .from(authorizedModeratorsTable)
    .innerJoin(
      streamersTable,
      eq(authorizedModeratorsTable.streamerId, streamersTable.twitchId)
    )
    .where(
      and(
        eq(authorizedModeratorsTable.moderatorTwitchId, moderatorTwitchId),
        eq(authorizedModeratorsTable.isActive, true)
      )
    );

  res.json(channels);
});

export default router;
