import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { getStreamPlayerUrl } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface TwitchStreamViewerProps {
  username: string;
  isLive?: boolean;
}

export function TwitchStreamViewer({ username, isLive }: TwitchStreamViewerProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const playerUrl = useMemo(() => getStreamPlayerUrl(username), [username]);

  if (!username) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="tv" size={28} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect Twitch to watch the stream</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="tv" size={17} color="#9146ff" />
          <Text style={[styles.title, { color: colors.foreground }]}>@{username}</Text>
        </View>
        <View style={styles.liveRow}>
          <View style={[styles.liveDot, { backgroundColor: isLive ? "#ff4040" : colors.mutedForeground }]} />
          <Text style={[styles.liveText, { color: isLive ? "#ff4040" : colors.mutedForeground }]}>
            {isLive ? "LIVE" : "OFFLINE"}
          </Text>
        </View>
      </View>

      <View style={styles.playerFrame}>
        <WebView
          key={playerUrl}
          source={{ uri: playerUrl }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction
          startInLoadingState
          onLoadStart={() => { setLoading(true); setFailed(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="small" color="#9146ff" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading Twitch player…</Text>
            </View>
          )}
        />
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="small" color="#9146ff" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading Twitch player…</Text>
          </View>
        )}
        {failed && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <Feather name="wifi-off" size={24} color={colors.mutedForeground} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Unable to load the stream</Text>
          </View>
        )}
      </View>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>Tap the player to start playback. Twitch may require the viewer to be logged in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  header: { padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, minHeight: 300, backgroundColor: "#0e0e10", position: "relative" },
  webView: { flex: 1, backgroundColor: "#0e0e10" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  note: { paddingHorizontal: 14, paddingBottom: 14, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  empty: { marginHorizontal: 16, marginBottom: 16, minHeight: 140, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
