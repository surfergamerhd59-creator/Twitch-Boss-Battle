import { Router, type Request, type Response } from "express";
import { db, streamersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { canAccessChannel } from "../lib/channel-access.js";
import {
  getChannelInfo,
  updateStreamTitle,
  updateStreamCategory,
  searchCategories,
  sendAnnouncement,
  createClip,
  type AnnouncementColor,
} from "../lib/twitch-api.js";
import { botManager } from "../lib/twitch-bot-manager.js";

const router: Router = Router();

// ── Helper: fetch streamer from DB by username ────────────────────────────────
async function getStreamer(username: string) {
  const [streamer] = await db
    .select()
    .from(streamersTable)
    .where(eq(streamersTable.username, username))
    .limit(1);
  return streamer ?? null;
}

// ── Get stream info ───────────────────────────────────────────────────────────
router.get("/stream/:username/info", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied — you must be the streamer or an authorized moderator" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const info = await getChannelInfo(streamer);
    const botStatus = botManager.getStatus(username);
    res.json({ ...info, botStatus });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get channel info");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Update stream title ───────────────────────────────────────────────────────
router.post("/stream/:username/title", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const { title } = req.body as { title?: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied — you must be the streamer or an authorized moderator" });
    return;
  }
  if (!title || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await updateStreamTitle(streamer, title.trim());
    req.log.info({ username, title, by: req.twitchUser!.username }, "Stream title updated");
    res.json({ ok: true, title: title.trim() });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to update title");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Update stream category ────────────────────────────────────────────────────
router.post("/stream/:username/category", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const { gameId, gameName } = req.body as { gameId?: string; gameName?: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied — you must be the streamer or an authorized moderator" });
    return;
  }
  if (!gameId) {
    res.status(400).json({ error: "gameId is required" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await updateStreamCategory(streamer, gameId);
    req.log.info({ username, gameId, gameName, by: req.twitchUser!.username }, "Stream category updated");
    res.json({ ok: true, gameId, gameName });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to update category");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Search categories ─────────────────────────────────────────────────────────
router.get("/stream/:username/categories/search", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const query = req.query["q"] as string | undefined;

  if (!query) { res.status(400).json({ error: "q is required" }); return; }

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const categories = await searchCategories(streamer, query);
    res.json(categories);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to search categories");
    res.status(500).json({ error: "Search failed" });
  }
});

// ── Send announcement ─────────────────────────────────────────────────────────
router.post("/stream/:username/announcement", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const { message, color } = req.body as { message?: string; color?: AnnouncementColor };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied — you must be the streamer or an authorized moderator" });
    return;
  }
  if (!message || message.trim() === "") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await sendAnnouncement(streamer, message.trim(), color ?? "primary");
    req.log.info({ username, color, by: req.twitchUser!.username }, "Announcement sent");
    res.json({ ok: true });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to send announcement");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Create clip ───────────────────────────────────────────────────────────────
router.post("/stream/:username/clip", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const clip = await createClip(streamer);
    req.log.info({ username, clipId: clip.id, by: req.twitchUser!.username }, "Clip created");
    res.json({ ok: true, clipId: clip.id, editUrl: clip.editUrl });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to create clip");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Bot status ────────────────────────────────────────────────────────────────
router.get("/stream/:username/bot", requireAuth, (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  res.json({ status: botManager.getStatus(username) });
});

export default router;
