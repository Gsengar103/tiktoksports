const BASE = import.meta.env.VITE_API_URL ?? "";

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

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) throw new ApiError(errorMessage(text, response.status), response.status);
  return (text ? JSON.parse(text) : undefined) as T;
}

export type Staff = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

export type ReviewAsset = { role: string; url: string };

export type ReviewCase = {
  id: string;
  videoId: string;
  status: string;
  reason: string;
  createdAt: string;
  reports: { id: string; reason: string; createdAt: string }[];
  video: {
    id: string;
    caption: string;
    status: string;
    durationMs: number;
    sportId: string;
    creator: { id: string; ageBand: string; displayName: string };
  };
  assets: ReviewAsset[];
};

export type DecisionAction = "APPROVE" | "REMOVE" | "HOLD";

export type AdminVideo = {
  id: string;
  caption: string;
  status: string;
  sportId: string;
  durationMs: number;
  createdAt: string;
  creator: { id: string; displayName: string; ageBand: string };
  reports: number;
  counts: { likes: number; saves: number; comments: number };
  assets: ReviewAsset[];
};

export type AdminReport = {
  id: string;
  reason: string;
  createdAt: string;
  video: { id: string; caption: string; status: string } | null;
};

export type AdminPerson = {
  id: string;
  email: string;
  displayName: string;
  ageBand: string;
  role: string;
  status: string;
  createdAt: string;
  videos: number;
};

export type AuditRow = {
  id: string;
  action: string;
  reason: string;
  targetId: string;
  createdAt: string;
  actor: string;
};
