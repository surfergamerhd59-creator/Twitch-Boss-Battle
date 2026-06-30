import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBotContext, type DamageEntry } from "@/context/BotContext";
import { useColors } from "@/hooks/useColors";

function HPBar({ hp, maxHP }: { hp: number; maxHP: number }) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, hp / maxHP));
  const barColor = pct > 0.5 ? colors.success : pct > 0.25 ? colors.warning : colors.bossRed;

  return (
    <View style={[styles.hpTrack, { backgroundColor: colors.secondary }]}>
      <Animated.View
        style={[
          styles.hpFill,
          {
            width: `${pct * 100}%` as any,
            backgroundColor: barColor,
          },
        ]}
      />
    </View>
  );
}

function LeaderRow({ entry, rank }: { entry: DamageEntry; rank: number }) {
  const colors = useColors();
  const rankColor = rank === 0 ? "#ffd700" : rank === 1 ? "#c0c0c0" : rank === 2 ? "#cd7f32" : colors.mutedForeground;
  return (
    <View style={[styles.lRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.lRank, { color: rankColor }]}>#{rank + 1}</Text>
      <Text style={[styles.lUser, { color: colors.foreground }]}>@{entry.user}</Text>
      <Text style={[styles.lDmg, { color: colors.bossRed }]}>{entry.damage} dmg</Text>
    </View>
  );
}

export default function BossScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bossActive, bossHP, bossMaxHP, leaderboard, startBoss, attackBoss, endBoss } = useBotContext();
  const [username, setUsername] = useState("");
  const scale = useSharedValue(1);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleAttack = () => {
    if (!bossActive || !username.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    scale.value = withSpring(0.93, {}, () => {
      scale.value = withSpring(1);
    });
    attackBoss(username.trim().replace("@", ""));
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const hpPct = Math.max(0, bossHP / bossMaxHP);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Boss Battle</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>RPG Minigame</Text>
      </View>

      <View style={[styles.bossCard, { backgroundColor: bossActive ? "#ff404010" : colors.card, borderColor: bossActive ? colors.bossRed : colors.border }]}>
        <View style={styles.bossTop}>
          <View>
            <Text style={[styles.bossName, { color: bossActive ? colors.bossRed : colors.mutedForeground }]}>
              {bossActive ? "DRAGON BOSS" : "No Boss Active"}
            </Text>
            {bossActive && (
              <Text style={[styles.bossHP, { color: colors.foreground }]}>
                {bossHP} <Text style={[styles.bossHPMax, { color: colors.mutedForeground }]}>/ {bossMaxHP} HP</Text>
              </Text>
            )}
          </View>
          {bossActive ? (
            <Pressable
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); endBoss(false); }}
              style={[styles.endBtn, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive }]}
            >
              <Text style={[styles.endBtnTxt, { color: colors.destructive }]}>End</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); startBoss(); }}
              style={[styles.startBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary }]}
            >
              <Feather name="play-circle" size={14} color={colors.primary} />
              <Text style={[styles.startBtnTxt, { color: colors.primary }]}>Invoke</Text>
            </Pressable>
          )}
        </View>

        {bossActive && (
          <>
            <HPBar hp={bossHP} maxHP={bossMaxHP} />
            <Text style={[styles.hpPctTxt, { color: colors.mutedForeground }]}>
              {Math.round(hpPct * 100)}% remaining
            </Text>
          </>
        )}
      </View>

      {bossActive && (
        <View style={[styles.attackPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.attackLabel, { color: colors.mutedForeground }]}>Simulate attack as:</Text>
          <View style={styles.attackRow}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              autoCapitalize="none"
              returnKeyType="send"
              onSubmitEditing={handleAttack}
            />
            <Animated.View style={animStyle}>
              <Pressable
                onPress={handleAttack}
                style={({ pressed }) => [
                  styles.attackBtn,
                  { backgroundColor: colors.bossRed, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="zap" size={18} color="#fff" />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      )}

      <View style={styles.lHeader}>
        <Text style={[styles.lTitle, { color: colors.foreground }]}>Damage Leaderboard</Text>
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.user}
        renderItem={({ item, index }) => <LeaderRow entry={item} rank={index} />}
        contentContainerStyle={[
          styles.lList,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 80) },
        ]}
        scrollEnabled={!!leaderboard.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="shield" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
              {bossActive ? "No attacks yet\nType !atacar in chat" : "Invoke the boss to start a battle"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  bossCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  bossTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bossName: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
  bossHP: { fontSize: 36, fontFamily: "Inter_700Bold", marginTop: 2 },
  bossHPMax: { fontSize: 18, fontFamily: "Inter_400Regular" },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  endBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  startBtnTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hpTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  hpFill: { height: 10, borderRadius: 5 },
  hpPctTxt: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "right" },
  attackPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  attackLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  attackRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  attackBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  lHeader: { paddingHorizontal: 20, marginBottom: 8 },
  lTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  lList: { paddingHorizontal: 16, gap: 8 },
  lRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  lRank: { fontSize: 14, fontFamily: "Inter_700Bold", width: 28 },
  lUser: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  lDmg: { fontSize: 14, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
