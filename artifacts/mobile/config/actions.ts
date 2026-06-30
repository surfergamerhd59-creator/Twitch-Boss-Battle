import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PermissionLevel = "everyone" | "follower" | "sub" | "mod";
export type ActionCategory = "hardware" | "minigame" | "ai" | "sound";

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  everyone: "Everyone",
  follower: "Followers",
  sub: "Subs",
  mod: "Mods",
};

export const PERMISSION_ORDER: PermissionLevel[] = [
  "everyone",
  "follower",
  "sub",
  "mod",
];

export const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  everyone: "#00c96f",
  follower: "#00bfff",
  sub: "#9146ff",
  mod: "#f7a931",
};

export interface ActionDef {
  id: string;
  title: string;
  description: string;
  icon: ComponentProps<typeof Feather>["name"];
  category: ActionCategory;
  accentColor: string;
  defaultPermission: PermissionLevel;
  cooldownSeconds: number;
  // FUTURE ACTION SLOT: channelPointCost?: number
  // FUTURE ACTION SLOT: maxUsesPerStream?: number
  // FUTURE ACTION SLOT: requiresTextInput?: boolean
  // FUTURE ACTION SLOT: tags?: string[]
  // FUTURE ACTION SLOT: enabled?: boolean
}

// ── Action Registry ───────────────────────────────────────────────────────────
// Add new viewer interactions here. Each entry is automatically picked up
// by the Controls tab, Soundboard tab, and Permissions tab.

export const ACTIONS: ActionDef[] = [
  // Hardware
  {
    id: "flashbang",
    title: "Flashbang",
    description: "White fullscreen flash for 1.5 seconds",
    icon: "sun",
    category: "hardware",
    accentColor: "#f7a931",
    defaultPermission: "sub",
    cooldownSeconds: 3,
  },
  {
    id: "invert_mouse",
    title: "Invert Mouse",
    description: "Reverses mouse movement for 10 seconds",
    icon: "refresh-cw",
    category: "hardware",
    accentColor: "#00bfff",
    defaultPermission: "sub",
    cooldownSeconds: 10,
  },
  {
    id: "room_lights",
    title: "Change Room Lights",
    description: "Trigger an IoT light color change",
    icon: "monitor",
    category: "hardware",
    accentColor: "#00c96f",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  // Minigame
  {
    id: "invoke_boss",
    title: "Invoke Boss Monster",
    description: "Summon the dragon — 3-minute battle",
    icon: "alert-triangle",
    category: "minigame",
    accentColor: "#ff4040",
    defaultPermission: "mod",
    cooldownSeconds: 0,
  },
  // AI
  {
    id: "ai_chatbot",
    title: "Talk to the Bot",
    description: "Sarcastic AI responds to viewer question",
    icon: "cpu",
    category: "ai",
    accentColor: "#9146ff",
    defaultPermission: "follower",
    cooldownSeconds: 0,
  },
  // Sounds — each maps to a synthesized sound in the OBS overlay
  {
    id: "sound_airhorn",
    title: "Airhorn",
    description: "Classic streaming airhorn blast",
    icon: "volume-2",
    category: "sound",
    accentColor: "#f7a931",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  {
    id: "sound_sad_violin",
    title: "Sad Violin",
    description: "Descending wah-wah fail sound",
    icon: "music",
    category: "sound",
    accentColor: "#00bfff",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  {
    id: "sound_drumroll",
    title: "Drum Roll",
    description: "Tension-building drum roll",
    icon: "radio",
    category: "sound",
    accentColor: "#ff8c00",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  {
    id: "sound_victory",
    title: "Victory Fanfare",
    description: "Triumphant ascending arpeggio",
    icon: "award",
    category: "sound",
    accentColor: "#ffd700",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  {
    id: "sound_fail",
    title: "Fail Horn",
    description: "Price-is-right style descending fail",
    icon: "frown",
    category: "sound",
    accentColor: "#eb4034",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  {
    id: "sound_ding",
    title: "Ding",
    description: "Quick notification bell",
    icon: "bell",
    category: "sound",
    accentColor: "#00c96f",
    defaultPermission: "everyone",
    cooldownSeconds: 0,
  },
  // FUTURE ACTION SLOT: more sound effects (e.g., cricket, cash register, etc.)
  // FUTURE ACTION SLOT: hardware actions (e.g., vibrate controller, change screen filter)
  // FUTURE ACTION SLOT: overlay actions (e.g., show meme image, play video clip)
  // FUTURE ACTION SLOT: game integrations (e.g., spawn item, change weather)
];

export const ACTIONS_BY_CATEGORY = ACTIONS.reduce<
  Partial<Record<ActionCategory, ActionDef[]>>
>((acc, action) => {
  if (!acc[action.category]) acc[action.category] = [];
  acc[action.category]!.push(action);
  return acc;
}, {});

export const SOUND_ACTIONS = ACTIONS.filter((a) => a.category === "sound");

export function getAction(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}
