import { Controller, Get, NotFoundException, Query, UseGuards } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { IsOptional, IsString, MinLength } from "class-validator";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

class RelatedQuery {
  @IsString()
  @MinLength(1)
  videoId!: string;
}

class SearchQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  sportId?: string;

  @IsOptional()
  @IsString()
  contentTypeId?: string;

  @IsOptional()
  @IsString()
  levelId?: string;
}

@Controller("v1/search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@Query() query: SearchQuery) {
    const videos = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.LIVE,
        ...(query.q ? { caption: { contains: query.q, mode: "insensitive" } } : {}),
        ...(query.sportId ? { sportId: query.sportId } : {}),
        ...(query.contentTypeId ? { contentTypeId: query.contentTypeId } : {}),
        ...(query.levelId ? { levelId: query.levelId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        counter: true,
        creator: { select: { id: true, displayName: true } },
      },
    });
    return { videos: videos.map(toCard) };
  }

  @Get("related")
  async related(@CurrentUser() user: AuthUser, @Query() query: RelatedQuery) {
    const source = await this.prisma.video.findUnique({ where: { id: query.videoId } });
    if (!source || source.status !== VideoStatus.LIVE) throw new NotFoundException();
    const blocks = await this.prisma.block.findMany({ where: { blockerId: user.id }, select: { blockedId: true } });
    const blockedIds = blocks.map((block) => block.blockedId);
    const candidates = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.LIVE,
        id: { not: source.id },
        ...(blockedIds.length > 0 ? { creatorId: { notIn: blockedIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        counter: true,
        creator: { select: { id: true, displayName: true } },
      },
    });
    const ranked = [...candidates].sort((left, right) => similarity(source, right) - similarity(source, left) || right.createdAt.getTime() - left.createdAt.getTime());
    return { videos: ranked.slice(0, 20).map(toCard) };
  }
}

function similarity(
  source: { sportId: string; contentTypeId: string; levelId: string },
  candidate: { sportId: string; contentTypeId: string; levelId: string },
): number {
  let score = 0;
  if (candidate.sportId === source.sportId) score += 4;
  if (candidate.contentTypeId === source.contentTypeId) score += 2;
  if (candidate.levelId === source.levelId) score += 1;
  return score;
}

function toCard(video: {
  id: string;
  caption: string;
  sportId: string;
  contentTypeId: string;
  levelId: string;
  creator: { id: string; displayName: string };
  counter: { likes: number; saves: number; comments: number } | null;
}) {
  return {
    id: video.id,
    caption: video.caption,
    sportId: video.sportId,
    contentTypeId: video.contentTypeId,
    levelId: video.levelId,
    creator: video.creator,
    counts: video.counter,
  };
}
