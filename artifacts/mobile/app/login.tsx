import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { API_BASE } from "@/lib/api";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, setToken } = useAuth();
  const router = useRouter();

  const [logging, setLogging] = useState(false);
  // Manual JWT paste (fallback for web / devices where deep links don't fire)
  const [manualToken, setManualToken] = useState("");
  const [manualError, setManualError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const handleLogin = async () => {
    setLogging(true);
    try {
      await login();
    } finally {
      setLogging(false);
    }
  };

  const handleManualVerify = async () => {
    if (!manualToken.trim()) { setManualError("Paste the token from the browser"); return; }
    setVerifying(true);
    setManualError("");
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${manualToken.trim()}` },
      });
      if (!res.ok) { setManualError("Invalid token — please try again"); return; }
      const data = await res.json() as { twitchId: string; username: string; displayName: string };
      await setToken(manualToken.trim(), data.username, data.displayName, data.twitchId);
      router.replace("/(tabs)");
    } catch {
      setManualError("Could not verify token — is the API running?");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={[styles.logoCircle, { backgroundColor: "#9146ff22", borderColor: "#9146ff55" }]}>
          <Feather name="tv" size={40} color="#9146ff" />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>Twitch Bot</Text>
        <Text style={[styles.appSub, { color: colors.mutedForeground }]}>Control Panel</Text>
      </View>

      {/* Hero text */}
      <View style={styles.heroText}>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Control your stream{"\n"}from anywhere
        </Text>
        <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>
          Manage your Twitch bot, soundboard, moderation,{"\n"}and stream settings — all in one place.
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: "shield" as const, label: "Secure OAuth login via Twitch" },
          { icon: "zap" as const, label: "Real-time bot control" },
          { icon: "edit-2" as const, label: "Update title & category instantly" },
        ].map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: "#9146ff22" }]}>
              <Feather name={f.icon} size={14} color="#9146ff" />
            </View>
            <Text style={[styles.featureLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaArea}>
        <Pressable
          onPress={handleLogin}
          disabled={logging}
          style={({ pressed }) => [
            styles.loginBtn,
            { backgroundColor: "#9146ff", opacity: logging || pressed ? 0.85 : 1 },
          ]}
        >
          {logging
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <>
                <Feather name="log-in" size={16} color="#fff" />
                <Text style={styles.loginBtnTxt}>Connect with Twitch</Text>
              </>
            )}
        </Pressable>

        {/* Manual token fallback */}
        <Pressable onPress={() => setShowManual((v) => !v)} style={styles.manualLink}>
          <Text style={[styles.manualLinkTxt, { color: colors.mutedForeground }]}>
            {showManual ? "Hide manual entry" : "Already have a token? Enter it manually"}
          </Text>
        </Pressable>

        {showManual && (
          <View style={styles.manualArea}>
            <TextInput
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="Paste your session token here"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.manualInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: manualError ? colors.destructive : colors.border }]}
              autoCapitalize="none"
              secureTextEntry={Platform.OS !== "web"}
            />
            {manualError ? <Text style={[styles.errorTxt, { color: colors.destructive }]}>{manualError}</Text> : null}
            <Pressable
              onPress={handleManualVerify}
              disabled={verifying}
              style={({ pressed }) => [styles.verifyBtn, { borderColor: colors.border, opacity: verifying || pressed ? 0.75 : 1 }]}
            >
              {verifying
                ? <ActivityIndicator size="small" color={colors.foreground} />
                : <Text style={[styles.verifyBtnTxt, { color: colors.foreground }]}>Verify Token</Text>}
            </Pressable>
          </View>
        )}

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By connecting you authorize this app to manage your Twitch channel.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between" },
  logoArea: { alignItems: "center", gap: 12 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 24, fontFamily: "Inter_700Bold" },
  appSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  heroText: { gap: 10, alignItems: "center" },
  heroTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 34 },
  heroDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  features: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  ctaArea: { gap: 14, alignItems: "center" },
  loginBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, width: "100%", minHeight: 54 },
  loginBtnTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  manualLink: { paddingVertical: 4 },
  manualLinkTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  manualArea: { width: "100%", gap: 8 },
  manualInput: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, fontFamily: "Inter_400Regular", borderWidth: 1 },
  errorTxt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  verifyBtn: { height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  verifyBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  legal: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
});
