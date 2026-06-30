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

import {
  ACTIONS,
  PERMISSION_ORDER,
  type PermissionLevel,
} from "@/config/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionsState {
  permissions: Record<string, PermissionLevel>;
  cooldowns: Record<string, number>; // seconds remaining per action id
}

interface ActionsContextType extends ActionsState {
  setPermission: (actionId: string, level: PermissionLevel) => void;
  cyclePermission: (actionId: string) => void;
  getPermission: (actionId: string) => PermissionLevel;
  startCooldown: (actionId: string, seconds: number) => void;
  isCoolingDown: (actionId: string) => boolean;
}

const STORAGE_KEY = "actions_permissions_v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRemaining(endTimes: Record<string, number>): Record<string, number> {
  const now = Date.now();
  const result: Record<string, number> = {};
  for (const [id, end] of Object.entries(endTimes)) {
    const remaining = Math.ceil((end - now) / 1000);
    if (remaining > 0) result[id] = remaining;
  }
  return result;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ActionsContext = createContext<ActionsContextType | null>(null);

function buildDefaultPermissions(): Record<string, PermissionLevel> {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, a.defaultPermission]));
}

export function ActionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>(
    buildDefaultPermissions()
  );
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Store absolute end timestamps — survives background/foreground transitions
  const endTimesRef = useRef<Record<string, number>>({});
  // Single shared tick interval — replaces per-action intervals
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Tick: recalculate remaining seconds from timestamps ───────────────────

  const tick = useCallback(() => {
    const remaining = computeRemaining(endTimesRef.current);
    // Remove expired entries from the ref
    for (const id of Object.keys(endTimesRef.current)) {
      if (!remaining[id]) delete endTimesRef.current[id];
    }
    setCooldowns(remaining);
    // Stop the interval when all cooldowns have expired
    if (Object.keys(remaining).length === 0 && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) return; // already running
    tickRef.current = setInterval(tick, 1000);
  }, [tick]);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // ── AppState: pause interval when backgrounded, resume on foreground ───────

  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active") {
        // Recalculate immediately after returning from background
        const remaining = computeRemaining(endTimesRef.current);
        for (const id of Object.keys(endTimesRef.current)) {
          if (!remaining[id]) delete endTimesRef.current[id];
        }
        setCooldowns(remaining);
        if (Object.keys(remaining).length > 0) startTick();
      } else {
        // background / inactive — stop the interval, timestamps are preserved
        stopTick();
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub.remove();
      stopTick();
    };
  }, [startTick, stopTick]);

  // ── Restore persisted permissions ─────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Record<string, PermissionLevel>;
        setPermissions((prev) => ({ ...prev, ...saved }));
      } catch {}
    });
  }, []);

  const persistPermissions = useCallback(
    (updated: Record<string, PermissionLevel>) => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    []
  );

  // ── Permission actions ────────────────────────────────────────────────────

  const setPermission = useCallback(
    (actionId: string, level: PermissionLevel) => {
      setPermissions((prev) => {
        const next = { ...prev, [actionId]: level };
        persistPermissions(next);
        return next;
      });
    },
    [persistPermissions]
  );

  const cyclePermission = useCallback(
    (actionId: string) => {
      setPermissions((prev) => {
        const current = prev[actionId] ?? "everyone";
        const idx = PERMISSION_ORDER.indexOf(current);
        const next = PERMISSION_ORDER[(idx + 1) % PERMISSION_ORDER.length]!;
        const updated = { ...prev, [actionId]: next };
        persistPermissions(updated);
        return updated;
      });
    },
    [persistPermissions]
  );

  const getPermission = useCallback(
    (actionId: string): PermissionLevel => permissions[actionId] ?? "everyone",
    [permissions]
  );

  // ── Cooldown: store end timestamp, drive display from single tick ─────────

  const startCooldown = useCallback(
    (actionId: string, seconds: number) => {
      if (seconds <= 0) return;
      endTimesRef.current[actionId] = Date.now() + seconds * 1000;
      setCooldowns((prev) => ({ ...prev, [actionId]: seconds }));
      startTick();
    },
    [startTick]
  );

  const isCoolingDown = useCallback(
    (actionId: string) => (cooldowns[actionId] ?? 0) > 0,
    [cooldowns]
  );

  return (
    <ActionsContext.Provider
      value={{
        permissions,
        cooldowns,
        setPermission,
        cyclePermission,
        getPermission,
        startCooldown,
        isCoolingDown,
      }}
    >
      {children}
    </ActionsContext.Provider>
  );
}

export function useActionsContext() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useActionsContext must be used within ActionsProvider");
  return ctx;
}
