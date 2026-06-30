import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ACTIONS_BY_CATEGORY,
  PERMISSION_LABELS,
  PERMISSION_COLORS,
  PERMISSION_ORDER,
  type ActionCategory,
  type ActionDef,
  type PermissionLevel,
} from "@/config/actions";
import { useActionsContext } from "@/context/ActionsContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  getMyMods,
  addMod,
  revokeMod,
  type AuthorizedMod,
} from "@/lib/api";

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  hardware: "Hardware",
  minigame: "Minigame",
  ai: "AI Chatbot",
  sound: "Soundboard",
};

const CATEGORY_ICONS: Record<ActionCategory, React.ComponentProps<typeof Feather>["name"]> = {
  hardware: "monitor",
  minigame: "shield",
  ai: "cpu",
  sound: "music",
};

// ── Permission pill ───────────────────────────────────────────────────────────

function PermissionPill({ permission, onPress }: { permission: PermissionLevel; onPress: () => void }) {
  const color = PERMISSION_COLORS[permission];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: color + "22", borderColor: color, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.pillTxt, { color }]}>{PERMISSION_LABELS[permission]}</Text>
      <Feather name="chevron-right" size={11} color={color} />
    </Pressable>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({ action }: { action: ActionDef }) {
  const colors = useColors();
  const { getPermission, cyclePermission } = useActionsContext();
  const permission = getPermission(action.id);

  const handleCycle = () => {
    Haptics.selectionAsync();
    cyclePermission(action.id);
  };

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: action.accentColor + "20" }]}>
        <Feather name={action.icon} size={16} color={action.accentColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{action.title}</Text>
        <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{action.description}</Text>
      </View>
      <PermissionPill permission={permission} onPress={handleCycle} />
    </View>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ category }: { category: ActionCategory }) {
  const colors = useColors();
  const actions = ACTIONS_BY_CATEGORY[category] ?? [];
  if (actions.length === 0) return null;

  return (
    <View style={styles.categoryBlock}>
      <View style={styles.categoryHeader}>
        <Feather name={CATEGORY_ICONS[category]} size={13} color={colors.mutedForeground} />
        <Text style={[styles.categoryLabel, { color: colors.mutedForeground }]}>
          {CATEGORY_LABELS[category].toUpperCase()}
        </Text>
      </View>
      <View style={styles.categoryRows}>
        {actions.map((action) => <ActionRow key={action.id} action={action} />)}
      </View>
    </View>
  );
}

// ── Manage Staff panel (streamer-only) ────────────────────────────────────────

function ManageStaffPanel() {
  const colors = useColors();
  const { user } = useAuth();

  const [mods, setMods] = useState<AuthorizedMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputUsername, setInputUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [revoking, setRevoking] = useState<number | null>(null);

  const loadMods = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getMyMods(user.token);
      setMods(data);
    } catch {
      // Silent — show empty list
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadMods(); }, [loadMods]);

  const handleAdd = async () => {
    if (!user || !inputUsername.trim()) return;
    setAdding(true);
    setAddError("");
    setAddSuccess("");
    try {
      const result = await addMod(inputUsername.trim(), user.token);
      setMods((prev) => {
        const exists = prev.find((m) => m.id === result.mod.id);
        return exists ? prev : [...prev, result.mod];
      });
      setInputUsername("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddSuccess(result.alreadyExisted
        ? `@${result.mod.moderatorUsername} re-authorized`
        : `@${result.mod.moderatorUsername} authorized as mod`);
      setTimeout(() => setAddSuccess(""), 3000);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to authorize");
    } finally {
      setAdding(false);
    }
  };

  const handleRevoke = async (mod: AuthorizedMod) => {
    if (!user) return;
    setRevoking(mod.id);
    try {
      await revokeMod(mod.id, user.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMods((prev) => prev.filter((m) => m.id !== mod.id));
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <View style={[styles.staffCard, { backgroundColor: colors.card, borderColor: "#ff8c0033" }]}>
      {/* Header */}
      <View style={styles.staffHeader}>
        <View style={[styles.staffIcon, { backgroundColor: "#ff8c0022" }]}>
          <Feather name="shield" size={16} color="#ff8c00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.staffTitle, { color: colors.foreground }]}>Moderator Access</Text>
          <Text style={[styles.staffSub, { color: colors.mutedForeground }]}>
            Authorize your Twitch mods to control your stream from this app
          </Text>
        </View>
      </View>

      {/* Add form */}
      <View style={styles.addRow}>
        <TextInput
          value={inputUsername}
          onChangeText={(t) => { setInputUsername(t); setAddError(""); }}
          placeholder="Twitch username (e.g. coolmod123)"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.addInput,
            {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderColor: addError ? colors.destructive : colors.border,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <Pressable
          onPress={handleAdd}
          disabled={adding || !inputUsername.trim()}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: "#ff8c00", opacity: adding || !inputUsername.trim() || pressed ? 0.6 : 1 },
          ]}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="user-plus" size={16} color="#fff" />}
        </Pressable>
      </View>

      {addError ? (
        <Text style={[styles.feedbackTxt, { color: colors.destructive }]}>{addError}</Text>
      ) : addSuccess ? (
        <Text style={[styles.feedbackTxt, { color: "#00c96f" }]}>✓ {addSuccess}</Text>
      ) : null}

      {/* Mods list */}
      {loading ? (
        <ActivityIndicator size="small" color="#ff8c00" style={{ marginTop: 8 }} />
      ) : mods.length === 0 ? (
        <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
          No authorized mods yet. Add a Twitch username above.
        </Text>
      ) : (
        <View style={styles.modsList}>
          <Text style={[styles.modsLabel, { color: colors.mutedForeground }]}>
            AUTHORIZED MODS ({mods.length})
          </Text>
          {mods.map((mod) => (
            <View key={mod.id} style={[styles.modRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.modLeft}>
                <View style={[styles.modAvatar, { backgroundColor: "#ff8c0022" }]}>
                  <Feather name="user" size={14} color="#ff8c00" />
                </View>
                <Text style={[styles.modName, { color: colors.foreground }]}>
                  @{mod.moderatorUsername}
                </Text>
              </View>
              <Pressable
                onPress={() => handleRevoke(mod)}
                disabled={revoking === mod.id}
                style={({ pressed }) => [
                  styles.revokeBtn,
                  { borderColor: colors.destructive + "88", opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {revoking === mod.id
                  ? <ActivityIndicator size="small" color={colors.destructive} />
                  : (
                    <>
                      <Feather name="user-x" size={12} color={colors.destructive} />
                      <Text style={[styles.revokeTxt, { color: colors.destructive }]}>Revoke</Text>
                    </>
                  )}
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const CATEGORIES: ActionCategory[] = ["hardware", "minigame", "ai", "sound"];

export default function PermissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeWorkspace } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const isModMode = activeWorkspace?.type === "moderating";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Permissions</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {isModMode
            ? `Reward permissions for @${activeWorkspace?.streamerDisplayName}'s channel`
            : "Who can trigger each reward"}
        </Text>
      </View>

      {/* Manage Staff — only visible when managing your own channel */}
      {!isModMode && <ManageStaffPanel />}

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.legendTitle, { color: colors.foreground }]}>
          Tap any badge to cycle permissions
        </Text>
        <View style={styles.legendRow}>
          {PERMISSION_ORDER.map((level) => (
            <View key={level} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PERMISSION_COLORS[level] }]} />
              <Text style={[styles.legendTxt, { color: colors.mutedForeground }]}>
                {PERMISSION_LABELS[level]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {CATEGORIES.map((cat) => <CategorySection key={cat} category={cat} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  header: { paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Manage Staff
  staffCard:    { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginBottom: 20 },
  staffHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  staffIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  staffTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  staffSub:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addRow:       { flexDirection: "row", gap: 8 },
  addInput:     { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn:       { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  feedbackTxt:  { fontSize: 12, fontFamily: "Inter_500Medium" },
  emptyTxt:     { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  modsList:     { gap: 8 },
  modsLabel:    { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2 },
  modRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 10, borderWidth: 1 },
  modLeft:      { flexDirection: "row", alignItems: "center", gap: 8 },
  modAvatar:    { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  modName:      { fontSize: 14, fontFamily: "Inter_500Medium" },
  revokeBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  revokeTxt:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Legend
  legend:        { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20, gap: 10 },
  legendTitle:   { fontSize: 13, fontFamily: "Inter_500Medium" },
  legendRow:     { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  legendItem:    { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendTxt:     { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Categories
  categoryBlock:  { marginBottom: 18 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  categoryLabel:  { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.1 },
  categoryRows:   { gap: 8 },
  row:            { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 13, borderWidth: 1 },
  rowIcon:        { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowBody:        { flex: 1 },
  rowTitle:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowDesc:        { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  pill:           { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillTxt:        { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
