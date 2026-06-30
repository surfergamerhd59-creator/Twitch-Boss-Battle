const domain =
  typeof process !== "undefined"
    ? process.env["EXPO_PUBLIC_DOMAIN"]
    : undefined;

export const API_BASE = domain ? `https://${domain}/api` : "/api";

/** URL to paste into OBS as a Browser Source */
export const OVERLAY_URL = `${API_BASE}/overlay`;

// ── Sounds ────────────────────────────────────────────────────────────────────

export async function playSound(soundId: string): Promise<{ ok: boolean; delivered: number }> {
  const res = await fetch(`${API_BASE}/sounds/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soundId }),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<{ ok: boolean; delivered: number }>;
}

// ── Moderation ────────────────────────────────────────────────────────────────

export interface UserBan {
  id: number;
  username: string;
  type: "ban" | "timeout";
  durationMinutes: number | null;
  reason: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function getBans(): Promise<UserBan[]> {
  const res = await fetch(`${API_BASE}/moderation/bans`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<UserBan[]>;
}

export async function createBan(data: {
  username: string;
  type: "ban" | "timeout";
  durationMinutes?: number;
  reason?: string;
}): Promise<UserBan> {
  const res = await fetch(`${API_BASE}/moderation/ban`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<UserBan>;
}

export async function removeBan(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/moderation/ban/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

// ── Banners ───────────────────────────────────────────────────────────────────

export interface Banner {
  id: number;
  title: string;
  bodyText: string | null;
  imageUrl: string | null;
  bgColor: string;
  ctaText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getBanners(): Promise<Banner[]> {
  const res = await fetch(`${API_BASE}/banners`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<Banner[]>;
}

export async function getActiveBanner(): Promise<Banner | null> {
  const res = await fetch(`${API_BASE}/banners/active`);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<Banner | null>;
}

export async function createBanner(data: {
  title: string;
  bodyText?: string;
  imageUrl?: string;
  bgColor?: string;
  ctaText?: string;
}): Promise<Banner> {
  const res = await fetch(`${API_BASE}/banners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<Banner>;
}

export async function updateBanner(
  id: number,
  data: Partial<{ title: string; bodyText: string; imageUrl: string; bgColor: string; ctaText: string }>
): Promise<Banner> {
  const res = await fetch(`${API_BASE}/banners/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<Banner>;
}

export async function activateBanner(id: number): Promise<Banner> {
  const res = await fetch(`${API_BASE}/banners/${id}/activate`, { method: "PATCH" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<Banner>;
}

export async function deactivateAllBanners(): Promise<void> {
  const res = await fetch(`${API_BASE}/banners/deactivate-all`, { method: "PATCH" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

export async function deleteBanner(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/banners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
}

// FUTURE ACTION SLOT: triggerHardware(actionId) → POST /api/hardware/trigger
// ── Stream Management ─────────────────────────────────────────────────────────

export interface ChannelInfo {
  broadcasterId: string;
  broadcasterName: string;
  title: string;
  gameName: string;
  gameId: string;
  botStatus: "connected" | "connecting" | "disconnected" | "error";
}

export interface Category {
  id: string;
  name: string;
  boxArtUrl: string;
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function getStreamInfo(username: string, token: string): Promise<ChannelInfo> {
  const res = await fetch(`${API_BASE}/stream/${username}/info`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<ChannelInfo>;
}

export async function postStreamTitle(username: string, title: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stream/${username}/title`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
}

export async function postStreamCategory(
  username: string,
  gameId: string,
  gameName: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/stream/${username}/category`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ gameId, gameName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
}

export async function searchCategories(username: string, query: string, token: string): Promise<Category[]> {
  const res = await fetch(
    `${API_BASE}/stream/${username}/categories/search?q=${encodeURIComponent(query)}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<Category[]>;
}

export type AnnouncementColor = "primary" | "blue" | "green" | "orange" | "purple";

export async function postAnnouncement(
  username: string,
  message: string,
  color: AnnouncementColor,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/stream/${username}/announcement`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ message, color }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
}

// ── Moderator management ─────────────────────────────────────────────────────

export interface AuthorizedMod {
  id: number;
  streamerId: string;
  streamerUsername: string;
  moderatorTwitchId: string;
  moderatorUsername: string;
  isActive: boolean;
  createdAt: string;
}

export interface ModChannel {
  id: number;
  streamerId: string;
  streamerUsername: string;
  streamerDisplayName: string;
}

export async function getMyMods(token: string): Promise<AuthorizedMod[]> {
  const res = await fetch(`${API_BASE}/mods`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<AuthorizedMod[]>;
}

export async function addMod(
  moderatorUsername: string,
  token: string
): Promise<{ mod: AuthorizedMod; alreadyExisted: boolean }> {
  const res = await fetch(`${API_BASE}/mods`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ moderatorUsername }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<{ mod: AuthorizedMod; alreadyExisted: boolean }>;
}

export async function revokeMod(modId: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/mods/${modId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Server error ${res.status}`);
  }
}

export async function getMyModChannels(token: string): Promise<ModChannel[]> {
  const res = await fetch(`${API_BASE}/mods/channels`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<ModChannel[]>;
}

// FUTURE ACTION SLOT: sendAIQuery(user, text)   → POST /api/ai/query
// FUTURE ACTION SLOT: syncBossState()           → GET  /api/boss/state
