import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CaseStatus, VideoStatus } from "@prisma/client";
import { IsString, MinLength } from "class-validator";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

class ReportDto {
  @IsString()
  videoId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

class BlockDto {
  @IsString()
  userId!: string;
}

@Controller("v1")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("reports")
  async report(@CurrentUser() user: AuthUser, @Body() dto: ReportDto) {
    const video = await this.prisma.video.findUnique({ where: { id: dto.videoId } });
    if (!video || video.status === VideoStatus.REMOVED) throw new BadRequestException("Video is not available");
    const existing = await this.prisma.moderationCase.findFirst({ where: { videoId: dto.videoId, status: CaseStatus.OPEN } });
    const moderationCase =
      existing ??
      (await this.prisma.moderationCase.create({
        data: { videoId: dto.videoId, reason: dto.reason, status: CaseStatus.OPEN },
      }));
    const report = await this.prisma.report.create({
      data: { reporterId: user.id, videoId: dto.videoId, reason: dto.reason, caseId: moderationCase.id },
    });
    return { id: report.id, caseId: moderationCase.id };
  }

  @Post("blocks")
  async block(@CurrentUser() user: AuthUser, @Body() dto: BlockDto) {
    if (dto.userId === user.id) throw new BadRequestException("You cannot block yourself");
    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: dto.userId } },
      create: { blockerId: user.id, blockedId: dto.userId },
      update: {},
    });
    return { blocked: true };
  }
}
