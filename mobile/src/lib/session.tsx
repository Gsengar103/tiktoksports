import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, Me, Profile, SessionUser } from "./api";
import { deleteItem, getItem, setItem } from "./token-store";

const ACCESS = "sports.accessToken";
const REFRESH = "sports.refreshToken";

type Session = {
  ready: boolean;
  token: string | null;
  me: Me | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string; dateOfBirth: string }) => Promise<void>;
  saveProfile: (input: {
    goal: Profile["goal"];
    cityVisible: boolean;
    sports: { sportId: string; relation: "FOLLOWS" | "PLAYS"; levelId?: string }[];
  }) => Promise<void>;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

async function persist(accessToken: string, refreshToken: string) {
  await setItem(ACCESS, accessToken);
  await setItem(REFRESH, refreshToken);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async (accessToken: string) => {
    const next = await api<Me>("/v1/me", { token: accessToken });
    setMe(next);
    setToken(accessToken);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getItem(ACCESS);
      if (!stored) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        if (!cancelled) await loadMe(stored);
      } catch {
        await deleteItem(ACCESS);
        await deleteItem(REFRESH);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const accept = useCallback(
    async (session: { accessToken: string; refreshToken: string; user: SessionUser }) => {
      await persist(session.accessToken, session.refreshToken);
      await loadMe(session.accessToken);
    },
    [loadMe],
  );

  const value = useMemo<Session>(
    () => ({
      ready,
      token,
      me,
      signIn: async (email, password) => {
        const session = await api<{ accessToken: string; refreshToken: string; user: SessionUser }>("/v1/auth/login", {
          body: { email, password },
        });
        await accept(session);
      },
      register: async (input) => {
        const session = await api<{ accessToken: string; refreshToken: string; user: SessionUser }>("/v1/auth/register", {
          body: input,
        });
        await accept(session);
      },
      saveProfile: async (input) => {
        if (!token) throw new Error("Sign in first");
        await api("/v1/me/profile", { method: "PUT", token, body: input });
        await loadMe(token);
      },
      refreshMe: async () => {
        if (token) await loadMe(token);
      },
      signOut: async () => {
        await deleteItem(ACCESS);
        await deleteItem(REFRESH);
        setToken(null);
        setMe(null);
      },
    }),
    [accept, loadMe, me, ready, token],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session is unavailable");
  return session;
}
