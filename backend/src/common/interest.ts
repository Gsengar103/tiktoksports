import { reactionScore } from "./rank";
import { PrismaService } from "../prisma/prisma.service";

const WINDOW_MS = 30 * 60 * 1000;
const LAST_WATCHES = 10;
const SKIP_MS = 2000;
const DECAY_MS = 10 * 60 * 1000;

export type Interest = {
  sport: Map<string, number>;
  contentType: Map<string, number>;
  level: Map<string, number>;
  finished: Set<string>;
};

type WatchSample = {
  videoId: string;
  startedAt: Date;
  durationMs: number;
  videoDurationMs: number;
  sportId: string;
  contentTypeId: string;
  levelId: string;
};

export function emptyInterest(): Interest {
  return { sport: new Map(), contentType: new Map(), level: new Map(), finished: new Set() };
}

export function buildInterest(watches: WatchSample[], liked: Set<string>, commented: Set<string>, now = Date.now()): Interest {
  const interest = emptyInterest();
  for (const watch of watches) {
    if (watch.videoDurationMs > 0 && watch.durationMs >= watch.videoDurationMs) interest.finished.add(watch.videoId);
    if (watch.durationMs === 0) continue;
    const signal =
      watch.durationMs < SKIP_MS ? -0.5 : Math.min(1, watch.durationMs / Math.max(watch.videoDurationMs, 1));
    const bonus = (liked.has(watch.videoId) ? 1 : 0) + (commented.has(watch.videoId) ? 1.5 : 0);
    const decay = Math.exp(-Math.max(0, now - watch.startedAt.getTime()) / DECAY_MS);
    const contribution = (signal + bonus) * decay;
    add(interest.sport, watch.sportId, contribution);
    add(interest.contentType, watch.contentTypeId, contribution);
    add(interest.level, watch.levelId, contribution);
  }
  return interest;
}

export function interestScore(
  interest: Interest,
  candidate: {
    sportId: string;
    contentTypeId: string;
    levelId: string;
    counter: { likes?: number; comments?: number } | null;
  },
): number {
  return (
    (interest.sport.get(candidate.sportId) ?? 0) * 4 +
    (interest.contentType.get(candidate.contentTypeId) ?? 0) * 2 +
    (interest.level.get(candidate.levelId) ?? 0) * 1 +
    reactionScore(candidate.counter) * 0.1
  );
}

export async function loadInterest(prisma: PrismaService, userId: string): Promise<Interest> {
  const since = new Date(Date.now() - WINDOW_MS);
  const include = { video: { select: { sportId: true, contentTypeId: true, levelId: true } } } as const;
  const [recent, lastTen] = await Promise.all([
    prisma.videoWatch.findMany({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      include,
    }),
    prisma.videoWatch.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: LAST_WATCHES,
      include,
    }),
  ]);
  const window = (recent.length <= lastTen.length ? recent : lastTen).map((watch) => ({
    videoId: watch.videoId,
    startedAt: watch.startedAt,
    durationMs: watch.durationMs,
    videoDurationMs: watch.videoDurationMs,
    sportId: watch.video.sportId,
    contentTypeId: watch.video.contentTypeId,
    levelId: watch.video.levelId,
  }));
  if (window.length === 0) return emptyInterest();
  const videoIds = [...new Set(window.map((watch) => watch.videoId))];
  const [likes, comments] = await Promise.all([
    prisma.like.findMany({ where: { userId, videoId: { in: videoIds } }, select: { videoId: true } }),
    prisma.comment.findMany({ where: { userId, videoId: { in: videoIds } }, select: { videoId: true } }),
  ]);
  return buildInterest(
    window,
    new Set(likes.map((like) => like.videoId)),
    new Set(comments.map((comment) => comment.videoId)),
  );
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}
