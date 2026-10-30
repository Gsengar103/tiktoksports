import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { AgeBand, VideoStatus } from "@prisma/client";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}

class ViewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  watchId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4 * 60 * 60 * 1000)
  durationMs?: number;
}

@Controller("v1")
@UseGuards(JwtAuthGuard)
export class EngagementController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("videos/:id/likes")
  async like(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.liveVideo(id);
    const existing = await this.prisma.like.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.like.delete({ where: { userId_videoId: { userId: user.id, videoId: id } } }),
        this.prisma.videoCounter.update({ where: { videoId: id }, data: { likes: { decrement: 1 } } }),
      ]);
      return { liked: false };
    }
    await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId: user.id, videoId: id } }),
      this.prisma.videoCounter.update({ where: { videoId: id }, data: { likes: { increment: 1 } } }),
    ]);
    return { liked: true };
  }

  @Post("videos/:id/saves")
  async save(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.liveVideo(id);
    const existing = await this.prisma.save.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.save.delete({ where: { userId_videoId: { userId: user.id, videoId: id } } }),
        this.prisma.videoCounter.update({ where: { videoId: id }, data: { saves: { decrement: 1 } } }),
      ]);
      return { saved: false };
    }
    await this.prisma.$transaction([
      this.prisma.save.create({ data: { userId: user.id, videoId: id } }),
      this.prisma.videoCounter.update({ where: { videoId: id }, data: { saves: { increment: 1 } } }),
    ]);
    return { saved: true };
  }

  @Get("videos/:id/comments")
  async comments(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.liveVideo(id);
    const [comments, like] = await Promise.all([
      this.prisma.comment.findMany({
        where: { videoId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, displayName: true } } },
      }),
      this.prisma.like.findUnique({ where: { userId_videoId: { userId: user.id, videoId: id } } }),
    ]);
    return {
      liked: like != null,
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: comment.user,
      })),
    };
  }

  @Post("videos/:id/comments")
  async comment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CommentDto) {
    await this.liveVideo(id);
    const limit = user.ageBand === AgeBand.AGE_18_PLUS ? 1000 : 280;
    if (dto.body.length > limit) throw new BadRequestException(`Comments are limited to ${limit} characters`);
    const comment = await this.prisma.comment.create({ data: { userId: user.id, videoId: id, body: dto.body } });
    await this.prisma.videoCounter.update({ where: { videoId: id }, data: { comments: { increment: 1 } } });
    return { id: comment.id };
  }

  @Post("videos/:id/views")
  async view(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ViewDto) {
    const video = await this.liveVideo(id);
    const durationMs = dto.durationMs ?? 0;
    if (dto.watchId) {
      const existing = await this.prisma.videoWatch.findFirst({ where: { id: dto.watchId, userId: user.id, videoId: id } });
      if (!existing) throw new NotFoundException();
      const watch = await this.prisma.videoWatch.update({
        where: { id: existing.id },
        data: { durationMs: Math.max(existing.durationMs, durationMs) },
      });
      return { watchId: watch.id, durationMs: watch.durationMs, counted: video.creatorId !== user.id };
    }
    const watch = await this.prisma.videoWatch.create({
      data: {
        userId: user.id,
        videoId: id,
        ageBand: user.ageBand,
        videoDurationMs: video.durationMs,
        durationMs,
      },
    });
    if (video.creatorId !== user.id) {
      const now = new Date();
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      await this.prisma.videoViewDaily.upsert({
        where: { videoId_day_ageBand: { videoId: id, day, ageBand: user.ageBand } },
        create: { videoId: id, day, ageBand: user.ageBand, views: 1 },
        update: { views: { increment: 1 } },
      });
    }
    return { watchId: watch.id, durationMs: watch.durationMs, counted: video.creatorId !== user.id };
  }

  @Post("users/:id/follows")
  async follow(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    if (id === user.id) throw new BadRequestException("You cannot follow yourself");
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException("User not found");
    const where = { followerId_followeeId: { followerId: user.id, followeeId: id } };
    const existing = await this.prisma.follow.findUnique({ where });
    if (existing) {
      await this.prisma.follow.delete({ where });
      return { following: false };
    }
    await this.prisma.follow.create({ data: { followerId: user.id, followeeId: id } });
    return { following: true };
  }

  private async liveVideo(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video || video.status !== VideoStatus.LIVE) throw new BadRequestException("Video is not available");
    return video;
  }
}
