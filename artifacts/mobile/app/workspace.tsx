import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, type Workspace } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getMyModChannels, type ModChannel } from "@/lib/api";

export default function WorkspaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setWorkspace } = useAuth();

  const [channels, setChannels] = useState<ModChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getMyModChannels(user.token);
      setChannels(data);

      // If no mod channels, auto-select own channel and go straight to tabs
      if (data.length === 0) {
        await setWorkspace({ type: "own", streamerUsername: user.username, streamerDisplayName: user.displayName });
        router.replace("/(tabs)");
      }
    } catch {
      // On error, default to own channel
      await setWorkspace({ type: "own", streamerUsername: user.username, streamerDisplayName: user.displayName });
      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  }, [user, setWorkspace, router]);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  const selectWorkspace = useCallback(async (ws: Workspace) => {
    setSelecting(ws.streamerUsername);
    await setWorkspace(ws);
    router.replace("/(tabs)");
  }, [setWorkspace, router]);

  if (!user) return null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingTxt, { color: colors.mutedForeground }]}>Loading your workspaces…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatarCircle, { backgroundColor: "#9146ff22", borderColor: "#9146ff44" }]}>
          <Feather name="user" size={28} color="#9146ff" />
        </View>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Logged in as</Text>
        <Text style={[styles.displayName, { color: colors.foreground }]}>@{user.displayName}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Choose which channel to manage</Text>
      </View>

      <FlatList
        data={[
          // Own channel always first
          {
            type: "own" as const,
            streamerUsername: user.username,
            streamerDisplayName: user.displayName,
          },
          // Moderated channels after
          ...channels.map((c) => ({
            type: "moderating" as const,
            streamerUsername: c.streamerUsername,
            streamerDisplayName: c.streamerDisplayName,
            streamerTwitchId: c.streamerId,
          })),
        ]}
        keyExtractor={(item) => item.streamerUsername}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MY CHANNEL</Text>
          </>
        }
        renderItem={({ item, index }) => {
          const isOwn = item.type === "own";
          const isMod = item.type === "moderating";
          const isFirst = index === 0;
          const isFirstMod = !isOwn && channels.findIndex((c) => c.streamerUsername === item.streamerUsername) === 0;
          const busy = selecting === item.streamerUsername;

          return (
            <>
              {isFirstMod && (
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>
                  CHANNELS YOU MODERATE
                </Text>
              )}
              <Pressable
                onPress={() => selectWorkspace({ type: item.type, streamerUsername: item.streamerUsername, streamerDisplayName: item.streamerDisplayName })}
                disabled={!!selecting}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isOwn ? colors.primary + "55" : "#ff8c0055",
                    opacity: pressed || (selecting && !busy) ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: isOwn ? colors.primary + "22" : "#ff8c0022" }]}>
                  <Feather
                    name={isOwn ? "tv" : "shield"}
                    size={22}
                    color={isOwn ? colors.primary : "#ff8c00"}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                    {isOwn ? "My Channel Dashboard" : `@${item.streamerDisplayName}`}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {isOwn
                      ? `Manage your channel as @${user.displayName}`
                      : `Moderating @${item.streamerDisplayName}'s stream`}
                  </Text>
                </View>
                {busy
                  ? <ActivityIndicator size="small" color={isOwn ? colors.primary : "#ff8c00"} />
                  : (
                    <View style={[styles.cardChip, { backgroundColor: isOwn ? colors.primary + "22" : "#ff8c0022" }]}>
                      <Feather name="chevron-right" size={16} color={isOwn ? colors.primary : "#ff8c00"} />
                    </View>
                  )}
              </Pressable>
            </>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingHorizontal: 20 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingTxt:  { fontSize: 14, fontFamily: "Inter_400Regular" },
  header:      { alignItems: "center", gap: 8, paddingVertical: 24 },
  avatarCircle:{ width: 72, height: 72, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  greeting:    { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  displayName: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  list:        { gap: 10, paddingBottom: 24 },
  sectionLabel:{ fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 8 },
  card:        { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  cardIcon:    { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody:    { flex: 1 },
  cardTitle:   { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardSub:     { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
  cardChip:    { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
