/**
 * TwitchBotManager
 *
 * Manages a pool of per-streamer Twitch chat connections.
 * Each connected streamer gets their own tmi.js Client instance
 * stored in the `clients` Map, keyed by their Twitch username.
 *
 * Chat credentials use the streamer's own access token so they
 * can send messages as themselves (or a bot account — swap
 * identity below once you have a dedicated bot account).
 *
 * FUTURE ACTION SLOT: Replace identity with a shared bot account
 *   once you register a separate Twitch bot user and store its
 *   credentials separately.
 */

import type { Streamer } from "@workspace/db";
import { db, chatMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

// tmi.js is a CJS module — dynamic import lets esbuild handle it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TmiClient = any;

export type BotStatus = "connected" | "connecting" | "disconnected" | "error";

interface ClientEntry {
  client: TmiClient;
  status: BotStatus;
  channel: string;
}

class TwitchBotManager {
  private clients: Map<string, ClientEntry> = new Map();
  private tmi: typeof import("tmi.js") | null = null;

  private async getTmi() {
    if (!this.tmi) {
      this.tmi = await import("tmi.js");
    }
    return this.tmi;
  }

  /** Connect a streamer's bot to their channel */
  async connect(streamer: Streamer): Promise<void> {
    if (this.clients.has(streamer.username)) {
      await this.disconnect(streamer.username);
    }

    const tmi = await this.getTmi();
    const channel = `#${streamer.username}`;

    const client = new tmi.Client({
      options: { debug: false },
      identity: {
        username: streamer.botName || streamer.username,
        password: `oauth:${streamer.accessToken}`,
      },
      channels: [channel],
    });

    const entry: ClientEntry = { client, status: "connecting", channel };
    this.clients.set(streamer.username, entry);

    client.on("connected", () => {
      entry.status = "connected";
    });

    client.on("disconnected", () => {
      entry.status = "disconnected";
    });

    // Persist chat messages for the in-app chat history view.
    // Non-fatal: a DB hiccup here must never break the chat connection.
    client.on("message", (_channel: string, tags: { username?: string }, message: string, self: boolean) => {
      if (self) return;
      db.insert(chatMessagesTable)
        .values({
          streamerUsername: streamer.username,
          chatUsername: tags.username ?? "unknown",
          message,
        })
        .catch(() => {});
    });

    try {
      await client.connect();
      entry.status = "connected";
    } catch (err) {
      entry.status = "error";
      this.clients.delete(streamer.username);
      throw err;
    }
  }

  /** Disconnect a streamer's bot */
  async disconnect(username: string): Promise<void> {
    const entry = this.clients.get(username);
    if (!entry) return;
    try {
      await entry.client.disconnect();
    } catch {
      // ignore
    }
    this.clients.delete(username);
  }

  /** Get the connection status for a streamer */
  getStatus(username: string): BotStatus {
    return this.clients.get(username)?.status ?? "disconnected";
  }

  /** Send a message to the streamer's channel */
  async sendMessage(username: string, message: string): Promise<void> {
    const entry = this.clients.get(username);
    if (!entry || entry.status !== "connected") {
      throw new Error(`Bot for ${username} is not connected`);
    }
    await entry.client.say(entry.channel, message);
  }

  /** List all active connections */
  getAll(): Array<{ username: string; status: BotStatus; channel: string }> {
    return Array.from(this.clients.entries()).map(([username, e]) => ({
      username,
      status: e.status,
      channel: e.channel,
    }));
  }

  /** Fetch recent chat history persisted from the connected bot */
  async getChatHistory(username: string, limit = 50) {
    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.streamerUsername, username))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(limit);
    return rows.reverse();
  }
}

// Singleton — shared across all routes
export const botManager = new TwitchBotManager();
