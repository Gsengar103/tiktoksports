const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join("\n");
    if (parsed.message) return parsed.message;
  } catch {
    // The body was not JSON.
  }
  return body || `Request failed (${status})`;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; timeoutMs?: number } = {},
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
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!response.ok) throw new ApiError(errorMessage(text, response.status), response.status);
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
  email: string;
  displayName: string;
  ageBand: string;
  role: string;
};

export type ProfileSport = {
  sportId: string;
  relation: "FOLLOWS" | "PLAYS";
  levelId: string | null;
};

export type Profile = {
  city: string | null;
  cityVisible: boolean;
  goal: "WATCH" | "LEARN" | "PLAY_MORE";
  sports: ProfileSport[];
};

export type Me = SessionUser & { profile: Profile | null };

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
  counts: { likes: number; saves: number; comments: number } | null;
};

export type PublicVideo = {
  id: string;
  caption: string;
  durationMs: number;
  creator: { id: string; displayName: string };
  assets: { role: string; url: string }[];
};
