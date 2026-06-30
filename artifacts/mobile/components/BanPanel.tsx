import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { getBans, createBan, removeBan, type UserBan } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const DURATION_PRESETS = [
  { label: "1 min", value: 1 },
  { label: "10 min", value: 10 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "24 hr", value: 1440 },
];

function BanRow({ ban, onRemove }: { ban: UserBan; onRemove: (id: number) => void }) {
  const colors = useColors();
  const isTimeout = ban.type === "timeout";
  const accentColor = isTimeout ? colors.warning : colors.destructive;

  const expiresLabel = ban.expiresAt
    ? `expires ${new Date(ban.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "permanent";

  return (
    <View style={[styles.banRow, { backgroundColor: colors.secondary, borderColor: accentColor + "44" }]}>
      <View style={[styles.banTypeTag, { backgroundColor: accentColor + "22" }]}>
        <Feather name={isTimeout ? "clock" : "slash"} size={11} color={accentColor} />
        <Text style={[styles.banTypeText, { color: accentColor }]}>
          {isTimeout ? "TO" : "BAN"}
        </Text>
      </View>
      <View style={styles.banInfo}>
        <Text style={[styles.banUsername, { color: colors.foreground }]}>@{ban.username}</Text>
        {ban.reason ? (
          <Text style={[styles.banReason, { color: colors.mutedForeground }]} numberOfLines={1}>
            {ban.reason}
          </Text>
        ) : null}
        <Text style={[styles.banExpiry, { color: colors.mutedForeground }]}>{expiresLabel}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(ban.id)}
        style={[styles.unbanBtn, { backgroundColor: colors.card }]}
        hitSlop={8}
      >
        <Feather name="x" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

export default function BanPanel() {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [bans, setBans] = useState<UserBan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [username, setUsername] = useState("");
  const [banType, setBanType] = useState<"ban" | "timeout">("timeout");
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBans();
      setBans(data);
    } catch {
      // API not reachable yet — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError("Enter a username");
      return;
    }
    setError("");
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await createBan({
        username: username.trim(),
        type: banType,
        ...(banType === "timeout" ? { durationMinutes } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setUsername("");
      setReason("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await removeBan(id);
      setBans((prev) => prev.filter((b) => b.id !== id));
    } catch {
      await load();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <View style={[styles.headerIcon, { backgroundColor: colors.destructive + "22" }]}>
          <Feather name="shield-off" size={16} color={colors.destructive} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Moderation</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {bans.length > 0 ? `${bans.length} active` : "Ban & timeout users"}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* Ban type toggle */}
          <View style={[styles.typeRow, { backgroundColor: colors.secondary }]}>
            {(["timeout", "ban"] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setBanType(t)}
                style={[
                  styles.typeBtn,
                  banType === t && {
                    backgroundColor: t === "ban" ? colors.destructive : colors.warning,
                  },
                ]}
              >
                <Feather
                  name={t === "ban" ? "slash" : "clock"}
                  size={13}
                  color={banType === t ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.typeBtnTxt,
                    { color: banType === t ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {t === "ban" ? "Permanent Ban" : "Timeout"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Username */}
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="@username"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: error ? colors.destructive : colors.border }]}
            autoCapitalize="none"
            returnKeyType="next"
          />

          {/* Duration presets (timeout only) */}
          {banType === "timeout" && (
            <View style={styles.presetsRow}>
              {DURATION_PRESETS.map((p) => (
                <Pressable
                  key={p.value}
                  onPress={() => setDurationMinutes(p.value)}
                  style={[
                    styles.presetBtn,
                    {
                      backgroundColor:
                        durationMinutes === p.value
                          ? colors.warning + "33"
                          : colors.secondary,
                      borderColor:
                        durationMinutes === p.value ? colors.warning : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetTxt,
                      {
                        color:
                          durationMinutes === p.value
                            ? colors.warning
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Reason */}
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (optional)"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            returnKeyType="done"
          />

          {error ? (
            <Text style={[styles.errorTxt, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor:
                  banType === "ban" ? colors.destructive : colors.warning,
                opacity: submitting || pressed ? 0.75 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather
                  name={banType === "ban" ? "slash" : "clock"}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.submitTxt}>
                  {banType === "ban" ? "Ban User" : `Timeout ${durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`}`}
                </Text>
              </>
            )}
          </Pressable>

          {/* Active bans list */}
          {loading ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginTop: 12 }} />
          ) : bans.length > 0 ? (
            <View style={styles.bansList}>
              <Text style={[styles.bansListTitle, { color: colors.mutedForeground }]}>
                ACTIVE MODERATION ({bans.length})
              </Text>
              {bans.map((ban) => (
                <BanRow key={ban.id} ban={ban} onRemove={handleRemove} />
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
              No active bans or timeouts
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  typeRow: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    padding: 3,
    gap: 3,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeBtnTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  presetsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  submitTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  bansList: { gap: 6, marginTop: 4 },
  bansListTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 2,
  },
  banRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  banTypeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  banTypeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  banInfo: { flex: 1 },
  banUsername: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  banReason: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  banExpiry: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  unbanBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTxt: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
});
