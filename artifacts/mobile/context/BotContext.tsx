import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface DamageEntry {
  user: string;
  damage: number;
}

export interface ActivityEntry {
  id: string;
  type: "reward" | "attack" | "boss" | "ai" | "effect" | "sound";
  message: string;
  timestamp: number;
}

interface BotState {
  bossActive: boolean;
  bossHP: number;
  bossMaxHP: number;
  leaderboard: DamageEntry[];
  activity: ActivityEntry[];
  botConnected: boolean;
}

interface BotContextType extends BotState {
  startBoss: () => void;
  attackBoss: (user: string) => void;
  endBoss: (victory: boolean) => void;
  logActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
  clearActivity: () => void;
  setBotConnected: (v: boolean) => void;
  // FUTURE ACTION SLOT: setChannelLive(v: boolean)
  // FUTURE ACTION SLOT: setViewerCount(n: number)
}

const defaultState: BotState = {
  bossActive: false,
  bossHP: 500,
  bossMaxHP: 500,
  leaderboard: [],
  activity: [],
  botConnected: false,
};

const BotContext = createContext<BotContextType | null>(null);

const STORAGE_KEY = "bot_activity";
const MAX_HP = 500;

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BotState>(defaultState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<BotState>;
          setState((prev) => ({
            ...prev,
            activity: saved.activity ?? [],
          }));
        } catch {}
      }
    });
  }, []);

  const saveActivity = useCallback((activity: ActivityEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ activity }));
  }, []);

  const logActivity = useCallback(
    (entry: Omit<ActivityEntry, "id" | "timestamp">) => {
      setState((prev) => {
        const newEntry: ActivityEntry = {
          ...entry,
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          timestamp: Date.now(),
        };
        const updated = [newEntry, ...prev.activity].slice(0, 50);
        saveActivity(updated);
        return { ...prev, activity: updated };
      });
    },
    [saveActivity]
  );

  const startBoss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((prev) => ({
      ...prev,
      bossActive: true,
      bossHP: MAX_HP,
      bossMaxHP: MAX_HP,
      leaderboard: [],
    }));
    logActivity({ type: "boss", message: "Dragon Boss invoked! 500 HP — 3 minutes to defeat it!" });
    timerRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.bossActive) {
          logActivity({ type: "boss", message: "Time's up! The Boss escaped. Chat lost!" });
          return { ...prev, bossActive: false };
        }
        return prev;
      });
    }, 3 * 60 * 1000);
  }, [logActivity]);

  const attackBoss = useCallback(
    (user: string) => {
      setState((prev) => {
        if (!prev.bossActive) return prev;
        const damage = Math.floor(Math.random() * 11) + 5;
        const newHP = Math.max(0, prev.bossHP - damage);
        const existing = prev.leaderboard.find((e) => e.user === user);
        const newLeaderboard = existing
          ? prev.leaderboard
              .map((e) =>
                e.user === user ? { ...e, damage: e.damage + damage } : e
              )
              .sort((a, b) => b.damage - a.damage)
          : [...prev.leaderboard, { user, damage }].sort(
              (a, b) => b.damage - a.damage
            );

        const newState = { ...prev, bossHP: newHP, leaderboard: newLeaderboard };
        if (newHP <= 0) {
          if (timerRef.current) clearTimeout(timerRef.current);
          logActivity({
            type: "boss",
            message: `Victory! Boss defeated. MVP: ${newLeaderboard[0]?.user ?? "Unknown"}`,
          });
          return { ...newState, bossActive: false };
        }
        logActivity({
          type: "attack",
          message: `${user} dealt ${damage} dmg — Boss at ${newHP} HP`,
        });
        return newState;
      });
    },
    [logActivity]
  );

  const endBoss = useCallback(
    (victory: boolean) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState((prev) => ({ ...prev, bossActive: false }));
      logActivity({
        type: "boss",
        message: victory ? "Boss manually defeated!" : "Boss event ended by streamer.",
      });
    },
    [logActivity]
  );

  const clearActivity = useCallback(() => {
    setState((prev) => ({ ...prev, activity: [] }));
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const setBotConnected = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, botConnected: v }));
  }, []);

  return (
    <BotContext.Provider
      value={{
        ...state,
        startBoss,
        attackBoss,
        endBoss,
        logActivity,
        clearActivity,
        setBotConnected,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBotContext() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error("useBotContext must be used within BotProvider");
  return ctx;
}
