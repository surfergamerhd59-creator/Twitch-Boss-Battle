import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";

export function ModBanner() {
  const { activeWorkspace, clearWorkspace } = useAuth();
  const router = useRouter();

  if (!activeWorkspace || activeWorkspace.type !== "moderating") return null;

  const handleSwitch = async () => {
    await clearWorkspace();
    router.replace("/workspace");
  };

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={13} color="#ff8c00" />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          Mod Mode — managing{" "}
          <Text style={styles.streamerName}>@{activeWorkspace.streamerDisplayName}</Text>
        </Text>
      </View>
      <Pressable onPress={handleSwitch} style={styles.switchBtn} hitSlop={8}>
        <Feather name="repeat" size={12} color="#ff8c00" />
        <Text style={styles.switchTxt}>Switch</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#261500",
    borderBottomWidth: 1,
    borderBottomColor: "#ff8c0044",
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  left:         { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  iconWrap:     { width: 22, height: 22, borderRadius: 6, backgroundColor: "#ff8c0022", alignItems: "center", justifyContent: "center" },
  text:         { fontSize: 12, fontFamily: "Inter_500Medium", color: "#adadb8", flexShrink: 1 },
  streamerName: { color: "#ff8c00", fontFamily: "Inter_600SemiBold" },
  switchBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#ff8c0022" },
  switchTxt:    { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#ff8c00" },
});
