import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

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
const BOSS_DURATION_MS = 3 * 60 * 1000;

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BotState>(defaultState);

  // Store boss end timestamp instead of a live timer reference.
  // This survives background/foreground transitions cleanly.
  const bossEndTimeRef = useRef<number | null>(null);
  const bossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore persisted activity ─────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<BotState>;
          setState((prev) => ({ ...prev, activity: saved.activity ?? [] }));
        } catch {}
      }
    });
  }, []);

  const saveActivity = useCallback((activity: ActivityEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ activity }));
  }, []);

  // ── AppState: reschedule boss timer after returning from background ────────

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next !== "active") {
        // Going to background — clear the live timer (timestamp is preserved)
        if (bossTimerRef.current) {
          clearTimeout(bossTimerRef.current);
          bossTimerRef.current = null;
        }
        return;
      }

      // Returned to foreground — check if boss timer expired while backgrounded
      if (bossEndTimeRef.current !== null) {
        const remaining = bossEndTimeRef.current - Date.now();
        if (remaining <= 0) {
          // Expired while backgrounded
          bossEndTimeRef.current = null;
          setState((prev) => {
            if (!prev.bossActive) return prev;
            return { ...prev, bossActive: false };
          });
          logActivity({ type: "boss", message: "Time's up! The Boss escaped while you were away." });
        } else {
          // Reschedule with remaining time
          bossTimerRef.current = setTimeout(() => {
            bossEndTimeRef.current = null;
            setState((prev) => {
              if (!prev.bossActive) return prev;
              return { ...prev, bossActive: false };
            });
            logActivity({ type: "boss", message: "Time's up! The Boss escaped. Chat lost!" });
          }, remaining);
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub.remove();
      if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
    };
  // logActivity is defined below — use ref to avoid circular dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

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
    // Clear any existing timer
    if (bossTimerRef.current) clearTimeout(bossTimerRef.current);

    bossEndTimeRef.current = Date.now() + BOSS_DURATION_MS;

    setState((prev) => ({
      ...prev,
      bossActive: true,
      bossHP: MAX_HP,
      bossMaxHP: MAX_HP,
      leaderboard: [],
    }));

    logActivity({ type: "boss", message: "Dragon Boss invoked! 500 HP — 3 minutes to defeat it!" });

    bossTimerRef.current = setTimeout(() => {
      bossEndTimeRef.current = null;
      bossTimerRef.current = null;
      setState((prev) => {
        if (!prev.bossActive) return prev;
        return { ...prev, bossActive: false };
      });
      logActivity({ type: "boss", message: "Time's up! The Boss escaped. Chat lost!" });
    }, BOSS_DURATION_MS);
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
              .map((e) => (e.user === user ? { ...e, damage: e.damage + damage } : e))
              .sort((a, b) => b.damage - a.damage)
          : [...prev.leaderboard, { user, damage }].sort((a, b) => b.damage - a.damage);

        const newState = { ...prev, bossHP: newHP, leaderboard: newLeaderboard };

        if (newHP <= 0) {
          if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
          bossEndTimeRef.current = null;
          bossTimerRef.current = null;
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
      if (bossTimerRef.current) clearTimeout(bossTimerRef.current);
      bossEndTimeRef.current = null;
      bossTimerRef.current = null;
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
