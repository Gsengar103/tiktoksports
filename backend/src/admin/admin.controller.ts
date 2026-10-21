import { BadRequestException, Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AccountStatus, AssetRole, CaseAction, CaseStatus, StaffRole, VideoStatus } from "@prisma/client";
import { IsEmail, IsEnum, IsIn, IsString, MinLength } from "class-validator";
import { AuthService } from "../auth/auth.service";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { assertVideoTransition } from "../common/video-status";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";

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

class AccountStatusDto {
  @IsIn([AccountStatus.ACTIVE, AccountStatus.SUSPENDED])
  status!: AccountStatus;

  @IsString()
  @MinLength(3)
  reason!: string;
}

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
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
        video: {
          select: {
            id: true,
            caption: true,
            status: true,
            durationMs: true,
            sportId: true,
            creator: { select: { id: true, ageBand: true, displayName: true } },
            assets: { select: { role: true, objectKey: true } },
          },
        },
        reports: { select: { id: true, reason: true, createdAt: true } },
      },
    });
    return {
      cases: await Promise.all(
        cases.map(async (item) => ({
          id: item.id,
          videoId: item.videoId,
          status: item.status,
          reason: item.reason,
          createdAt: item.createdAt,
          reports: item.reports,
          video: {
            id: item.video.id,
            caption: item.video.caption,
            status: item.video.status,
            durationMs: item.video.durationMs,
            sportId: item.video.sportId,
            creator: item.video.creator,
          },
          assets: await Promise.all(
            item.video.assets
              .filter((asset) => asset.role !== AssetRole.SEGMENT)
              .map(async (asset) => ({ role: asset.role, url: await this.storage.presignGet(asset.objectKey) })),
          ),
        })),
      ),
    };
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

  @Get("overview")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async overview() {
    const [videos, needsReview, reports, people] = await Promise.all([
      this.prisma.video.count(),
      this.prisma.video.count({ where: { status: { in: [VideoStatus.UPLOADED, VideoStatus.CHECKING, VideoStatus.HELD] } } }),
      this.prisma.report.count(),
      this.prisma.user.count({ where: { status: { not: AccountStatus.DELETED } } }),
    ]);
    return { videos, needsReview, reports, people };
  }

  @Get("videos")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async videos() {
    const videos = await this.prisma.video.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        counter: true,
        creator: { select: { id: true, displayName: true, ageBand: true } },
        assets: { select: { role: true, objectKey: true } },
        _count: { select: { reports: true } },
      },
    });
    return {
      videos: await Promise.all(
        videos.map(async (video) => ({
          id: video.id,
          caption: video.caption,
          status: video.status,
          sportId: video.sportId,
          durationMs: video.durationMs,
          createdAt: video.createdAt,
          creator: video.creator,
          reports: video._count.reports,
          counts: {
            likes: video.counter?.likes ?? 0,
            saves: video.counter?.saves ?? 0,
            comments: video.counter?.comments ?? 0,
          },
          assets: await Promise.all(
            video.assets
              .filter((asset) => asset.role !== AssetRole.SEGMENT)
              .map(async (asset) => ({ role: asset.role, url: await this.storage.presignGet(asset.objectKey) })),
          ),
        })),
      ),
    };
  }

  @Post("videos/:id/decision")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async decideVideo(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: DecisionDto) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) throw new BadRequestException("Video not found");
    const next = dto.action === CaseAction.REMOVE ? VideoStatus.REMOVED : dto.action === CaseAction.APPROVE ? VideoStatus.LIVE : VideoStatus.HELD;
    if (video.status !== next) {
      assertVideoTransition(video.status, next);
      await this.prisma.video.update({ where: { id }, data: { status: next } });
    }
    const open = await this.prisma.moderationCase.findFirst({ where: { videoId: id, status: CaseStatus.OPEN } });
    if (dto.action === CaseAction.HOLD) {
      if (open) {
        await this.prisma.moderationCase.update({
          where: { id: open.id },
          data: { reason: dto.reason, reviewerId: user.id, decision: CaseAction.HOLD },
        });
      } else {
        await this.prisma.moderationCase.create({
          data: { videoId: id, reason: dto.reason, status: CaseStatus.OPEN, reviewerId: user.id, decision: CaseAction.HOLD },
        });
      }
    } else if (open) {
      await this.prisma.moderationCase.update({
        where: { id: open.id },
        data: { status: CaseStatus.RESOLVED, decision: dto.action, reviewerId: user.id, resolvedAt: new Date(), reason: dto.reason },
      });
    }
    await this.prisma.auditEntry.create({
      data: { actorId: user.id, action: dto.action, targetId: id, reason: dto.reason },
    });
    return { ok: true, status: next };
  }

  @Get("reports")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async reports() {
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { video: { select: { id: true, caption: true, status: true } } },
    });
    return {
      reports: reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        createdAt: report.createdAt,
        video: report.video
          ? { id: report.video.id, caption: report.video.caption, status: report.video.status }
          : null,
      })),
    };
  }

  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async users() {
    const users = await this.prisma.user.findMany({
      where: { status: { not: AccountStatus.DELETED } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        displayName: true,
        ageBand: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { videos: true } },
      },
    });
    return {
      users: users.map((person) => ({
        id: person.id,
        email: person.email,
        displayName: person.displayName,
        ageBand: person.ageBand,
        role: person.role,
        status: person.status,
        createdAt: person.createdAt,
        videos: person._count.videos,
      })),
    };
  }

  @Post("users/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async setStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AccountStatusDto) {
    if (id === user.id) throw new BadRequestException("You cannot change your own account");
    const person = await this.prisma.user.findUnique({ where: { id } });
    if (!person || person.status === AccountStatus.DELETED) throw new BadRequestException("Account not found");
    await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    await this.prisma.auditEntry.create({
      data: { actorId: user.id, action: dto.status, targetId: id, reason: dto.reason },
    });
    return { ok: true, status: dto.status };
  }

  @Get("audit")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.MODERATOR, StaffRole.SUPER_ADMIN)
  async audit() {
    const entries = await this.prisma.auditEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { displayName: true } } },
    });
    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        reason: entry.reason,
        targetId: entry.targetId,
        createdAt: entry.createdAt,
        actor: entry.actor.displayName,
      })),
    };
  }
}
