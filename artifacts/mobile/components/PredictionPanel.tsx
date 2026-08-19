import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  createPrediction,
  getPredictions,
  updatePrediction,
  type Prediction,
} from "@/lib/api";

interface PredictionPanelProps {
  username: string;
}

export function PredictionPanel({ username }: PredictionPanelProps) {
  const colors = useColors();
  const { user } = useAuth();
  const [current, setCurrent] = useState<Prediction | null>(null);
  const [title, setTitle] = useState("");
  const [outcomeOne, setOutcomeOne] = useState("");
  const [outcomeTwo, setOutcomeTwo] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("5");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPrediction = useCallback(async () => {
    if (!user || !username) return;
    setLoading(true);
    setError("");
    try {
      const predictions = await getPredictions(username, user.token);
      setCurrent(predictions.find((prediction) => prediction.status === "ACTIVE" || prediction.status === "LOCKED") ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load predictions");
    } finally {
      setLoading(false);
    }
  }, [user, username]);

  useEffect(() => { void loadPrediction(); }, [loadPrediction]);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  };

  const handleCreate = async () => {
    if (!user || saving) return;
    const cleanTitle = title.trim();
    const outcomes = [outcomeOne.trim(), outcomeTwo.trim()];
    const duration = Number(durationMinutes) * 60;
    if (!cleanTitle) { setError("Write a prediction question"); return; }
    if (!outcomes[0] || !outcomes[1]) { setError("Enter two outcomes"); return; }
    if (!Number.isInteger(duration) || duration < 30 || duration > 1800) {
      setError("Duration must be between 30 seconds and 30 minutes");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const prediction = await createPrediction(username, cleanTitle, outcomes, duration, user.token);
      setCurrent(prediction);
      setTitle("");
      setOutcomeOne("");
      setOutcomeTwo("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showMessage("Prediction started");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to start prediction");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (status: "LOCKED" | "CANCELED" | "RESOLVED", winningOutcomeId?: string) => {
    if (!user || !current || saving) return;
    setSaving(true);
    setError("");
    try {
      const prediction = await updatePrediction(username, current.id, status, user.token, winningOutcomeId);
      setCurrent(prediction.status === "ACTIVE" || prediction.status === "LOCKED" ? prediction : null);
      Haptics.notificationAsync(status === "CANCELED" ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      showMessage(status === "LOCKED" ? "Prediction locked" : status === "CANCELED" ? "Prediction canceled" : "Prediction resolved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to update prediction");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: "#f7a93122" }]}>
            <Feather name="target" size={17} color="#f7a931" />
          </View>
          <View>
            <Text style={[styles.titleText, { color: colors.foreground }]}>Predictions</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Let viewers bet Channel Points</Text>
          </View>
        </View>
        <Pressable onPress={loadPrediction} disabled={loading} hitSlop={8}>
          {loading ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />}
        </Pressable>
      </View>

      {current ? (
        <View style={[styles.activeBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.activeHeader}>
            <Text style={[styles.question, { color: colors.foreground }]}>{current.title}</Text>
            <Text style={[styles.status, { color: current.status === "LOCKED" ? "#f7a931" : "#00c96f" }]}>{current.status}</Text>
          </View>
          {current.outcomes.map((outcome) => (
            <View key={outcome.id} style={[styles.outcomeRow, { borderColor: colors.border }]}>
              <View style={styles.outcomeInfo}>
                <View style={[styles.outcomeDot, { backgroundColor: outcome.color === "PINK" ? "#e75aa8" : "#1a8fe3" }]} />
                <Text style={[styles.outcomeText, { color: colors.foreground }]}>{outcome.title}</Text>
              </View>
              <Text style={[styles.points, { color: colors.mutedForeground }]}>{outcome.channelPoints.toLocaleString()} pts</Text>
              {current.status === "LOCKED" && (
                <Pressable
                  onPress={() => handleUpdate("RESOLVED", outcome.id)}
                  disabled={saving}
                  style={({ pressed }) => [styles.resolveBtn, { backgroundColor: "#00c96f", opacity: pressed || saving ? 0.7 : 1 }]}
                >
                  <Text style={styles.resolveText}>Winner</Text>
                </Pressable>
              )}
            </View>
          ))}
          <View style={styles.actionRow}>
            {current.status === "ACTIVE" && (
              <Pressable onPress={() => handleUpdate("LOCKED")} disabled={saving} style={[styles.actionBtn, { borderColor: "#f7a931" }]}>
                <Feather name="lock" size={14} color="#f7a931" />
                <Text style={[styles.actionText, { color: "#f7a931" }]}>Lock</Text>
              </Pressable>
            )}
            <Pressable onPress={() => handleUpdate("CANCELED")} disabled={saving} style={[styles.actionBtn, { borderColor: "#ff4040" }]}>
              <Feather name="x" size={14} color="#ff4040" />
              <Text style={[styles.actionText, { color: "#ff4040" }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Will I win this round?"
            placeholderTextColor={colors.mutedForeground}
            maxLength={45}
            style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
          />
          <View style={styles.twoColumns}>
            <TextInput
              value={outcomeOne}
              onChangeText={setOutcomeOne}
              placeholder="Yes"
              placeholderTextColor={colors.mutedForeground}
              maxLength={25}
              style={[styles.input, styles.halfInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
            />
            <TextInput
              value={outcomeTwo}
              onChangeText={setOutcomeTwo}
              placeholder="No"
              placeholderTextColor={colors.mutedForeground}
              maxLength={25}
              style={[styles.input, styles.halfInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={styles.durationRow}>
            <Text style={[styles.durationLabel, { color: colors.mutedForeground }]}>Minutes</Text>
            <TextInput
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.durationInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
            />
            <Pressable onPress={handleCreate} disabled={saving} style={({ pressed }) => [styles.startBtn, { backgroundColor: "#f7a931", opacity: pressed || saving ? 0.75 : 1 }]}>
              {saving ? <ActivityIndicator size="small" color="#0e0e10" /> : <><Feather name="play" size={14} color="#0e0e10" /><Text style={styles.startText}>Start prediction</Text></>}
            </Pressable>
          </View>
        </View>
      )}

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      {message ? <Text style={[styles.message, { color: colors.success }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" },
  form: { gap: 10 },
  input: { minHeight: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  twoColumns: { flexDirection: "row", gap: 8 },
  halfInput: { flex: 1 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  durationLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  durationInput: { width: 46, height: 40, borderRadius: 10, borderWidth: 1, textAlign: "center", fontSize: 13 },
  startBtn: { flex: 1, minHeight: 40, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  startText: { color: "#0e0e10", fontSize: 12, fontFamily: "Inter_700Bold" },
  activeBox: { borderRadius: 12, borderWidth: 1, padding: 10 },
  activeHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  question: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  status: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  outcomeRow: { minHeight: 42, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  outcomeInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  outcomeDot: { width: 8, height: 8, borderRadius: 4 },
  outcomeText: { flexShrink: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  points: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resolveBtn: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  resolveText: { color: "#0e0e10", fontSize: 10, fontFamily: "Inter_700Bold" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, height: 36, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 12, marginTop: 10, lineHeight: 17, fontFamily: "Inter_400Regular" },
  message: { fontSize: 12, marginTop: 10, fontFamily: "Inter_600SemiBold" },
});
