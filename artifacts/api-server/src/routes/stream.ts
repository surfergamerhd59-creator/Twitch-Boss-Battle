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
  getChatSettings,
  updateChatSettings,
  clearChat,
  type AnnouncementColor,
} from "../lib/twitch-api.js";
import { botManager } from "../lib/twitch-bot-manager.js";
import { logActivity, getActivityLog } from "../lib/activity-log.js";

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
    await logActivity(username, "title_change", `Title changed to "${title.trim()}"`, req.twitchUser!.username);
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
    await logActivity(username, "category_change", `Category changed to "${gameName ?? gameId}"`, req.twitchUser!.username);
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
    await logActivity(username, "announcement", `"${message.trim()}"`, req.twitchUser!.username);
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
    await logActivity(username, "clip_created", `Clip ${clip.id}`, req.twitchUser!.username);
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

// ── Chat settings (Emote-only / Followers-only) ────────────────────────────────
router.get("/stream/:username/chat-settings", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const settings = await getChatSettings(streamer);
    res.json(settings);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get chat settings");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/stream/:username/chat-settings", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const { emoteMode, followerMode, followerModeDurationMinutes } = req.body as {
    emoteMode?: boolean;
    followerMode?: boolean;
    followerModeDurationMinutes?: number;
  };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await updateChatSettings(streamer, { emoteMode, followerMode, followerModeDurationMinutes });
    const changes: string[] = [];
    if (emoteMode !== undefined) changes.push(`Emote-only ${emoteMode ? "ON" : "OFF"}`);
    if (followerMode !== undefined) changes.push(`Followers-only ${followerMode ? "ON" : "OFF"}`);
    req.log.info({ username, emoteMode, followerMode, by: req.twitchUser!.username }, "Chat settings updated");
    await logActivity(username, "chat_mode_change", changes.join(", "), req.twitchUser!.username);
    res.json({ ok: true });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to update chat settings");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Clear chat ──────────────────────────────────────────────────────────────
router.post("/stream/:username/clear-chat", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    await clearChat(streamer);
    req.log.info({ username, by: req.twitchUser!.username }, "Chat cleared");
    await logActivity(username, "clear_chat", "Chat cleared", req.twitchUser!.username);
    res.json({ ok: true });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to clear chat");
    const msg = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

// ── Bot activity log ────────────────────────────────────────────────────────
router.get("/stream/:username/activity", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  try {
    const rows = await getActivityLog(username, 100);
    res.json(rows);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get activity log");
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

// ── Chat message history ─────────────────────────────────────────────────────
router.get("/stream/:username/chat-history", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };

  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  try {
    const rows = await botManager.getChatHistory(username, 100);
    res.json(rows);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get chat history");
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

export default router;
