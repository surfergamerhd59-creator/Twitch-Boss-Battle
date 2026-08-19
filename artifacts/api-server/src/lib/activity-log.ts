import { db, botActivityLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export type ActivityActionType =
  | "ban"
  | "timeout"
  | "unban"
  | "title_change"
  | "category_change"
  | "chat_mode_change"
  | "clear_chat"
  | "announcement"
  | "prediction_created"
  | "prediction_updated"
  | "clip_created"
  | "sound_trigger";

export async function logActivity(
  streamerUsername: string,
  actionType: ActivityActionType,
  details: string,
  performedBy: string
): Promise<void> {
  try {
    await db.insert(botActivityLogTable).values({
      streamerUsername,
      actionType,
      details,
      performedBy,
    });
  } catch {
    // Non-fatal — activity logging should never break the actual action
  }
}

export async function getActivityLog(streamerUsername: string, limit = 50) {
  return db
    .select()
    .from(botActivityLogTable)
    .where(eq(botActivityLogTable.streamerUsername, streamerUsername))
    .orderBy(desc(botActivityLogTable.createdAt))
    .limit(limit);
}
