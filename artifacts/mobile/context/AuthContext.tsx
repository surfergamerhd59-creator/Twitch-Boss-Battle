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

const AUTH_KEY      = "@twitch_auth";
const WORKSPACE_KEY = "@twitch_workspace";

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
        if (rawWs)   setActiveWorkspace(JSON.parse(rawWs) as Workspace);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Deep-link listener (handles mobile://auth?token=...&username=...) ──────
  useEffect(() => {
    const handler = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      if (parsed.path === "auth" || parsed.path === "--/auth") {
        const token       = parsed.queryParams?.["token"]       as string | undefined;
        const username    = parsed.queryParams?.["username"]    as string | undefined;
        const displayName = parsed.queryParams?.["displayName"] as string | undefined;
        const twitchId    = parsed.queryParams?.["twitchId"]    as string | undefined;
        if (token && username && displayName && twitchId) {
          void setToken(token, username, displayName, twitchId);
        }
      }
    };

    const sub = Linking.addEventListener("url", handler);
    Linking.getInitialURL().then((url) => { if (url) handler({ url }); });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setToken = useCallback(
    async (token: string, username: string, displayName: string, twitchId: string) => {
      const u: TwitchUser = { token, username, displayName, twitchId };
      setUser(u);
      // Clear workspace on new login so the workspace selector shows
      setActiveWorkspace(null);
      await AsyncStorage.multiSet([
        [AUTH_KEY, JSON.stringify(u)],
        [WORKSPACE_KEY, ""],
      ]);
    },
    []
  );

  const login = useCallback(async () => {
    const url = `${API_BASE}/auth/twitch`;
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    });
  }, []);

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
    <AuthContext.Provider value={{ user, loading, activeWorkspace, login, logout, setToken, setWorkspace, clearWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
