import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  PERMISSION_COLORS,
  PERMISSION_LABELS,
  type ActionDef,
} from "@/config/actions";
import { useActionsContext } from "@/context/ActionsContext";
import { useAuth } from "@/context/AuthContext";
import { useBotContext } from "@/context/BotContext";
import { useColors } from "@/hooks/useColors";
import {
  getStreamInfo,
  postStreamTitle,
  postStreamCategory,
  searchCategories,
  postAnnouncement,
  type ChannelInfo,
  type Category,
  type AnnouncementColor,
} from "@/lib/api";

// ── Shared RewardCard ─────────────────────────────────────────────────────────

interface RewardCardProps {
  action: ActionDef;
  onPress: () => void;
  extra?: React.ReactNode;
}

function RewardCard({ action, onPress, extra }: RewardCardProps) {
  const colors = useColors();
  const { getPermission, cooldowns } = useActionsContext();
  const countdown = cooldowns[action.id] ?? 0;
  const active = countdown > 0;
  const permission = getPermission(action.id);
  const permColor = PERMISSION_COLORS[permission];

  return (
    <Pressable
      onPress={onPress}
      disabled={active}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: active ? action.accentColor : colors.border,
          opacity: active ? 0.75 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: action.accentColor + "22" }]}>
        <Feather name={action.icon} size={22} color={action.accentColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{action.title}</Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
          {active ? `Active — ${countdown}s remaining` : action.description}
        </Text>
        {extra}
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.permBadge, { backgroundColor: permColor + "22" }]}>
          <Text style={[styles.permBadgeTxt, { color: permColor }]}>
            {PERMISSION_LABELS[permission]}
          </Text>
        </View>
        <View style={[styles.cardChip, { backgroundColor: active ? action.accentColor + "33" : colors.secondary }]}>
          <Feather
            name={active ? "clock" : "chevron-right"}
            size={13}
            color={active ? action.accentColor : colors.mutedForeground}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ── Stream Settings Section ───────────────────────────────────────────────────

function StreamSettings() {
  const colors = useColors();
  const { user, activeWorkspace } = useAuth();
  const targetUsername = activeWorkspace?.streamerUsername ?? user?.username ?? "";
  const isModMode = activeWorkspace?.type === "moderating";
  const accentColor = isModMode ? "#ff8c00" : "#9146ff";

  const [info, setInfo] = useState<ChannelInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");

  // Title modal
  const [titleModal, setTitleModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState("");

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [catResults, setCatResults] = useState<Category[]>([]);
  const [catSearching, setCatSearching] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Announcement modal
  const [annModal, setAnnModal] = useState(false);
  const [annMessage, setAnnMessage] = useState("");
  const [annColor, setAnnColor] = useState<AnnouncementColor>("primary");
  const [annSending, setAnnSending] = useState(false);
  const [annError, setAnnError] = useState("");

  const loadInfo = useCallback(async () => {
    if (!user) return;
    setInfoLoading(true);
    setInfoError("");
    try {
      const data = await getStreamInfo(targetUsername, user.token);
      setInfo(data);
    } catch (e: unknown) {
      setInfoError(e instanceof Error ? e.message : "Failed to load stream info");
    } finally {
      setInfoLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadInfo(); }, [loadInfo]);

  // ── Title ────────────────────────────────────────────────────────────────

  const openTitleModal = () => {
    setNewTitle(info?.title ?? "");
    setTitleError("");
    setTitleModal(true);
  };

  const handleSaveTitle = async () => {
    if (!user || !newTitle.trim()) { setTitleError("Title cannot be empty"); return; }
    setTitleSaving(true);
    setTitleError("");
    try {
      await postStreamTitle(targetUsername, newTitle.trim(), user.token);
      setInfo((prev) => prev ? { ...prev, title: newTitle.trim() } : prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitleModal(false);
    } catch (e: unknown) {
      setTitleError(e instanceof Error ? e.message : "Failed");
    } finally {
      setTitleSaving(false);
    }
  };

  // ── Category ─────────────────────────────────────────────────────────────

  const openCatModal = () => {
    setCatQuery("");
    setCatResults([]);
    setCatError("");
    setCatModal(true);
  };

  const handleCatSearch = (q: string) => {
    setCatQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setCatResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      if (!user) return;
      setCatSearching(true);
      try {
        const results = await searchCategories(targetUsername, q, user.token);
        setCatResults(results);
      } catch {
        setCatResults([]);
      } finally {
        setCatSearching(false);
      }
    }, 400);
  };

  const handleSelectCategory = async (cat: Category) => {
    if (!user) return;
    setCatSaving(true);
    setCatError("");
    try {
      await postStreamCategory(targetUsername, cat.id, cat.name, user.token);
      setInfo((prev) => prev ? { ...prev, gameName: cat.name, gameId: cat.id } : prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCatModal(false);
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCatSaving(false);
    }
  };

  // ── Announcement ───────────────────────────────────────────────────────────

  const ANN_COLORS: Array<{ key: AnnouncementColor; hex: string; label: string }> = [
    { key: "primary", hex: "#efeff1", label: "White" },
    { key: "blue",    hex: "#1a8fe3", label: "Blue" },
    { key: "green",   hex: "#00c96f", label: "Green" },
    { key: "orange",  hex: "#f7a931", label: "Orange" },
    { key: "purple",  hex: "#9146ff", label: "Purple" },
  ];

  const openAnnModal = () => {
    setAnnMessage("");
    setAnnError("");
    setAnnColor("primary");
    setAnnModal(true);
  };

  const handleSendAnnouncement = async () => {
    if (!user || !annMessage.trim()) { setAnnError("Message cannot be empty"); return; }
    setAnnSending(true);
    setAnnError("");
    try {
      await postAnnouncement(targetUsername, annMessage.trim(), annColor, user.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnnModal(false);
    } catch (e: unknown) {
      setAnnError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setAnnSending(false);
    }
  };

  const botColor = info?.botStatus === "connected" ? colors.success : colors.mutedForeground;

  if (!user) {
    return (
      <View style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.streamEmptyTxt, { color: colors.mutedForeground }]}>
          Log in with Twitch to manage your stream
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Channel header */}
        <View style={styles.streamHeader}>
          <View style={[styles.streamAvatar, { backgroundColor: "#9146ff22" }]}>
            <Feather name="tv" size={18} color="#9146ff" />
          </View>
          <View style={styles.streamHeaderInfo}>
            <Text style={[styles.streamUsername, { color: colors.foreground }]}>@{user.displayName}</Text>
            <View style={styles.botStatusRow}>
              <View style={[styles.botDot, { backgroundColor: botColor }]} />
              <Text style={[styles.botStatusTxt, { color: botColor }]}>
                Bot {info?.botStatus ?? "—"}
              </Text>
            </View>
          </View>
          <Pressable onPress={loadInfo} disabled={infoLoading} hitSlop={8}>
            {infoLoading
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />}
          </Pressable>
        </View>

        {infoError ? (
          <Text style={[styles.streamError, { color: colors.destructive }]}>{infoError}</Text>
        ) : null}

        {/* Current title */}
        <Pressable
          onPress={openTitleModal}
          style={[styles.streamField, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <View style={styles.streamFieldLeft}>
            <Feather name="edit-2" size={14} color={colors.primary} />
            <View>
              <Text style={[styles.streamFieldLabel, { color: colors.mutedForeground }]}>Stream Title</Text>
              <Text style={[styles.streamFieldValue, { color: colors.foreground }]} numberOfLines={1}>
                {info ? info.title || "No title set" : "—"}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
        </Pressable>

        {/* Current category */}
        <Pressable
          onPress={openCatModal}
          style={[styles.streamField, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <View style={styles.streamFieldLeft}>
            <Feather name="grid" size={14} color="#f7a931" />
            <View>
              <Text style={[styles.streamFieldLabel, { color: colors.mutedForeground }]}>Category</Text>
              <Text style={[styles.streamFieldValue, { color: colors.foreground }]} numberOfLines={1}>
                {info ? info.gameName || "Not set" : "—"}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
        </Pressable>

        {/* Send announcement */}
        <Pressable
          onPress={openAnnModal}
          style={[styles.streamField, { backgroundColor: "#9146ff18", borderColor: "#9146ff44" }]}
        >
          <View style={styles.streamFieldLeft}>
            <Feather name="speaker" size={14} color="#9146ff" />
            <View>
              <Text style={[styles.streamFieldLabel, { color: "#9146ff" }]}>Send Announcement</Text>
              <Text style={[styles.streamFieldValue, { color: colors.mutedForeground }]} numberOfLines={1}>
                Colored moderator banner in chat
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={15} color="#9146ff" />
        </Pressable>
      </View>

      {/* ── Title Modal ───────────────────────────────────────────────────── */}
      <Modal visible={titleModal} transparent animationType="slide" onRequestClose={() => setTitleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTitleModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Update Stream Title</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter your stream title…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: titleError ? colors.destructive : colors.border }]}
              multiline
              autoFocus
              maxLength={140}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{newTitle.length}/140</Text>
            {titleError ? <Text style={[styles.modalError, { color: colors.destructive }]}>{titleError}</Text> : null}
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setTitleModal(false)} style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.modalCancelTxt, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveTitle}
                disabled={titleSaving}
                style={({ pressed }) => [styles.modalSaveBtn, { backgroundColor: colors.primary, opacity: titleSaving || pressed ? 0.8 : 1 }]}
              >
                {titleSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveTxt}>Update Title</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Announcement Modal ────────────────────────────────────────────── */}
      <Modal visible={annModal} transparent animationType="slide" onRequestClose={() => setAnnModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAnnModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Announcement</Text>
            <Text style={[styles.annSubtitle, { color: colors.mutedForeground }]}>
              Pick a color, write your message, then tap Send.
            </Text>

            {/* Color picker */}
            <View style={styles.annColorRow}>
              {ANN_COLORS.map((c) => (
                <Pressable
                  key={c.key}
                  onPress={() => setAnnColor(c.key)}
                  style={[
                    styles.annColorChip,
                    { backgroundColor: c.hex + (annColor === c.key ? "ff" : "44") },
                    annColor === c.key && styles.annColorChipSelected,
                  ]}
                >
                  {annColor === c.key && <Feather name="check" size={12} color={c.key === "primary" ? "#0e0e10" : "#fff"} />}
                  <Text style={[styles.annColorLabel, { color: c.key === "primary" && annColor === c.key ? "#0e0e10" : c.hex }]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={annMessage}
              onChangeText={setAnnMessage}
              placeholder="Type your announcement…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: annError ? colors.destructive : colors.border }]}
              multiline
              autoFocus
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{annMessage.length}/500</Text>
            {annError ? <Text style={[styles.modalError, { color: colors.destructive }]}>{annError}</Text> : null}

            <View style={styles.modalButtons}>
              <Pressable onPress={() => setAnnModal(false)} style={[styles.modalCancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.modalCancelTxt, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSendAnnouncement}
                disabled={annSending}
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  { backgroundColor: ANN_COLORS.find((c) => c.key === annColor)?.hex ?? "#9146ff", opacity: annSending || pressed ? 0.8 : 1 },
                ]}
              >
                {annSending
                  ? <ActivityIndicator size="small" color={annColor === "primary" ? "#0e0e10" : "#fff"} />
                  : (
                    <>
                      <Feather name="speaker" size={14} color={annColor === "primary" ? "#0e0e10" : "#fff"} />
                      <Text style={[styles.modalSaveTxt, { color: annColor === "primary" ? "#0e0e10" : "#fff" }]}>
                        Send to Chat
                      </Text>
                    </>
                  )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Category Modal ────────────────────────────────────────────────── */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCatModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Change Category</Text>
            <TextInput
              value={catQuery}
              onChangeText={handleCatSearch}
              placeholder="Search games & categories…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              autoFocus
            />
            {catError ? <Text style={[styles.modalError, { color: colors.destructive }]}>{catError}</Text> : null}
            {catSearching
              ? <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginTop: 16 }} />
              : (
                <FlatList
                  data={catResults}
                  keyExtractor={(c) => c.id}
                  style={styles.catList}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectCategory(item)}
                      disabled={catSaving}
                      style={({ pressed }) => [
                        styles.catRow,
                        { backgroundColor: pressed ? colors.secondary : "transparent", borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.catName, { color: colors.foreground }]}>{item.name}</Text>
                      {catSaving && <ActivityIndicator size="small" color={colors.primary} />}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    catQuery.length > 0
                      ? <Text style={[styles.catEmpty, { color: colors.mutedForeground }]}>No results for "{catQuery}"</Text>
                      : <Text style={[styles.catEmpty, { color: colors.mutedForeground }]}>Type to search categories</Text>
                  }
                />
              )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ControlsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logActivity, startBoss } = useBotContext();
  const { startCooldown } = useActionsContext();
  const [aiText, setAiText] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleFlashbang = () => {
    const def = ACTIONS_BY_CATEGORY.hardware?.find((a) => a.id === "flashbang");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    startCooldown("flashbang", def?.cooldownSeconds ?? 3);
    logActivity({ type: "effect", message: "Flashbang triggered! White screen for 1.5s" });
  };

  const handleInvertMouse = () => {
    const def = ACTIONS_BY_CATEGORY.hardware?.find((a) => a.id === "invert_mouse");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startCooldown("invert_mouse", def?.cooldownSeconds ?? 10);
    logActivity({ type: "effect", message: "Mouse Inversion active for 10 seconds" });
  };

  const handleLights = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const lightColors = ["purple", "red", "blue", "green", "orange"];
    const color = lightColors[Math.floor(Math.random() * lightColors.length)];
    logActivity({ type: "effect", message: `Room lights changed to ${color}` });
  };

  const handleInvokeBoss = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    startBoss();
  };

  const handleSendToAI = async () => {
    if (!aiText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiLoading(true);
    setAiResponse("");
    logActivity({ type: "ai", message: `AI query: "${aiText.trim()}"` });
    await new Promise((r) => setTimeout(r, 1400));
    const responses = [
      "Oh great, another human bothering me. Try: yes, no, or goodbye.",
      "My circuits are tired but fine, I'll humor you this once.",
      "Fascinating question. I'll pretend to care for 3 seconds.",
      "The streamer asked me this last week. My answer: maybe.",
    ];
    setAiResponse(responses[Math.floor(Math.random() * responses.length)]!);
    setAiLoading(false);
  };

  const hardware = ACTIONS_BY_CATEGORY.hardware ?? [];
  const minigame = ACTIONS_BY_CATEGORY.minigame ?? [];
  const aiAction = ACTIONS_BY_CATEGORY.ai?.[0];

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Controls</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Channel Point Rewards</Text>
      </View>

      {/* ── Stream Settings ───────────────────────────────────────────────── */}
      <Text style={[styles.section, { color: colors.mutedForeground }]}>STREAM SETTINGS</Text>
      <StreamSettings />

      {/* ── Hardware ──────────────────────────────────────────────────────── */}
      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 16 }]}>HARDWARE</Text>
      {hardware.map((action) => {
        const handlers: Record<string, () => void> = {
          flashbang: handleFlashbang,
          invert_mouse: handleInvertMouse,
          room_lights: handleLights,
        };
        return (
          <RewardCard key={action.id} action={action} onPress={handlers[action.id] ?? (() => {})} />
        );
      })}

      {/* ── Minigame ──────────────────────────────────────────────────────── */}
      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 8 }]}>MINIGAME</Text>
      {minigame.map((action) => (
        <RewardCard key={action.id} action={action} onPress={handleInvokeBoss} />
      ))}

      {/* ── AI Chatbot ────────────────────────────────────────────────────── */}
      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 8 }]}>AI CHATBOT</Text>
      {aiAction && (
        <View style={[styles.aiPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aiTopRow}>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIcon, { backgroundColor: aiAction.accentColor + "22" }]}>
                <Feather name="cpu" size={18} color={aiAction.accentColor} />
              </View>
              <View>
                <Text style={[styles.aiTitle, { color: colors.foreground }]}>Talk to the Bot</Text>
                <Text style={[styles.aiSub, { color: colors.mutedForeground }]}>Sarcastic AI — GPT-4o-mini</Text>
              </View>
            </View>
          </View>
          <TextInput
            value={aiText}
            onChangeText={setAiText}
            placeholder="Ask the bot something..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.aiInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            multiline
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSendToAI}
            disabled={aiLoading || !aiText.trim()}
            style={({ pressed }) => [
              styles.aiBtn,
              { backgroundColor: aiAction.accentColor, opacity: aiLoading || !aiText.trim() ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name={aiLoading ? "loader" : "send"} size={14} color="#fff" />
            <Text style={styles.aiBtnTxt}>{aiLoading ? "Thinking..." : "Send to Chat"}</Text>
          </Pressable>
          {!!aiResponse && (
            <View style={[styles.aiResponse, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.aiResponseLabel, { color: colors.mutedForeground }]}>Bot response (preview):</Text>
              <Text style={[styles.aiResponseTxt, { color: colors.foreground }]}>{aiResponse}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  header: { paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 10 },

  // Stream settings card
  streamCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  streamHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  streamAvatar: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  streamHeaderInfo: { flex: 1 },
  streamUsername: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  botStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  botDot: { width: 6, height: 6, borderRadius: 3 },
  botStatusTxt: { fontSize: 11, fontFamily: "Inter_400Regular" },
  streamError: { fontSize: 12, fontFamily: "Inter_400Regular" },
  streamField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  streamFieldLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  streamFieldLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  streamFieldValue: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 1 },
  streamEmptyTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },

  // RewardCard
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  permBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  permBadgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardChip: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  // AI panel
  aiPanel: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, gap: 12 },
  aiTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  aiSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  aiInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  aiBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  aiResponse: { borderRadius: 10, padding: 12 },
  aiResponseLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6 },
  aiResponseTxt: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  // Announcement
  annSubtitle:          { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  annColorRow:          { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  annColorChip:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  annColorChipSelected: { shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  annColorLabel:        { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 56,
    textAlignVertical: "top",
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", marginTop: -6 },
  modalError: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalCancelTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalSaveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalSaveTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  // Category search
  catList: { maxHeight: 300 },
  catRow: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catName: { fontSize: 15, fontFamily: "Inter_400Regular" },
  catEmpty: { textAlign: "center", paddingVertical: 24, fontSize: 13, fontFamily: "Inter_400Regular" },
});
