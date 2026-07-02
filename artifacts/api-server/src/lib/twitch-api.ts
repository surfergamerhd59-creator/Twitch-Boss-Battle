import { db, streamersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Streamer } from "@workspace/db";
import { TWITCH_CLIENT_ID as CLIENT_ID, TWITCH_CLIENT_SECRET as CLIENT_SECRET } from "../config.js";

// ── Token helpers ─────────────────────────────────────────────────────────────

export async function refreshAccessToken(streamer: Streamer): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: streamer.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const data = await res.json() as { access_token: string; refresh_token: string };

  await db
    .update(streamersTable)
    .set({ accessToken: data.access_token, refreshToken: data.refresh_token })
    .where(eq(streamersTable.twitchId, streamer.twitchId));

  return data.access_token;
}

/** Makes a Helix API request, auto-refreshing the token on 401 */
async function helixRequest(
  streamer: Streamer,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const makeReq = (token: string) =>
    fetch(`https://api.twitch.tv/helix${path}`, {
      ...options,
      headers: {
        "Client-Id": CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

  let res = await makeReq(streamer.accessToken);

  if (res.status === 401) {
    const freshToken = await refreshAccessToken(streamer);
    res = await makeReq(freshToken);
  }

  return res;
}

// ── Channel info ──────────────────────────────────────────────────────────────

export interface ChannelInfo {
  broadcasterId: string;
  broadcasterName: string;
  title: string;
  gameName: string;
  gameId: string;
  viewerCount?: number;
  isLive?: boolean;
  startedAt?: string;
}

export async function getChannelInfo(streamer: Streamer): Promise<ChannelInfo> {
  // Fetch channel metadata and live stream data in parallel
  const [chanRes, streamRes] = await Promise.all([
    helixRequest(streamer, `/channels?broadcaster_id=${streamer.twitchId}`),
    helixRequest(streamer, `/streams?user_id=${streamer.twitchId}&first=1`),
  ]);

  if (!chanRes.ok) throw new Error(`Helix error ${chanRes.status}`);

  const chanData = await chanRes.json() as { data: Array<{
    broadcaster_id: string;
    broadcaster_name: string;
    title: string;
    game_name: string;
    game_id: string;
  }> };
  const ch = chanData.data[0];
  if (!ch) throw new Error("Channel not found");

  let viewerCount: number | undefined;
  let isLive = false;
  let startedAt: string | undefined;

  if (streamRes.ok) {
    const streamData = await streamRes.json() as { data: Array<{ viewer_count: number; started_at: string }> };
    const stream = streamData.data[0];
    if (stream) {
      isLive = true;
      viewerCount = stream.viewer_count;
      startedAt = stream.started_at;
    }
  }

  return {
    broadcasterId: ch.broadcaster_id,
    broadcasterName: ch.broadcaster_name,
    title: ch.title,
    gameName: ch.game_name,
    gameId: ch.game_id,
    viewerCount,
    isLive,
    startedAt,
  };
}

// ── Chat settings (emote-only / followers-only) ───────────────────────────────

export interface ChatSettings {
  emoteMode: boolean;
  followerMode: boolean;
  followerModeDurationMinutes: number;
  slowMode: boolean;
  slowModeWaitSeconds: number;
  subscriberMode: boolean;
  uniqueChatMode: boolean;
}

export async function getChatSettings(streamer: Streamer): Promise<ChatSettings> {
  const params = new URLSearchParams({
    broadcaster_id: streamer.twitchId,
    moderator_id: streamer.twitchId,
  });
  const res = await helixRequest(streamer, `/chat/settings?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to get chat settings: ${res.status}`);
  const data = await res.json() as { data: Array<{
    emote_mode: boolean;
    follower_mode: boolean;
    follower_mode_duration: number;
    slow_mode: boolean;
    slow_mode_wait_time: number;
    subscriber_mode: boolean;
    unique_chat_mode: boolean;
  }> };
  const s = data.data[0];
  if (!s) throw new Error("Chat settings not found");
  return {
    emoteMode: s.emote_mode,
    followerMode: s.follower_mode,
    followerModeDurationMinutes: s.follower_mode_duration,
    slowMode: s.slow_mode,
    slowModeWaitSeconds: s.slow_mode_wait_time,
    subscriberMode: s.subscriber_mode,
    uniqueChatMode: s.unique_chat_mode,
  };
}

export async function updateChatSettings(
  streamer: Streamer,
  settings: Partial<{ emoteMode: boolean; followerMode: boolean; followerModeDurationMinutes: number }>
): Promise<void> {
  const params = new URLSearchParams({
    broadcaster_id: streamer.twitchId,
    moderator_id: streamer.twitchId,
  });
  const body: Record<string, unknown> = {};
  if (settings.emoteMode !== undefined) body["emote_mode"] = settings.emoteMode;
  if (settings.followerMode !== undefined) {
    body["follower_mode"] = settings.followerMode;
    if (settings.followerMode) {
      body["follower_mode_duration"] = settings.followerModeDurationMinutes ?? 0;
    }
  }

  const res = await helixRequest(streamer, `/chat/settings?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to update chat settings: ${res.status} ${errBody}`);
  }
}

// ── Clear chat ────────────────────────────────────────────────────────────────

export async function clearChat(streamer: Streamer): Promise<void> {
  const params = new URLSearchParams({
    broadcaster_id: streamer.twitchId,
    moderator_id: streamer.twitchId,
  });
  const res = await helixRequest(streamer, `/moderation/chat?${params.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`Failed to clear chat: ${res.status} ${body}`);
  }
}

// ── Update title ──────────────────────────────────────────────────────────────

export async function updateStreamTitle(streamer: Streamer, title: string): Promise<void> {
  const res = await helixRequest(
    streamer,
    `/channels?broadcaster_id=${streamer.twitchId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update title: ${res.status} ${body}`);
  }
}

// ── Update category ───────────────────────────────────────────────────────────

export async function updateStreamCategory(streamer: Streamer, gameId: string): Promise<void> {
  const res = await helixRequest(
    streamer,
    `/channels?broadcaster_id=${streamer.twitchId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ game_id: gameId }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to update category: ${res.status} ${body}`);
  }
}

// ── Search categories ─────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  boxArtUrl: string;
}

export async function searchCategories(streamer: Streamer, query: string): Promise<Category[]> {
  const res = await helixRequest(
    streamer,
    `/search/categories?query=${encodeURIComponent(query)}&first=10`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json() as { data: Array<{ id: string; name: string; box_art_url: string }> };
  return data.data.map((g) => ({
    id: g.id,
    name: g.name,
    boxArtUrl: g.box_art_url,
  }));
}

// ── Validate token (used after OAuth) ────────────────────────────────────────

export async function validateToken(accessToken: string): Promise<{
  clientId: string;
  login: string;
  userId: string;
  scopes: string[];
}> {
  const res = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Token validation failed: ${res.status}`);
  const data = await res.json() as {
    client_id: string;
    login: string;
    user_id: string;
    scopes: string[];
  };
  return {
    clientId: data.client_id,
    login: data.login,
    userId: data.user_id,
    scopes: data.scopes,
  };
}

// ── Look up user by login name ────────────────────────────────────────────────

export async function getUserByLogin(
  streamer: Streamer,
  login: string
): Promise<{ id: string; login: string; displayName: string } | null> {
  const res = await helixRequest(streamer, `/users?login=${encodeURIComponent(login)}`);
  if (!res.ok) throw new Error(`Helix error ${res.status}`);
  const data = await res.json() as { data: Array<{ id: string; login: string; display_name: string }> };
  const u = data.data[0];
  if (!u) return null;
  return { id: u.id, login: u.login, displayName: u.display_name };
}

// ── Send announcement ─────────────────────────────────────────────────────────

export type AnnouncementColor = "primary" | "blue" | "green" | "orange" | "purple";

export async function sendAnnouncement(
  streamer: Streamer,
  message: string,
  color: AnnouncementColor = "primary"
): Promise<void> {
  const params = new URLSearchParams({
    broadcaster_id: streamer.twitchId,
    moderator_id: streamer.twitchId,
  });
  const res = await helixRequest(
    streamer,
    `/chat/announcements?${params.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({ message, color }),
    }
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`Failed to send announcement: ${res.status} ${body}`);
  }
}

// ── Create clip ───────────────────────────────────────────────────────────────

export async function createClip(streamer: Streamer): Promise<{ id: string; editUrl: string }> {
  const res = await helixRequest(
    streamer,
    `/clips?broadcaster_id=${streamer.twitchId}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create clip: ${res.status} ${body}`);
  }
  const data = await res.json() as { data: Array<{ id: string; edit_url: string }> };
  const clip = data.data[0];
  if (!clip) throw new Error("Clip creation returned no data");
  return { id: clip.id, editUrl: clip.edit_url };
}

// ── Get display name ──────────────────────────────────────────────────────────

export async function getUserInfo(accessToken: string): Promise<{
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
}> {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-Id": CLIENT_ID,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to get user info: ${res.status}`);
  const data = await res.json() as { data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }> };
  const u = data.data[0];
  if (!u) throw new Error("User not found");
  return {
    id: u.id,
    login: u.login,
    displayName: u.display_name,
    profileImageUrl: u.profile_image_url,
  };
}
