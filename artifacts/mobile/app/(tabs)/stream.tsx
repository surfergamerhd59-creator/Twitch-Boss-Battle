import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PredictionPanel } from "@/components/PredictionPanel";
import { TwitchStreamViewer } from "@/components/TwitchStreamViewer";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function StreamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, activeWorkspace } = useAuth();
  const username = activeWorkspace?.streamerUsername ?? user?.username ?? "";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}> 
        <Text style={[styles.title, { color: colors.foreground }]}>Stream</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Watch and manage your Twitch channel</Text>
      </View>

      {!username ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect your Twitch account to use this screen.</Text>
        </View>
      ) : (
        <>
          <TwitchStreamViewer username={username} />
          <PredictionPanel username={username} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  empty: { marginHorizontal: 16, minHeight: 140, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyText: { fontSize: 13, textAlign: "center", fontFamily: "Inter_400Regular" },
});
