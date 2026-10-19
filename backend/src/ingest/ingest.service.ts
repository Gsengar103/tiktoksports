import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AssetRole, CaseStatus, VideoStatus } from "@prisma/client";
import { StubFrameMatcher, StubScreener } from "../common/checks";
import { assertVideoTransition } from "../common/video-status";
import { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { packageProblems } from "../videos/video.dto";

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly matcher = new StubFrameMatcher();
  private readonly screener = new StubScreener();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async run(videoId: string): Promise<void> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId }, include: { assets: true } });
    if (!video || video.status === VideoStatus.LIVE || video.status === VideoStatus.REMOVED) return;
    if (video.status !== VideoStatus.UPLOADED && video.status !== VideoStatus.CHECKING) return;

    if (video.status === VideoStatus.UPLOADED) {
      assertVideoTransition(VideoStatus.UPLOADED, VideoStatus.CHECKING);
      await this.prisma.video.update({ where: { id: videoId }, data: { status: VideoStatus.CHECKING } });
    }

    const problem = packageProblems(
      video.assets.map((asset) => asset.role),
      video.durationMs,
    );
    if (problem) {
      await this.finish(videoId, VideoStatus.CHECKING, VideoStatus.REJECTED, problem);
      return;
    }

    if (this.config.get("AUTO_APPROVE", { infer: true })) {
      await this.finish(videoId, VideoStatus.CHECKING, VideoStatus.LIVE, "auto-approve");
      return;
    }

    const matched = this.matcher.match(video.ingestHint);
    if (!matched.matched) {
      await this.hold(videoId, "frame-mismatch");
      return;
    }
    const screen = this.screener.screen(video.caption);
    if (screen.hold) {
      await this.hold(videoId, screen.reason ?? "screening");
      return;
    }
    await this.finish(videoId, VideoStatus.CHECKING, VideoStatus.LIVE, "checks-passed");
    this.logger.log(`Video ${videoId} is live`);
  }

  private async hold(videoId: string, reason: string) {
    await this.finish(videoId, VideoStatus.CHECKING, VideoStatus.HELD, reason);
    const open = await this.prisma.moderationCase.findFirst({ where: { videoId, status: CaseStatus.OPEN } });
    if (!open) {
      await this.prisma.moderationCase.create({ data: { videoId, reason, status: CaseStatus.OPEN } });
    }
  }

  private async finish(videoId: string, from: VideoStatus, to: VideoStatus, reason: string) {
    assertVideoTransition(from, to);
    await this.prisma.video.update({ where: { id: videoId }, data: { status: to } });
    this.logger.log(`${videoId} ${from} -> ${to} (${reason})`);
  }
}

export function hasPlayableFile(roles: AssetRole[]): boolean {
  return roles.includes(AssetRole.PLAYLIST) || roles.includes(AssetRole.PROGRESSIVE);
}
