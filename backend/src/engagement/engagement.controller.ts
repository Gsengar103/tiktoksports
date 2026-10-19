import { BadRequestException, Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AgeBand, VideoStatus } from "@prisma/client";
import { IsString, MaxLength, MinLength } from "class-validator";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
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

  @Post("videos/:id/comments")
  async comment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CommentDto) {
    await this.liveVideo(id);
    const limit = user.ageBand === AgeBand.AGE_18_PLUS ? 1000 : 280;
    if (dto.body.length > limit) throw new BadRequestException(`Comments are limited to ${limit} characters`);
    const comment = await this.prisma.comment.create({ data: { userId: user.id, videoId: id, body: dto.body } });
    await this.prisma.videoCounter.update({ where: { videoId: id }, data: { comments: { increment: 1 } } });
    return { id: comment.id };
  }

  @Post("users/:id/follows")
  async follow(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    if (id === user.id) throw new BadRequestException("You cannot follow yourself");
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException("User not found");
    await this.prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: user.id, followeeId: id } },
      create: { followerId: user.id, followeeId: id },
      update: {},
    });
    return { following: true };
  }

  private async liveVideo(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video || video.status !== VideoStatus.LIVE) throw new BadRequestException("Video is not available");
    return video;
  }
}
