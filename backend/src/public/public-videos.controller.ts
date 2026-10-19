import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";

@Controller("v1/public/videos")
export class PublicVideosController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get(":id")
  async get(@Param("id") id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        assets: true,
        sport: true,
        contentType: true,
        level: true,
        creator: { select: { id: true, displayName: true } },
      },
    });
    if (!video || video.status !== VideoStatus.LIVE) throw new NotFoundException();
    const assets = await Promise.all(
      video.assets
        .filter((asset) => asset.role !== "SEGMENT")
        .map(async (asset) => ({ role: asset.role, url: await this.storage.presignGet(asset.objectKey) })),
    );
    return {
      id: video.id,
      caption: video.caption,
      durationMs: video.durationMs,
      sport: video.sport,
      contentType: video.contentType,
      level: video.level,
      creator: video.creator,
      assets,
    };
  }
}
