import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running startup migrations…");

    await client.query(`
      CREATE TABLE IF NOT EXISTS streamers (
        id            SERIAL PRIMARY KEY,
        twitch_id     TEXT NOT NULL UNIQUE,
        username      TEXT NOT NULL UNIQUE,
        display_name  TEXT NOT NULL,
        access_token  TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        bot_name      TEXT NOT NULL DEFAULT '',
        scope         TEXT NOT NULL DEFAULT '',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS banners (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        body_text   TEXT,
        image_url   TEXT,
        bg_color    TEXT NOT NULL DEFAULT '#1a1a2e',
        cta_text    TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_bans (
        id               SERIAL PRIMARY KEY,
        username         TEXT NOT NULL,
        type             TEXT NOT NULL,
        duration_minutes INTEGER,
        reason           TEXT,
        expires_at       TIMESTAMPTZ,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS social_links (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL,
        platform    TEXT NOT NULL DEFAULT 'custom',
        color       TEXT NOT NULL DEFAULT '#9146ff',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS authorized_moderators (
        id                    SERIAL PRIMARY KEY,
        streamer_id           TEXT NOT NULL,
        streamer_username     TEXT NOT NULL,
        moderator_twitch_id   TEXT NOT NULL,
        moderator_username    TEXT NOT NULL,
        is_active             BOOLEAN NOT NULL DEFAULT TRUE,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_streamer_mod
        ON authorized_moderators (streamer_id, moderator_twitch_id);
    `);

    logger.info("Migrations complete.");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  } finally {
    client.release();
  }
}
