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
  getPredictions,
  createPrediction,
  updatePrediction,
  createClip,
  type PredictionStatus,
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

// ── Predictions ────────────────────────────────────────────────────────────────
router.get("/stream/:username/predictions", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    res.json(await getPredictions(streamer));
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get predictions");
    const msg = err instanceof Error ? err.message : "Failed to get predictions";
    res.status(500).json({ error: msg });
  }
});

router.post("/stream/:username/predictions", requireAuth, async (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const { title, outcomes, predictionWindow } = req.body as {
    title?: string;
    outcomes?: string[];
    predictionWindow?: number;
  };
  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }
  if (!title?.trim() || title.trim().length > 45) {
    res.status(400).json({ error: "title is required and must be at most 45 characters" });
    return;
  }
  if (!Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 10) {
    res.status(400).json({ error: "Provide between 2 and 10 outcomes" });
    return;
  }
  const cleanOutcomes = outcomes.map((outcome) => outcome.trim());
  if (cleanOutcomes.some((outcome) => !outcome || outcome.length > 25)) {
    res.status(400).json({ error: "Each outcome must be between 1 and 25 characters" });
    return;
  }
  const windowSeconds = Number(predictionWindow ?? 300);
  if (!Number.isInteger(windowSeconds) || windowSeconds < 30 || windowSeconds > 1800) {
    res.status(400).json({ error: "predictionWindow must be an integer between 30 and 1800 seconds" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const prediction = await createPrediction(streamer, title.trim(), cleanOutcomes, windowSeconds);
    await logActivity(username, "prediction_created", `Prediction: ${title.trim()}`, req.twitchUser!.username);
    res.json(prediction);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to create prediction");
    const msg = err instanceof Error ? err.message : "Failed to create prediction";
    res.status(500).json({ error: msg });
  }
});

router.patch("/stream/:username/predictions/:predictionId", requireAuth, async (req: Request, res: Response) => {
  const { username, predictionId } = req.params as { username: string; predictionId: string };
  const { status, winningOutcomeId } = req.body as {
    status?: Exclude<PredictionStatus, "ACTIVE">;
    winningOutcomeId?: string;
  };
  const canAccess = await canAccessChannel(username, req.twitchUser!);
  if (!canAccess) { res.status(403).json({ error: "Access denied" }); return; }
  if (!status || !["LOCKED", "RESOLVED", "CANCELED"].includes(status)) {
    res.status(400).json({ error: "status must be LOCKED, RESOLVED, or CANCELED" });
    return;
  }
  if (status === "RESOLVED" && !winningOutcomeId) {
    res.status(400).json({ error: "winningOutcomeId is required to resolve a prediction" });
    return;
  }

  const streamer = await getStreamer(username);
  if (!streamer) { res.status(404).json({ error: "Streamer not found" }); return; }

  try {
    const prediction = await updatePrediction(streamer, predictionId, status, winningOutcomeId);
    await logActivity(username, "prediction_updated", `Prediction ${status.toLowerCase()}`, req.twitchUser!.username);
    res.json(prediction);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to update prediction");
    const msg = err instanceof Error ? err.message : "Failed to update prediction";
    res.status(500).json({ error: msg });
  }
});

// ── Stream player ─────────────────────────────────────────────────────────────
router.get("/stream/:username/player", (req: Request, res: Response) => {
  const { username } = req.params as { username: string };
  const parent = (req.get("host") ?? "botmodpanel.onrender.com").split(":")[0];
  const safeUsername = encodeURIComponent(username);
  const safeParent = encodeURIComponent(parent);
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Twitch stream</title>
<style>html,body{margin:0;background:#0e0e10;min-height:100%;overflow:hidden}iframe{border:0;width:100vw;height:100vh;min-height:300px}</style>
</head>
<body>
<iframe src="https://player.twitch.tv/?channel=${safeUsername}&parent=${safeParent}&autoplay=false&muted=false" allowfullscreen></iframe>
</body>
</html>`);
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
