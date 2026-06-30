import { and, eq } from "drizzle-orm";
import { db, authorizedModeratorsTable } from "@workspace/db";
import type { TwitchUserPayload } from "../middlewares/requireAuth.js";

/**
 * Returns true if `user` is allowed to control the channel owned by `streamerUsername`.
 * Access is granted if:
 *   1. The user IS the streamer (own channel), or
 *   2. The user is an active authorized moderator for that channel.
 */
export async function canAccessChannel(
  streamerUsername: string,
  user: TwitchUserPayload
): Promise<boolean> {
  if (user.username === streamerUsername) return true;

  const [mod] = await db
    .select({ id: authorizedModeratorsTable.id })
    .from(authorizedModeratorsTable)
    .where(
      and(
        eq(authorizedModeratorsTable.streamerUsername, streamerUsername),
        eq(authorizedModeratorsTable.moderatorTwitchId, user.twitchId),
        eq(authorizedModeratorsTable.isActive, true)
      )
    )
    .limit(1);

  return !!mod;
}
