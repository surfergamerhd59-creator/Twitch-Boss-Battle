import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  getActivityLog,
  getChatHistory,
  type ActivityLogEntry,
  type ChatMessageEntry,
} from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  ban: "user-x",
  timeout: "clock",
  unban: "user-check",
  title_change: "edit-2",
  category_change: "grid",
  chat_mode_change: "message-square",
  clear_chat: "trash-2",
  announcement: "megaphone" as React.ComponentProps<typeof Feather>["name"],
  clip_created: "film",
  sound_trigger: "volume-2",
};

const ACTION_COLORS: Record<string, string> = {
  ban: "#ff4040",
  timeout: "#f7a931",
  unban: "#00c96f",
  title_change: "#5b8cff",
  category_change: "#f7a931",
  chat_mode_change: "#a78bfa",
  clear_chat: "#ff4040",
  announcement: "#5b8cff",
  clip_created: "#a78bfa",
  sound_trigger: "#00c96f",
};

const ACTION_LABELS: Record<string, string> = {
  ban: "Ban",
  timeout: "Timeout",
  unban: "Unban",
  title_change: "Title",
  category_change: "Category",
  chat_mode_change: "Chat Mode",
  clear_chat: "Clear Chat",
  announcement: "Announcement",
  clip_created: "Clip",
  sound_trigger: "Sound",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

// ── Segmented control ─────────────────────────────────────────────────────────

type Tab = "activity" | "chat";

function SegmentedControl({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {(["activity", "chat"] as const).map((t) => (
        <Pressable
          key={t}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(t);
          }}
          style={[
            styles.segmentBtn,
            tab === t && { backgroundColor: colors.primary },
          ]}
        >
          <Feather
            name={t === "activity" ? "activity" : "message-circle"}
            size={13}
            color={tab === t ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.segmentTxt,
              { color: tab === t ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {t === "activity" ? "Bot Activity" : "Chat History"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, activeWorkspace } = useAuth();
  const targetUsername = activeWorkspace?.streamerUsername ?? user?.username ?? "";
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [tab, setTab] = useState<Tab>("activity");
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [chat, setChat] = useState<ChatMessageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [activityRows, chatRows] = await Promise.all([
        getActivityLog(targetUsername, user.token),
        getChatHistory(targetUsername, user.token),
      ]);
      setActivity(activityRows);
      setChat(chatRows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, targetUsername]);

  useEffect(() => { void load(); }, [load]);

  // Poll every 15s while the screen is mounted
  useEffect(() => {
    const interval = setInterval(() => { void load(true); }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />
      }
    >
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>History</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Bot activity &amp; chat log
        </Text>
      </View>

      <SegmentedControl tab={tab} onChange={setTab} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={[styles.errorTxt, { color: colors.destructive }]}>{error}</Text>
      ) : tab === "activity" ? (
        activity.length === 0 ? (
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>No activity yet</Text>
        ) : (
          activity.map((entry) => {
            const color = ACTION_COLORS[entry.actionType] ?? colors.mutedForeground;
            return (
              <View
                key={entry.id}
                style={[styles.row, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <View style={[styles.iconWrap, { backgroundColor: color + "22" }]}>
                  <Feather name={ACTION_ICONS[entry.actionType] ?? "circle"} size={15} color={color} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowLabel, { color }]}>
                      {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                    </Text>
                    <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
                      {formatTime(entry.createdAt)}
                    </Text>
                  </View>
                  {!!entry.details && (
                    <Text style={[styles.rowDetails, { color: colors.foreground }]} numberOfLines={2}>
                      {entry.details}
                    </Text>
                  )}
                  <Text style={[styles.rowBy, { color: colors.mutedForeground }]}>
                    by {entry.performedBy}
                  </Text>
                </View>
              </View>
            );
          })
        )
      ) : chat.length === 0 ? (
        <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>No chat messages yet</Text>
      ) : (
        chat.map((msg) => (
          <View
            key={msg.id}
            style={[styles.chatRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.chatUser, { color: colors.primary }]}>{msg.chatUsername}</Text>
              <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
                {formatTime(msg.createdAt)}
              </Text>
            </View>
            <Text style={[styles.chatMsg, { color: colors.foreground }]}>{msg.message}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 10 },
  header: { paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    marginBottom: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  errorTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 24 },
  emptyTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 24 },

  row: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  rowTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rowDetails: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowBy: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  chatRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  chatUser: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chatMsg: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
