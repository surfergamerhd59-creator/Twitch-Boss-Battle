import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getBanners,
  createBanner,
  updateBanner,
  activateBanner,
  deactivateAllBanners,
  deleteBanner,
  type Banner,
} from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const BG_PRESETS = [
  "#1a1a2e", "#0d1b2a", "#1b2838", "#2d1b33",
  "#1a2e1a", "#2e1a1a", "#9146ff", "#ff4040",
];

// ── Active banner preview (shown at top of Dashboard) ─────────────────────────

export function ActiveBannerCard({ banner }: { banner: Banner }) {
  const colors = useColors();
  return (
    <View style={[styles.activeCard, { backgroundColor: banner.bgColor, borderColor: colors.primary + "55" }]}>
      <View style={styles.activeBadge}>
        <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.activeBadgeTxt, { color: colors.success }]}>LIVE BANNER</Text>
      </View>
      {banner.imageUrl ? (
        <Image
          source={{ uri: banner.imageUrl }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      ) : null}
      <Text style={styles.bannerTitle}>{banner.title}</Text>
      {banner.bodyText ? (
        <Text style={styles.bannerBody} numberOfLines={2}>{banner.bodyText}</Text>
      ) : null}
      {banner.ctaText ? (
        <View style={[styles.ctaChip, { backgroundColor: colors.primary }]}>
          <Text style={styles.ctaTxt}>{banner.ctaText}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Form for creating / editing a banner ──────────────────────────────────────

interface BannerFormProps {
  initial?: Partial<Banner>;
  onSave: (data: { title: string; bodyText: string; imageUrl: string; bgColor: string; ctaText: string }) => Promise<void>;
  onCancel: () => void;
}

function BannerForm({ initial, onSave, onCancel }: BannerFormProps) {
  const colors = useColors();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [bodyText, setBodyText] = useState(initial?.bodyText ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [bgColor, setBgColor] = useState(initial?.bgColor ?? "#1a1a2e");
  const [ctaText, setCtaText] = useState(initial?.ctaText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ title, bodyText, imageUrl, bgColor, ctaText });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      {/* Preview */}
      <View style={[styles.formPreview, { backgroundColor: bgColor }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.formPreviewImg} resizeMode="cover" />
        ) : null}
        <Text style={styles.formPreviewTitle}>{title || "Banner title"}</Text>
        {bodyText ? <Text style={styles.formPreviewBody} numberOfLines={2}>{bodyText}</Text> : null}
      </View>

      <TextInput value={title} onChangeText={setTitle} placeholder="Title *"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: error && !title ? colors.destructive : colors.border }]} />
      <TextInput value={bodyText} onChangeText={setBodyText} placeholder="Body text (optional)"
        placeholderTextColor={colors.mutedForeground} multiline
        style={[styles.inputMulti, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]} />
      <TextInput value={imageUrl} onChangeText={setImageUrl} placeholder="Image URL (optional)"
        placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="url"
        style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]} />
      <TextInput value={ctaText} onChangeText={setCtaText} placeholder="CTA button text (optional)"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]} />

      {/* BG color picker */}
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Background Color</Text>
      <View style={styles.colorRow}>
        {BG_PRESETS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setBgColor(c)}
            style={[styles.colorSwatch, { backgroundColor: c, borderColor: bgColor === c ? "#fff" : "transparent" }]}
          />
        ))}
      </View>

      {error ? <Text style={[styles.errorTxt, { color: colors.destructive }]}>{error}</Text> : null}

      <View style={styles.formButtons}>
        <Pressable onPress={onCancel} style={[styles.cancelBtn, { borderColor: colors.border }]}>
          <Text style={[styles.cancelTxt, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: saving || pressed ? 0.8 : 1 }]}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveTxt}>Save Banner</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── Main BannerManager panel ──────────────────────────────────────────────────

interface BannerManagerProps {
  onActiveBannerChange?: (banner: Banner | null) => void;
}

export default function BannerManager({ onActiveBannerChange }: BannerManagerProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Banner | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBanners();
      setBanners(data);
      const active = data.find((b) => b.isActive) ?? null;
      onActiveBannerChange?.(active);
    } catch {
      // API not reachable
    } finally {
      setLoading(false);
    }
  }, [onActiveBannerChange]);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  const handleCreate = async (data: Parameters<typeof createBanner>[0]) => {
    await createBanner(data);
    setMode("list");
    await load();
  };

  const handleEdit = async (data: Parameters<typeof updateBanner>[1]) => {
    if (!editTarget) return;
    await updateBanner(editTarget.id, data);
    setMode("list");
    setEditTarget(null);
    await load();
  };

  const handleActivate = async (banner: Banner) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await activateBanner(banner.id);
    await load();
  };

  const handleDeactivateAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deactivateAllBanners();
    await load();
  };

  const handleDelete = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await deleteBanner(id);
    await load();
  };

  const activeBanner = banners.find((b) => b.isActive);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="image" size={16} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Banner Promotions</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {activeBanner ? `"${activeBanner.title}" is live` : banners.length > 0 ? `${banners.length} banners, none active` : "No banners yet"}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {mode === "create" && (
            <BannerForm
              onSave={handleCreate}
              onCancel={() => setMode("list")}
            />
          )}

          {mode === "edit" && editTarget && (
            <BannerForm
              initial={editTarget}
              onSave={handleEdit}
              onCancel={() => { setMode("list"); setEditTarget(null); }}
            />
          )}

          {mode === "list" && (
            <>
              <Pressable
                onPress={() => setMode("create")}
                style={({ pressed }) => [
                  styles.createBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.createBtnTxt}>New Banner</Text>
              </Pressable>

              {activeBanner && (
                <Pressable
                  onPress={handleDeactivateAll}
                  style={[styles.deactivateBtn, { borderColor: colors.border }]}
                >
                  <Feather name="eye-off" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.deactivateTxt, { color: colors.mutedForeground }]}>Hide active banner</Text>
                </Pressable>
              )}

              {loading ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginTop: 8 }} />
              ) : banners.length === 0 ? (
                <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
                  No banners yet. Create one above.
                </Text>
              ) : (
                <View style={styles.bannerList}>
                  {banners.map((banner) => (
                    <View
                      key={banner.id}
                      style={[
                        styles.bannerRow,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: banner.isActive ? colors.primary + "66" : colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.bannerRowSwatch, { backgroundColor: banner.bgColor }]} />
                      <View style={styles.bannerRowInfo}>
                        <Text style={[styles.bannerRowTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {banner.title}
                        </Text>
                        {banner.bodyText ? (
                          <Text style={[styles.bannerRowBody, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {banner.bodyText}
                          </Text>
                        ) : null}
                        {banner.isActive && (
                          <View style={styles.livePill}>
                            <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                            <Text style={[styles.liveTxt, { color: colors.success }]}>Live</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.bannerRowActions}>
                        {!banner.isActive && (
                          <Pressable
                            onPress={() => handleActivate(banner)}
                            style={[styles.rowActionBtn, { backgroundColor: colors.primary + "22" }]}
                            hitSlop={6}
                          >
                            <Feather name="eye" size={13} color={colors.primary} />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => { setEditTarget(banner); setMode("edit"); }}
                          style={[styles.rowActionBtn, { backgroundColor: colors.card }]}
                          hitSlop={6}
                        >
                          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(banner.id)}
                          style={[styles.rowActionBtn, { backgroundColor: colors.destructive + "22" }]}
                          hitSlop={6}
                        >
                          <Feather name="trash-2" size={13} color={colors.destructive} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  headerIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  createBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  deactivateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  deactivateTxt: { fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyTxt: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  bannerList: { gap: 8 },
  bannerRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  bannerRowSwatch: { width: 8, alignSelf: "stretch" },
  bannerRowInfo: { flex: 1, padding: 10, gap: 2 },
  bannerRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bannerRowBody: { fontSize: 11, fontFamily: "Inter_400Regular" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  liveTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  bannerRowActions: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 10 },
  rowActionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  // Active banner card
  activeCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 6 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeTxt: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  bannerImage: { width: "100%", height: 120, borderRadius: 10 },
  bannerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  bannerBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", lineHeight: 18 },
  ctaChip: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginTop: 4 },
  ctaTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  // Form
  form: { gap: 10 },
  formPreview: { borderRadius: 12, padding: 14, gap: 6, minHeight: 80 },
  formPreviewImg: { width: "100%", height: 80, borderRadius: 8 },
  formPreviewTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  formPreviewBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  input: { height: 42, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1 },
  inputMulti: { height: 72, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1, textAlignVertical: "top" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
  colorRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  colorSwatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 2 },
  errorTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  formButtons: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 2, paddingVertical: 11, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  saveTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
