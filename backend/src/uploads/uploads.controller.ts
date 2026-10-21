import { BadRequestException, Body, Controller, Inject, Logger, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { AssetRole, VideoStatus } from "@prisma/client";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { assertVideoTransition } from "../common/video-status";
import { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import { CompleteUploadDto, CONTENT_TYPES, OPEN_OWNER_STATUSES, UploadUrlsDto } from "../videos/video.dto";
import { INGEST_QUEUE } from "../ingest/ingest.constants";

@Controller("v1/videos")
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @InjectQueue(INGEST_QUEUE) private readonly queue: Queue,
  ) {}

  @Post(":id/upload-urls")
  async uploadUrls(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UploadUrlsDto) {
    const video = await this.owned(user.id, id);
    if (!OPEN_OWNER_STATUSES.includes(video.status)) {
      throw new BadRequestException("This video is no longer accepting uploads");
    }
    for (const asset of dto.assets) {
      if (!CONTENT_TYPES[asset.role].includes(asset.contentType)) {
        throw new BadRequestException(`${asset.role} does not accept ${asset.contentType}`);
      }
    }
    const singles = dto.assets.filter((asset) => asset.role !== AssetRole.SEGMENT);
    const uniqueRoles = new Set(singles.map((asset) => asset.role));
    if (uniqueRoles.size !== singles.length) throw new BadRequestException("Only segments can be repeated");

    if (video.status === VideoStatus.DRAFT) assertVideoTransition(VideoStatus.DRAFT, VideoStatus.UPLOADING);
    await this.prisma.mediaAsset.deleteMany({ where: { videoId: id } });
    const created = [];
    for (const asset of dto.assets) {
      const ext = extensionFor(asset.contentType);
      const objectKey = `videos/${id}/${asset.role.toLowerCase()}/${randomUUID()}${ext}`;
      const row = await this.prisma.mediaAsset.create({
        data: { videoId: id, role: asset.role, objectKey, contentType: asset.contentType },
      });
      created.push({
        role: row.role,
        key: row.objectKey,
        url: await this.storage.presignPut(row.objectKey, asset.contentType),
      });
    }
    await this.prisma.video.update({ where: { id }, data: { status: VideoStatus.UPLOADING } });
    this.logger.log(`Issued ${created.length} upload URLs for ${id}: ${created.map((asset) => asset.role).join(", ")}`);
    return { assets: created };
  }

  @Post(":id/complete")
  async complete(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CompleteUploadDto) {
    const video = await this.owned(user.id, id);
    if (video.status !== VideoStatus.UPLOADING) throw new BadRequestException("Upload URLs have not been issued");
    const issued = await this.prisma.mediaAsset.findMany({ where: { videoId: id } });
    const byKey = new Map(issued.map((asset) => [asset.objectKey, asset]));
    if (dto.assets.length !== issued.length) throw new BadRequestException("Complete must include every issued file");
    for (const asset of dto.assets) {
      const row = byKey.get(asset.key);
      if (!row || row.role !== asset.role) throw new BadRequestException("Unknown asset key");
      if (!asset.key.startsWith(`videos/${id}/`)) throw new BadRequestException("Asset key is outside this video");
    }

    assertVideoTransition(VideoStatus.UPLOADING, VideoStatus.UPLOADED);
    const allowFixture = this.config.get("NODE_ENV", { infer: true }) !== "production";
    await this.prisma.$transaction([
      ...dto.assets.map((asset) =>
        this.prisma.mediaAsset.update({ where: { videoId_objectKey: { videoId: id, objectKey: asset.key } }, data: { etag: asset.etag } }),
      ),
      this.prisma.video.update({
        data: {
          status: VideoStatus.UPLOADED,
          durationMs: dto.durationMs,
          ingestHint: allowFixture ? (dto.fixture ?? null) : null,
        },
        where: { id },
      }),
    ]);
    let queued = true;
    try {
      await Promise.race([
        this.queue.add("check", { videoId: id }, { jobId: id, removeOnComplete: true, attempts: 3 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Job queue did not answer within 5s")), 5_000)),
      ]);
      this.logger.log(`Video ${id} uploaded and queued for checks`);
    } catch (error) {
      queued = false;
      const message = error instanceof Error ? error.message : "unknown queue error";
      this.logger.warn(`Video ${id} is saved as UPLOADED, but the check was not queued: ${message}`);
    }
    return { id, status: VideoStatus.UPLOADED, queued };
  }

  private async owned(userId: string, id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video || video.creatorId !== userId) throw new NotFoundException();
    return video;
  }
}

function extensionFor(contentType: string): string {
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "video/mp4") return ".mp4";
  return ".m3u8";
}
