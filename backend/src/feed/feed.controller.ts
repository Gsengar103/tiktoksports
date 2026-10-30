import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SportRelation, VideoStatus } from "@prisma/client";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Interest, interestScore, loadInterest } from "../common/interest";
import { FOLLOW_NEW_MS, FOLLOW_PRIORITY_CAP, NEXT_REACTION_SLOTS } from "../common/rank";
import { PrismaService } from "../prisma/prisma.service";

class FeedQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}

@Controller("v1/feed")
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async feed(@CurrentUser() user: AuthUser, @Query() query: FeedQuery) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      include: { sports: true },
    });
    const sportIds = profile?.sports.filter((sport) => sport.relation === SportRelation.FOLLOWS).map((sport) => sport.sportId) ?? [];
    const blocks = await this.prisma.block.findMany({ where: { blockerId: user.id } });
    const blockedIds = blocks.map((block) => block.blockedId);
    const take = query.limit ?? 20;
    const poolSize = Math.max(take, 40);
    const include = { counter: true, creator: { select: { id: true, displayName: true } } } as const;
    const live = {
      status: VideoStatus.LIVE,
      ...(blockedIds.length > 0 ? { creatorId: { notIn: blockedIds } } : {}),
    };
    const follows = await this.prisma.follow.findMany({ where: { followerId: user.id }, select: { followeeId: true } });
    const followeeIds = follows.map((row) => row.followeeId).filter((id) => !blockedIds.includes(id));
    const fromPeople =
      followeeIds.length > 0
        ? await this.prisma.video.findMany({
            where: { ...live, creatorId: { in: followeeIds }, createdAt: { gte: new Date(Date.now() - FOLLOW_NEW_MS) } },
            orderBy: { createdAt: "desc" },
            take: FOLLOW_PRIORITY_CAP,
            include,
          })
        : [];
    const followed =
      sportIds.length > 0
        ? await this.prisma.video.findMany({
            where: { ...live, sportId: { in: sportIds } },
            orderBy: { createdAt: "desc" },
            take: poolSize,
            include,
          })
        : [];
    const others = await this.prisma.video.findMany({
      where: {
        ...live,
        ...(followed.length > 0 ? { id: { notIn: followed.map((video) => video.id) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: poolSize,
      include,
    });
    const interest = await loadInterest(this.prisma, user.id);
    const priority = fromPeople.filter((video) => !interest.finished.has(video.id));
    const priorityIds = new Set(priority.map((video) => video.id));
    const sportPool = followed.filter((video) => !priorityIds.has(video.id));
    const otherPool = others.filter((video) => !priorityIds.has(video.id));
    const opener = priority[0] ?? sportPool[0] ?? otherPool[0];
    const videos = opener ? orderFeed(opener, sportPool, otherPool, interest, priority.slice(1)).slice(0, take) : [];
    const liked = videos.length
      ? await this.prisma.like.findMany({
          where: { userId: user.id, videoId: { in: videos.map((video) => video.id) } },
          select: { videoId: true },
        })
      : [];
    const likedIds = new Set(liked.map((row) => row.videoId));
    const followedPeople = new Set(followeeIds);
    return {
      reason: priority.length > 0 ? "followed-people" : followed.length > 0 ? "followed-sports" : "latest-live",
      videos: videos.map((video) => ({
        id: video.id,
        caption: video.caption,
        sportId: video.sportId,
        contentTypeId: video.contentTypeId,
        levelId: video.levelId,
        creator: video.creator,
        following: followedPeople.has(video.creator.id),
        liked: likedIds.has(video.id),
        counts: {
          likes: video.counter?.likes ?? 0,
          saves: video.counter?.saves ?? 0,
          comments: video.counter?.comments ?? 0,
        },
      })),
    };
  }
}

function orderFeed<
  T extends {
    id: string;
    createdAt: Date;
    sportId: string;
    contentTypeId: string;
    levelId: string;
    counter: { likes: number; comments: number } | null;
  },
>(opener: T, followed: T[], others: T[], interest: Interest, lead: T[]): T[] {
  const leadIds = new Set(lead.map((video) => video.id));
  const rest = [...followed, ...others].filter((video) => video.id !== opener.id && !leadIds.has(video.id) && !interest.finished.has(video.id));
  const upcoming = [...rest].sort(
    (left, right) => interestScore(interest, right) - interestScore(interest, left) || right.createdAt.getTime() - left.createdAt.getTime(),
  );
  const next = upcoming.slice(0, NEXT_REACTION_SLOTS);
  const used = new Set([opener.id, ...lead.map((video) => video.id), ...next.map((video) => video.id)]);
  const byNewest = (left: T, right: T) => right.createdAt.getTime() - left.createdAt.getTime();
  const restFollowed = followed.filter((video) => !used.has(video.id) && !interest.finished.has(video.id)).sort(byNewest);
  const restOthers = others.filter((video) => !used.has(video.id) && !interest.finished.has(video.id)).sort(byNewest);
  return [opener, ...lead, ...next, ...restFollowed, ...restOthers];
}
