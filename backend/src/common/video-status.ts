import { BadRequestException } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";

const ALLOWED: Record<VideoStatus, VideoStatus[]> = {
  DRAFT: [VideoStatus.UPLOADING],
  UPLOADING: [VideoStatus.UPLOADED],
  UPLOADED: [VideoStatus.CHECKING],
  CHECKING: [VideoStatus.LIVE, VideoStatus.HELD, VideoStatus.REJECTED],
  HELD: [VideoStatus.LIVE, VideoStatus.REMOVED],
  LIVE: [VideoStatus.REMOVED, VideoStatus.HELD],
  REJECTED: [VideoStatus.REMOVED],
  REMOVED: [],
};

export function assertVideoTransition(from: VideoStatus, to: VideoStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new BadRequestException(`Cannot move a video from ${from} to ${to}`);
  }
}
