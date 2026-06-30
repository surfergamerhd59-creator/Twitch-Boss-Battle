import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
  // FUTURE ACTION SLOT: setActionEnabled(id, enabled)
  // FUTURE ACTION SLOT: setChannelPointCost(id, cost)
  // FUTURE ACTION SLOT: resetAllPermissions()
}

const STORAGE_KEY = "actions_permissions_v1";

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
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Restore persisted permissions
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
    (actionId: string): PermissionLevel =>
      permissions[actionId] ?? "everyone",
    [permissions]
  );

  const startCooldown = useCallback(
    (actionId: string, seconds: number) => {
      if (seconds <= 0) return;
      if (timers.current[actionId]) clearInterval(timers.current[actionId]);
      setCooldowns((prev) => ({ ...prev, [actionId]: seconds }));
      timers.current[actionId] = setInterval(() => {
        setCooldowns((prev) => {
          const remaining = (prev[actionId] ?? 0) - 1;
          if (remaining <= 0) {
            clearInterval(timers.current[actionId]);
            delete timers.current[actionId];
            const next = { ...prev };
            delete next[actionId];
            return next;
          }
          return { ...prev, [actionId]: remaining };
        });
      }, 1000);
    },
    []
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
