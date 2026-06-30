import { Feather } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BanPanel from "@/components/BanPanel";
import BannerManager, { ActiveBannerCard } from "@/components/BannerManager";
import SocialLinksPanel from "@/components/SocialLinksPanel";
import { useAuth } from "@/context/AuthContext";
import { useBotContext, type ActivityEntry } from "@/context/BotContext";
import { useColors } from "@/hooks/useColors";
import type { Banner } from "@/lib/api";

// ── Activity type config ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Feather>["name"]; color: string }> = {
  reward:       { icon: "star",          color: "#f7a931" },
  attack:       { icon: "zap",           color: "#ff4040" },
  boss:         { icon: "alert-triangle", color: "#bf94ff" },
  ai:           { icon: "cpu",           color: "#00c96f" },
  effect:       { icon: "monitor",       color: "#9146ff" },
  sound:        { icon: "volume-2",      color: "#00bfff" },
  mod:          { icon: "shield-off",    color: "#eb4034" },
  announcement: { icon: "speaker",       color: "#9146ff" },
  stream:       { icon: "tv",            color: "#9146ff" },
};
const FALLBACK_CONFIG = { icon: "activity" as const, color: "#9146ff" };

// ── Sub-components ────────────────────────────────────────────────────────────

function ActivityCard({ item }: { item: ActivityEntry }) {
  const colors = useColors();
  const cfg = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG;
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });
  return (
    <View style={[styles.actCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.actIcon, { backgroundColor: cfg.color + "22" }]}>
        <Feather name={cfg.icon} size={14} color={cfg.color} />
      </View>
      <View style={styles.actBody}>
        <Text style={[styles.actMsg, { color: colors.foreground }]} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={[styles.actTime, { color: colors.mutedForeground }]}>{timeAgo}</Text>
      </View>
    </View>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.badgeVal, { color }]}>{value}</Text>
      <Text style={[styles.badgeLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ── Connected user card ───────────────────────────────────────────────────────

function TwitchAccountCard() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <Pressable
        onPress={() => router.replace("/login")}
        style={({ pressed }) => [
          styles.twitchCard,
          { backgroundColor: "#9146ff22", borderColor: "#9146ff55", opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={styles.twitchCardLeft}>
          <View style={[styles.twitchAvatar, { backgroundColor: "#9146ff33" }]}>
            <Feather name="tv" size={20} color="#9146ff" />
          </View>
          <View>
            <Text style={[styles.twitchCardTitle, { color: "#9146ff" }]}>Connect with Twitch</Text>
            <Text style={[styles.twitchCardSub, { color: colors.mutedForeground }]}>
              Link your account to control your stream
            </Text>
          </View>
        </View>
        <View style={[styles.twitchConnectChip, { backgroundColor: "#9146ff" }]}>
          <Feather name="log-in" size={13} color="#fff" />
          <Text style={styles.twitchConnectChipTxt}>Connect</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.twitchCard, { backgroundColor: colors.card, borderColor: "#9146ff55" }]}>
      <View style={styles.twitchCardLeft}>
        <View style={[styles.twitchAvatar, { backgroundColor: "#9146ff33" }]}>
          <Feather name="twitch" size={20} color="#9146ff" />
        </View>
        <View>
          <Text style={[styles.twitchCardTitle, { color: colors.foreground }]}>@{user.displayName}</Text>
          <View style={styles.twitchLiveRow}>
            <View style={[styles.twitchDot, { backgroundColor: "#00c96f" }]} />
            <Text style={[styles.twitchCardSub, { color: "#00c96f" }]}>Twitch Connected</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => { void logout(); }}
        style={({ pressed }) => [styles.twitchLogoutBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="log-out" size={13} color={colors.mutedForeground} />
        <Text style={[styles.twitchLogoutTxt, { color: colors.mutedForeground }]}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activity, bossActive, bossHP, bossMaxHP, leaderboard, clearActivity, logActivity, setBotConnected, botConnected } =
    useBotContext();
  const [toggling, setToggling] = useState(false);
  const [activeBanner, setActiveBanner] = useState<Banner | null>(null);

  const topDamager = leaderboard[0];
  const hpPct = Math.max(0, bossHP / bossMaxHP);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleToggleBot = () => {
    setToggling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => { setBotConnected(!botConnected); setToggling(false); }, 600);
  };

  // ── FlatList header ────────────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Twitch account card — always shown */}
      <View style={styles.twitchCardWrap}>
        <TwitchAccountCard />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBadge label="Activity"   value={activity.length}                                         color={colors.primary} />
        <StatBadge label="Boss HP"    value={bossActive ? bossHP : "—"}                               color={bossActive ? colors.bossRed : colors.mutedForeground} />
        <StatBadge label="MVP"        value={topDamager?.user ? "@" + topDamager.user : "—"}          color={colors.warning} />
      </View>

      {/* Boss alert */}
      {bossActive && (
        <View style={[styles.bossAlert, { backgroundColor: "#ff404018", borderColor: colors.bossRed }]}>
          <Feather name="alert-triangle" size={14} color={colors.bossRed} />
          <Text style={[styles.bossAlertTxt, { color: colors.bossRed }]}>
            Boss Battle Active — {Math.round(hpPct * 100)}% HP remaining
          </Text>
        </View>
      )}

      {/* Active banner preview */}
      {activeBanner && (
        <View style={styles.bannerWrap}>
          <ActiveBannerCard banner={activeBanner} />
        </View>
      )}

      {/* Activity section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
        {activity.length > 0 && (
          <Pressable onPress={clearActivity}>
            <Text style={[styles.clearBtn, { color: colors.mutedForeground }]}>Clear</Text>
          </Pressable>
        )}
      </View>
    </>
  );

  // ── FlatList footer ────────────────────────────────────────────────────────
  const ListFooter = (
    <View style={[styles.footerPanels, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) }]}>
      <SocialLinksPanel onActivity={(msg) => logActivity({ type: "reward", message: msg })} />
      <BannerManager onActiveBannerChange={setActiveBanner} />
      <BanPanel />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky top header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {user ? `@${user.displayName}` : "Control Panel"}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Dashboard</Text>
        </View>
        <Pressable
          onPress={handleToggleBot}
          disabled={toggling}
          style={({ pressed }) => [
            styles.connectBtn,
            {
              backgroundColor: botConnected ? colors.success + "22" : colors.destructive + "22",
              borderColor:     botConnected ? colors.success        : colors.destructive,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: botConnected ? colors.success : colors.destructive }]} />
          <Text style={[styles.connectTxt, { color: botConnected ? colors.success : colors.destructive }]}>
            {botConnected ? "Live" : "Offline"}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={activity}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityCard item={item} />}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="radio" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
              No activity yet{"\n"}Trigger rewards to see logs here
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  greeting:   { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 1, textTransform: "uppercase" },
  title:      { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2 },
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  connectTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Twitch card
  twitchCardWrap:       { paddingHorizontal: 16, marginBottom: 14 },
  twitchCard:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 16, borderWidth: 1 },
  twitchCardLeft:       { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  twitchAvatar:         { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  twitchCardTitle:      { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  twitchCardSub:        { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  twitchLiveRow:        { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  twitchDot:            { width: 6, height: 6, borderRadius: 3 },
  twitchConnectChip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  twitchConnectChipTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  twitchLogoutBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  twitchLogoutTxt:      { fontSize: 12, fontFamily: "Inter_400Regular" },

  statsRow:   { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  badge:      { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  badgeVal:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  badgeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  bossAlert:  { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  bossAlertTxt: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  bannerWrap: { marginHorizontal: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle:  { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  clearBtn:      { fontSize: 13, fontFamily: "Inter_400Regular" },
  list:   { paddingHorizontal: 16, gap: 8 },
  actCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  actIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actBody: { flex: 1 },
  actMsg:  { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  actTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  empty:   { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
  emptyTxt: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  footerPanels: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
});
