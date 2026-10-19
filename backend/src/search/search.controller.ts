import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

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
      select: { id: true, caption: true, sportId: true, contentTypeId: true, levelId: true, creatorId: true },
    });
    return { videos };
  }
}
