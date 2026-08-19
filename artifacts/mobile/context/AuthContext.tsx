import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { API_BASE } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TwitchUser {
  twitchId: string;
  username: string;
  displayName: string;
  token: string;
}

export type Workspace =
  | { type: "own"; streamerUsername: string; streamerDisplayName: string }
  | { type: "moderating"; streamerUsername: string; streamerDisplayName: string };

interface AuthContextValue {
  user: TwitchUser | null;
  loading: boolean;
  activeWorkspace: Workspace | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string, username: string, displayName: string, twitchId: string) => Promise<void>;
  setWorkspace: (w: Workspace) => Promise<void>;
  clearWorkspace: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  activeWorkspace: null,
  login: async () => {},
  logout: async () => {},
  setToken: async () => {},
  setWorkspace: async () => {},
  clearWorkspace: async () => {},
});

const AUTH_KEY = "@twitch_auth";
const WORKSPACE_KEY = "@twitch_workspace";

// This produces `mobile://auth` in a development/production build because the
// scheme is declared in app.json. Expo Go uses its own exp:// URL instead.
const AUTH_REDIRECT_URL = Linking.createURL("auth", {
  scheme: "mobile",
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restore persisted session ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(WORKSPACE_KEY),
    ])
      .then(([rawUser, rawWs]) => {
        if (rawUser) setUser(JSON.parse(rawUser) as TwitchUser);
        if (rawWs) setActiveWorkspace(JSON.parse(rawWs) as Workspace);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Persist a completed Twitch session ────────────────────────────────────
  const setToken = useCallback(
    async (token: string, username: string, displayName: string, twitchId: string) => {
      const u: TwitchUser = { token, username, displayName, twitchId };
      setUser(u);
      setActiveWorkspace(null);
      await AsyncStorage.multiSet([
        [AUTH_KEY, JSON.stringify(u)],
        [WORKSPACE_KEY, ""],
      ]);
    },
    [],
  );

  // ── Parse and consume a deep-link callback ─────────────────────────────────
  const handleAuthUrl = useCallback(
    (url: string) => {
      const parsed = Linking.parse(url);
      // `mobile://auth?...` parses `auth` as hostname, while
      // `mobile:///auth?...` and Expo Go's `.../--/auth` parse it as path.
      const isAuthCallback =
        parsed.hostname === "auth" ||
        parsed.path === "auth" ||
        parsed.path === "--/auth";

      if (!isAuthCallback) return;

      const getQueryValue = (key: string): string | undefined => {
        const value = parsed.queryParams?.[key];
        return Array.isArray(value) ? value[0] : value;
      };

      const token = getQueryValue("token");
      const username = getQueryValue("username");
      const displayName = getQueryValue("displayName");
      const twitchId = getQueryValue("twitchId");

      if (token && username && displayName && twitchId) {
        void setToken(token, username, displayName, twitchId);
      }
    },
    [setToken],
  );

  // ── Deep-link listener (app already open or launched by the callback) ─────
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleAuthUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    return () => subscription.remove();
  }, [handleAuthUrl]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const login = useCallback(async () => {
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_BASE}/auth/twitch`,
      AUTH_REDIRECT_URL,
    );

    // On some Android versions the URL event arrives separately; handling the
    // returned URL as well makes both foreground and cold-start flows reliable.
    if (result.type === "success") {
      handleAuthUrl(result.url);
    }
  }, [handleAuthUrl]);

  const logout = useCallback(async () => {
    setUser(null);
    setActiveWorkspace(null);
    await AsyncStorage.multiRemove([AUTH_KEY, WORKSPACE_KEY]);
  }, []);

  const setWorkspace = useCallback(async (w: Workspace) => {
    setActiveWorkspace(w);
    await AsyncStorage.setItem(WORKSPACE_KEY, JSON.stringify(w));
  }, []);

  const clearWorkspace = useCallback(async () => {
    setActiveWorkspace(null);
    await AsyncStorage.removeItem(WORKSPACE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeWorkspace,
        login,
        logout,
        setToken,
        setWorkspace,
        clearWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
