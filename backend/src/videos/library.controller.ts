import { Controller, Get, Inject, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { AssetRole } from "@prisma/client";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";

const AGE_BANDS = ["AGE_13_15", "AGE_16_17", "AGE_18_PLUS"] as const;

@Controller("v1/me/videos")
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const videos = await this.prisma.video.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        counter: true,
        assets: { where: { role: { in: [AssetRole.THUMB_SM, AssetRole.THUMB_LG] } } },
      },
    });
    const viewsById = new Map<string, number>();
    if (videos.length > 0) {
      const totals = await this.prisma.videoViewDaily.groupBy({
        by: ["videoId"],
        where: { videoId: { in: videos.map((video) => video.id) } },
        _sum: { views: true },
      });
      for (const row of totals) viewsById.set(row.videoId, row._sum.views ?? 0);
    }
    return {
      videos: await Promise.all(
        videos.map(async (video) => {
          const thumb = video.assets.find((asset) => asset.role === AssetRole.THUMB_SM) ?? video.assets[0];
          return {
            id: video.id,
            caption: video.caption,
            status: video.status,
            sportId: video.sportId,
            contentTypeId: video.contentTypeId,
            levelId: video.levelId,
            durationMs: video.durationMs,
            createdAt: video.createdAt,
            views: viewsById.get(video.id) ?? 0,
            counts: {
              likes: video.counter?.likes ?? 0,
              saves: video.counter?.saves ?? 0,
              comments: video.counter?.comments ?? 0,
            },
            thumbUrl: thumb ? await this.storage.presignGet(thumb.objectKey) : null,
          };
        }),
      ),
    };
  }

  @Get(":id/analytics")
  async analytics(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const video = await this.prisma.video.findUnique({ where: { id }, include: { counter: true } });
    if (!video || video.creatorId !== user.id) throw new NotFoundException();
    const rows = await this.prisma.videoViewDaily.findMany({ where: { videoId: id } });
    const today = utcDay();
    const days = Array.from({ length: 14 }, (_, index) => {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - (13 - index));
      const key = day.toISOString().slice(0, 10);
      const views = rows.filter((row) => row.day.toISOString().slice(0, 10) === key).reduce((sum, row) => sum + row.views, 0);
      return { day: key, views };
    });
    const audiences = AGE_BANDS.map((ageBand) => ({
      ageBand,
      views: rows.filter((row) => row.ageBand === ageBand).reduce((sum, row) => sum + row.views, 0),
    }));
    return {
      id: video.id,
      caption: video.caption,
      status: video.status,
      totals: {
        views: audiences.reduce((sum, row) => sum + row.views, 0),
        likes: video.counter?.likes ?? 0,
        saves: video.counter?.saves ?? 0,
        comments: video.counter?.comments ?? 0,
      },
      days,
      audiences,
    };
  }
}

function utcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
