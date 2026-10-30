import { deleteItem, getItem, setItem } from "./token-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const ACCESS = "sports.accessToken";
const REFRESH = "sports.refreshToken";

const tokenListeners = new Set<(token: string | null) => void>();

export function onAccessToken(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

function notifyAccessToken(token: string | null) {
  for (const listener of tokenListeners) listener(token);
}

let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refreshToken = await getItem(REFRESH);
  if (!refreshToken) return null;
  const response = await fetch(`${BASE_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await deleteItem(ACCESS);
    await deleteItem(REFRESH);
    notifyAccessToken(null);
    return null;
  }
  const session = (await response.json()) as { accessToken: string; refreshToken: string };
  await setItem(ACCESS, session.accessToken);
  await setItem(REFRESH, session.refreshToken);
  notifyAccessToken(session.accessToken);
  return session.accessToken;
}

function refreshOnce(): Promise<string | null> {
  if (!pendingRefresh) {
    pendingRefresh = refreshAccess().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

function errorFromBody(body: string, status: number): ApiError {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    const message = Array.isArray(parsed.message)
      ? parsed.message.join("\n")
      : parsed.message || body || `Request failed (${status})`;
    return new ApiError(message, status, parsed as Record<string, unknown>);
  } catch {
    return new ApiError(body || `Request failed (${status})`, status);
  }
}

export function profileRequired(error: unknown): { suggestedDisplayName?: string } | null {
  if (!(error instanceof ApiError) || error.status !== 400 || error.details?.needsProfile !== true) return null;
  const name = error.details.suggestedDisplayName;
  return { suggestedDisplayName: typeof name === "string" ? name : undefined };
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; timeoutMs?: number; retried?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const controller = new AbortController();
  const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (response.status === 401 && options.token && !options.retried && path !== "/v1/auth/refresh") {
      const next = await refreshOnce();
      if (next) return api(path, { ...options, token: next, retried: true });
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!response.ok) throw errorFromBody(text, response.status);
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(`No answer from ${path} within ${options.timeoutMs}ms`, 0);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
  ageBand: string;
  role: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export type LinkedProviders = {
  password: boolean;
  phone: boolean;
  google: boolean;
  facebook: boolean;
};

export type ProfileSport = {
  sportId: string;
  relation: "FOLLOWS" | "PLAYS";
  levelId: string | null;
};

export type ProfileKind = "PLAYER" | "COACH" | "ACADEMY";
export type ProfilePhotoRole = "LOGO" | "COVER" | "PORTRAIT" | "GALLERY";

export type ProfilePhoto = {
  id: string;
  role: ProfilePhotoRole;
  url: string;
};

export type Profile = {
  kind: ProfileKind;
  city: string | null;
  area: string | null;
  cityVisible: boolean;
  goal: "WATCH" | "LEARN" | "PLAY_MORE";
  playFrequency: "WATCH_ONLY" | "CASUAL" | "WEEKLY" | "MOST_DAYS" | "COMPETITIVE";
  aboutPlay: string | null;
  academyName: string | null;
  linkUrl: string | null;
  groundName: string | null;
  establishedYear: number | null;
  trialNote: string | null;
  coachesWhat: string | null;
  qualification: string | null;
  yearsCoaching: number | null;
  achievements: string | null;
  about: string | null;
  ageGroups: string[];
  batches: string[];
  photos: ProfilePhoto[];
  sports: ProfileSport[];
};

export type ProfileInput = {
  kind: ProfileKind;
  city?: string;
  area?: string;
  cityVisible: boolean;
  goal: Profile["goal"];
  playFrequency: Profile["playFrequency"];
  aboutPlay?: string;
  academyName?: string;
  linkUrl?: string;
  groundName?: string;
  establishedYear?: number;
  trialNote?: string;
  coachesWhat?: string;
  qualification?: string;
  yearsCoaching?: number;
  achievements?: string;
  about?: string;
  ageGroups: string[];
  batches: string[];
  sports: { sportId: string; relation: "FOLLOWS" | "PLAYS"; levelId?: string }[];
};

export type Me = SessionUser & {
  phone: string | null;
  providers: LinkedProviders;
  profile: Profile | null;
};

export type Taxonomy = {
  sports: { id: string; name: string; family: string }[];
  contentTypes: { id: string; name: string }[];
  levels: { id: string; name: string }[];
};

export type FeedVideo = {
  id: string;
  caption: string;
  sportId: string;
  contentTypeId: string;
  levelId: string;
  creator: { id: string; displayName: string };
  following?: boolean;
  liked?: boolean;
  counts: { likes: number; saves: number; comments: number } | null;
  thumbUrl?: string | null;
};

export type PublicVideo = {
  id: string;
  caption: string;
  durationMs: number;
  creator: { id: string; displayName: string };
  assets: { role: string; url: string }[];
};
