import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { ModBanner } from "@/components/ModBanner";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="boss">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Boss</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="soundboard">
        <Icon sf={{ default: "speaker.wave.2", selected: "speaker.wave.2.fill" }} />
        <Label>Sounds</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="controls">
        <Icon sf={{ default: "slider.horizontal.3", selected: "slider.horizontal.3" }} />
        <Label>Controls</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock.arrow.circlepath", selected: "clock.arrow.circlepath" }} />
        <Label>History</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="permissions">
        <Icon sf={{ default: "lock", selected: "lock.fill" }} />
        <Label>Perms</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="chart.bar.fill" tintColor={color} size={22} /> : <Feather name="bar-chart-2" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="boss"
        options={{
          title: "Boss",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="flame.fill" tintColor={color} size={22} /> : <Feather name="alert-triangle" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="soundboard"
        options={{
          title: "Sounds",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="speaker.wave.2.fill" tintColor={color} size={22} /> : <Feather name="volume-2" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="controls"
        options={{
          title: "Controls",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="slider.horizontal.3" tintColor={color} size={22} /> : <Feather name="sliders" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="clock.arrow.circlepath" tintColor={color} size={22} /> : <Feather name="clock" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="permissions"
        options={{
          title: "Perms",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="lock.fill" tintColor={color} size={22} /> : <Feather name="lock" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <ModBanner />
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
    </View>
  );
}
