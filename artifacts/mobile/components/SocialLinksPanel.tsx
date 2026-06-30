import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getSocialLinks,
  createSocialLink,
  updateSocialLink,
  triggerSocialLink,
  deleteSocialLink,
  type SocialLink,
} from "@/lib/api";
import { useColors } from "@/hooks/useColors";

// ── Platform registry ─────────────────────────────────────────────────────────

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface PlatformMeta {
  label: string;
  icon: FeatherIconName;
  color: string;
}

export const PLATFORMS: Record<string, PlatformMeta> = {
  discord:   { label: "Discord",   icon: "message-circle", color: "#5865F2" },
  twitter:   { label: "Twitter/X", icon: "twitter",        color: "#1DA1F2" },
  youtube:   { label: "YouTube",   icon: "youtube",        color: "#FF0000" },
  twitch:    { label: "Twitch",    icon: "tv",             color: "#9146FF" },
  instagram: { label: "Instagram", icon: "instagram",      color: "#E1306C" },
  tiktok:    { label: "TikTok",    icon: "music",          color: "#010101" },
  github:    { label: "GitHub",    icon: "github",         color: "#6e40c9" },
  facebook:  { label: "Facebook",  icon: "facebook",       color: "#1877F2" },
  reddit:    { label: "Reddit",    icon: "share-2",        color: "#FF4500" },
  custom:    { label: "Custom",    icon: "link",           color: "#9146ff" },
};

function platformMeta(platform: string): PlatformMeta {
  return PLATFORMS[platform] ?? PLATFORMS["custom"]!;
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

interface FormProps {
  initial?: Partial<SocialLink>;
  onSave: (data: { name: string; url: string; platform: string; color: string }) => Promise<void>;
  onCancel: () => void;
}

function SocialLinkForm({ initial, onSave, onCancel }: FormProps) {
  const colors = useColors();
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "custom");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedMeta = platformMeta(platform);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!url.trim())  { setError("URL is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), url: url.trim(), platform, color: selectedMeta.color });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.formTitle, { color: colors.foreground }]}>
        {initial?.id ? "Edit Network" : "Add New Network"}
      </Text>

      {/* Platform picker */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Platform</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformScroll}>
        <View style={styles.platformRow}>
          {Object.entries(PLATFORMS).map(([key, meta]) => {
            const active = platform === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setPlatform(key);
                  if (!name || Object.values(PLATFORMS).some(p => p.label === name)) {
                    setName(meta.label);
                  }
                }}
                style={[
                  styles.platformChip,
                  {
                    backgroundColor: active ? meta.color + "33" : colors.card,
                    borderColor: active ? meta.color : colors.border,
                  },
                ]}
              >
                <Feather name={meta.icon} size={13} color={active ? meta.color : colors.mutedForeground} />
                <Text style={[styles.platformChipTxt, { color: active ? meta.color : colors.mutedForeground }]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Name */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Display Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. My Discord Server"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: error && !name ? colors.destructive : colors.border }]}
      />

      {/* URL */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>URL / Link</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://discord.gg/..."
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        keyboardType="url"
        style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: error && !url ? colors.destructive : colors.border }]}
      />

      {error ? <Text style={[styles.errorTxt, { color: colors.destructive }]}>{error}</Text> : null}

      <View style={styles.formButtons}>
        <Pressable onPress={onCancel} style={[styles.cancelBtn, { borderColor: colors.border }]}>
          <Text style={[styles.cancelTxt, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: selectedMeta.color, opacity: saving || pressed ? 0.8 : 1 }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveTxt}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── Individual link row ───────────────────────────────────────────────────────

interface LinkRowProps {
  link: SocialLink;
  onTrigger: (link: SocialLink) => Promise<void>;
  onEdit: (link: SocialLink) => void;
  onDelete: (id: number) => void;
  triggered: boolean;
}

function LinkRow({ link, onTrigger, onEdit, onDelete, triggered }: LinkRowProps) {
  const colors = useColors();
  const [firing, setFiring] = useState(false);
  const meta = platformMeta(link.platform);

  const handleTrigger = async () => {
    if (firing || triggered) return;
    setFiring(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onTrigger(link);
    } finally {
      setFiring(false);
    }
  };

  return (
    <View style={[styles.linkRow, { backgroundColor: colors.card, borderColor: triggered ? meta.color + "88" : colors.border }]}>
      {/* Platform icon */}
      <View style={[styles.linkIcon, { backgroundColor: meta.color + "22" }]}>
        <Feather name={meta.icon} size={18} color={meta.color} />
      </View>

      {/* Info */}
      <View style={styles.linkInfo}>
        <Text style={[styles.linkName, { color: colors.foreground }]}>{link.name}</Text>
        <Text style={[styles.linkUrl, { color: colors.mutedForeground }]} numberOfLines={1}>
          {link.url}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.linkActions}>
        {/* Edit */}
        <Pressable onPress={() => onEdit(link)} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
        </Pressable>
        {/* Delete */}
        <Pressable onPress={() => onDelete(link.id)} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="trash-2" size={13} color={colors.destructive} />
        </Pressable>
        {/* Trigger — main CTA */}
        <Pressable
          onPress={handleTrigger}
          disabled={firing}
          style={({ pressed }) => [
            styles.triggerBtn,
            {
              backgroundColor: triggered ? meta.color : meta.color + "22",
              borderColor: meta.color,
              opacity: firing || pressed ? 0.75 : 1,
            },
          ]}
        >
          {firing
            ? <ActivityIndicator size="small" color={meta.color} />
            : (
              <>
                <Feather
                  name={triggered ? "check" : "send"}
                  size={12}
                  color={triggered ? "#fff" : meta.color}
                />
                <Text style={[styles.triggerTxt, { color: triggered ? "#fff" : meta.color }]}>
                  {triggered ? "Sent!" : "Post"}
                </Text>
              </>
            )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface SocialLinksPanelProps {
  onActivity?: (message: string) => void;
}

export default function SocialLinksPanel({ onActivity }: SocialLinksPanelProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SocialLink | null>(null);
  const [triggered, setTriggered] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSocialLinks();
      setLinks(data);
    } catch {
      // API not reachable yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  const handleTrigger = async (link: SocialLink) => {
    await triggerSocialLink(link.id);
    onActivity?.(`📣 Posted ${link.name} link to chat: ${link.url}`);
    setTriggered((prev) => new Set(prev).add(link.id));
    // Reset "Sent!" badge after 3s
    setTimeout(() => {
      setTriggered((prev) => {
        const next = new Set(prev);
        next.delete(link.id);
        return next;
      });
    }, 3000);
  };

  const handleCreate = async (data: Parameters<typeof createSocialLink>[0]) => {
    await createSocialLink({ ...data, sortOrder: links.length });
    setShowForm(false);
    await load();
  };

  const handleEdit = async (data: Parameters<typeof updateSocialLink>[1]) => {
    if (!editTarget) return;
    await updateSocialLink(editTarget.id, data);
    setEditTarget(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deleteSocialLink(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <Pressable onPress={() => { setExpanded((v) => !v); setShowForm(false); setEditTarget(null); }} style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: "#9146ff22" }]}>
          <Feather name="share-2" size={16} color="#9146ff" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Social Links</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {links.length > 0
              ? `${links.length} network${links.length !== 1 ? "s" : ""} — tap to post to chat`
              : "Add social networks"}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>

          {/* Add / Edit form */}
          {(showForm || editTarget) && (
            <SocialLinkForm
              initial={editTarget ?? undefined}
              onSave={editTarget ? handleEdit : handleCreate}
              onCancel={() => { setShowForm(false); setEditTarget(null); }}
            />
          )}

          {/* Link list */}
          {loading ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : links.length === 0 && !showForm ? (
            <View style={styles.emptyState}>
              <Feather name="share-2" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
                No networks yet.{"\n"}Add your first one below.
              </Text>
            </View>
          ) : (
            <View style={styles.linkList}>
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  onTrigger={handleTrigger}
                  onEdit={(l) => { setEditTarget(l); setShowForm(false); }}
                  onDelete={handleDelete}
                  triggered={triggered.has(link.id)}
                />
              ))}
            </View>
          )}

          {/* Add New Network button */}
          {!showForm && !editTarget && (
            <Pressable
              onPress={() => { setShowForm(true); setEditTarget(null); }}
              style={({ pressed }) => [
                styles.addBtn,
                { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Feather name="plus-circle" size={15} color={colors.primary} />
              <Text style={[styles.addBtnTxt, { color: colors.primary }]}>Add New Network</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  headerIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },

  // Link rows
  linkList: { gap: 8 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  linkIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  linkInfo: { flex: 1, minWidth: 0 },
  linkName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  linkUrl: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  linkActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 62,
    justifyContent: "center",
  },
  triggerTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Form
  form: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  formTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
  platformScroll: { marginHorizontal: -14, paddingHorizontal: 14 },
  platformRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  platformChipTxt: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  errorTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  formButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 2, paddingVertical: 11, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Empty state
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 16 },
  emptyTxt: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
