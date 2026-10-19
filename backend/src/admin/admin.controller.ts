import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CaseAction, CaseStatus, StaffRole, VideoStatus } from "@prisma/client";
import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";
import { AuthService } from "../auth/auth.service";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { assertVideoTransition } from "../common/video-status";
import { PrismaService } from "../prisma/prisma.service";

class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class DecisionDto {
  @IsEnum(CaseAction)
  action!: CaseAction;

  @IsString()
  @MinLength(3)
  reason!: string;
}

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("auth/login")
  async login(@Body() dto: AdminLoginDto) {
    const session = await this.auth.login(dto.email, dto.password);
    if (session.user.role === StaffRole.USER) {
      throw new BadRequestException("This login is for staff");
    }
    return session;
  }

  @Get("queue")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async queue() {
    const cases = await this.prisma.moderationCase.findMany({
      where: { status: CaseStatus.OPEN },
      orderBy: { createdAt: "asc" },
      include: {
        video: { select: { id: true, caption: true, status: true, creator: { select: { id: true, ageBand: true, displayName: true } } } },
        reports: { select: { id: true, reason: true, createdAt: true } },
      },
    });
    return { cases };
  }

  @Post("cases/:id/decision")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async decide(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: DecisionDto) {
    const moderationCase = await this.prisma.moderationCase.findUnique({ where: { id }, include: { video: true } });
    if (!moderationCase || moderationCase.status !== CaseStatus.OPEN) throw new BadRequestException("Case is not open");

    const next = dto.action === CaseAction.REMOVE ? VideoStatus.REMOVED : dto.action === CaseAction.APPROVE ? VideoStatus.LIVE : VideoStatus.HELD;
    if (moderationCase.video.status !== next) {
      assertVideoTransition(moderationCase.video.status, next);
      await this.prisma.video.update({ where: { id: moderationCase.videoId }, data: { status: next } });
    }
    await this.prisma.moderationCase.update({
      where: { id },
      data: {
        status: dto.action === CaseAction.HOLD ? CaseStatus.OPEN : CaseStatus.RESOLVED,
        decision: dto.action,
        reviewerId: user.id,
        resolvedAt: dto.action === CaseAction.HOLD ? null : new Date(),
        reason: dto.reason,
      },
    });
    await this.prisma.auditEntry.create({
      data: { actorId: user.id, action: dto.action, targetId: moderationCase.videoId, reason: dto.reason },
    });
    return { ok: true, status: next };
  }
}
