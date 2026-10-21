import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SportRelation, VideoStatus } from "@prisma/client";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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
    const include = { counter: true, creator: { select: { id: true, displayName: true } } } as const;
    const live = {
      status: VideoStatus.LIVE,
      ...(blockedIds.length > 0 ? { creatorId: { notIn: blockedIds } } : {}),
    };
    const followed =
      sportIds.length > 0
        ? await this.prisma.video.findMany({
            where: { ...live, sportId: { in: sportIds } },
            orderBy: { createdAt: "desc" },
            take,
            include,
          })
        : [];
    const more =
      followed.length < take
        ? await this.prisma.video.findMany({
            where: {
              ...live,
              ...(followed.length > 0 ? { id: { notIn: followed.map((video) => video.id) } } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: take - followed.length,
            include,
          })
        : [];
    const videos = [...followed, ...more];
    return {
      reason: followed.length > 0 ? "followed-sports" : "latest-live",
      videos: videos.map((video) => ({
        id: video.id,
        caption: video.caption,
        sportId: video.sportId,
        contentTypeId: video.contentTypeId,
        levelId: video.levelId,
        creator: video.creator,
        counts: video.counter,
      })),
    };
  }
}
