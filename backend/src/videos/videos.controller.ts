import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVideoDto } from "./video.dto";

@Controller("v1/videos")
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateVideoDto) {
    const [sport, contentType, level] = await Promise.all([
      this.prisma.sport.findUnique({ where: { id: dto.sportId } }),
      this.prisma.contentType.findUnique({ where: { id: dto.contentTypeId } }),
      this.prisma.level.findUnique({ where: { id: dto.levelId } }),
    ]);
    if (!sport || !contentType || !level) throw new BadRequestException("Unknown sport, content type, or level");

    const video = await this.prisma.video.create({
      data: {
        creatorId: user.id,
        caption: dto.caption,
        sportId: dto.sportId,
        contentTypeId: dto.contentTypeId,
        levelId: dto.levelId,
        durationMs: dto.durationMs,
        status: VideoStatus.DRAFT,
        counter: { create: {} },
      },
    });
    return { id: video.id, status: video.status };
  }

  @Get(":id")
  async get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { counter: true, sport: true, contentType: true, level: true },
    });
    if (!video) throw new NotFoundException();
    if (video.status !== VideoStatus.LIVE && video.creatorId !== user.id) throw new NotFoundException();
    return {
      id: video.id,
      caption: video.caption,
      status: video.status,
      durationMs: video.durationMs,
      sportId: video.sportId,
      contentTypeId: video.contentTypeId,
      levelId: video.levelId,
      creatorId: video.creatorId,
      counts: video.counter,
    };
  }
}
