import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SOUND_ACTIONS, PERMISSION_LABELS, PERMISSION_COLORS, type ActionDef } from "@/config/actions";
import { useActionsContext } from "@/context/ActionsContext";
import { useBotContext } from "@/context/BotContext";
import { playSound, OVERLAY_URL } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const SOUND_EMOJIS: Record<string, string> = {
  sound_airhorn: "📯",
  sound_sad_violin: "🎻",
  sound_drumroll: "🥁",
  sound_victory: "🏆",
  sound_fail: "💀",
  sound_ding: "🔔",
};

function SoundButton({ action }: { action: ActionDef }) {
  const colors = useColors();
  const { getPermission } = useActionsContext();
  const { logActivity } = useBotContext();
  const [feedback, setFeedback] = useState<"idle" | "sent" | "error">("idle");
  const scale = useSharedValue(1);
  const permission = getPermission(action.id);

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withSpring(0.88, { damping: 12 }),
      withSpring(1.06, { damping: 12 }),
      withSpring(1, { damping: 14 })
    );
    try {
      const result = await playSound(action.id);
      setFeedback("sent");
      logActivity({
        type: "sound",
        message: `${SOUND_EMOJIS[action.id] ?? "🔊"} ${action.title} played (${result.delivered} OBS client${result.delivered !== 1 ? "s" : ""})`,
      });
    } catch {
      setFeedback("error");
      logActivity({
        type: "sound",
        message: `${action.title} — API unreachable (is the API server running?)`,
      });
    }
    setTimeout(() => setFeedback("idle"), 1800);
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderColor =
    feedback === "sent"
      ? colors.success
      : feedback === "error"
      ? colors.destructive
      : colors.border;

  return (
    <Animated.View style={[animStyle, styles.soundBtnWrap]}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.soundBtn,
          {
            backgroundColor: colors.card,
            borderColor,
          },
        ]}
      >
        <View
          style={[
            styles.soundBtnEmoji,
            { backgroundColor: action.accentColor + "20" },
          ]}
        >
          <Text style={styles.soundEmoji}>{SOUND_EMOJIS[action.id] ?? "🔊"}</Text>
        </View>
        <Text style={[styles.soundBtnTitle, { color: colors.foreground }]}>
          {action.title}
        </Text>
        <View
          style={[
            styles.permBadge,
            { backgroundColor: PERMISSION_COLORS[permission] + "22" },
          ]}
        >
          <Text
            style={[
              styles.permBadgeTxt,
              { color: PERMISSION_COLORS[permission] },
            ]}
          >
            {PERMISSION_LABELS[permission]}
          </Text>
        </View>
        {feedback !== "idle" && (
          <View
            style={[
              styles.feedbackOverlay,
              {
                backgroundColor:
                  feedback === "sent"
                    ? colors.success + "18"
                    : colors.destructive + "18",
              },
            ]}
          >
            <Feather
              name={feedback === "sent" ? "check-circle" : "alert-circle"}
              size={20}
              color={
                feedback === "sent" ? colors.success : colors.destructive
              }
            />
            <Text
              style={[
                styles.feedbackTxt,
                {
                  color:
                    feedback === "sent" ? colors.success : colors.destructive,
                },
              ]}
            >
              {feedback === "sent" ? "Played!" : "Error"}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SoundboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const overlayUrl = OVERLAY_URL;

  const handleCopyOverlay = async () => {
    await Clipboard.setStringAsync(overlayUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Soundboard
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Meme Sounds → OBS Overlay
        </Text>
      </View>

      {/* OBS Setup Banner */}
      <View
        style={[
          styles.obsBanner,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary + "60",
          },
        ]}
      >
        <View style={styles.obsRow}>
          <View
            style={[
              styles.obsIcon,
              { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Feather name="monitor" size={16} color={colors.primary} />
          </View>
          <View style={styles.obsBody}>
            <Text style={[styles.obsTitle, { color: colors.foreground }]}>
              OBS Browser Source
            </Text>
            <Text style={[styles.obsDesc, { color: colors.mutedForeground }]}>
              Add this URL as a Browser Source in OBS to hear sounds on stream
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleCopyOverlay}
          style={[
            styles.obsUrlRow,
            {
              backgroundColor: colors.secondary,
              borderColor: copied ? colors.success : colors.border,
            },
          ]}
        >
          <Text
            style={[styles.obsUrl, { color: copied ? colors.success : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {copied ? "Copied!" : overlayUrl}
          </Text>
          <Feather
            name={copied ? "check" : "copy"}
            size={14}
            color={copied ? colors.success : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        SOUNDS
      </Text>

      <View style={styles.grid}>
        {SOUND_ACTIONS.map((action) => (
          <SoundButton key={action.id} action={action} />
        ))}
        {/* FUTURE ACTION SLOT: add more sound buttons by adding entries to SOUND_ACTIONS in config/actions.ts */}
      </View>

      <View style={[styles.hint, { backgroundColor: colors.secondary }]}>
        <Feather name="info" size={13} color={colors.mutedForeground} />
        <Text style={[styles.hintTxt, { color: colors.mutedForeground }]}>
          Sounds play through the OBS overlay. Make sure the API server is
          running and the browser source is open.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  header: { paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  obsBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  obsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  obsIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  obsBody: { flex: 1 },
  obsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  obsDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },
  obsUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  obsUrl: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  section: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  soundBtnWrap: { width: "47.5%" },
  soundBtn: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  soundBtnEmoji: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  soundEmoji: { fontSize: 28 },
  soundBtnTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  permBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  permBadgeTxt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  feedbackTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  hintTxt: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    flex: 1,
  },
});
