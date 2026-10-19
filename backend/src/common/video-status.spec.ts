import { BadRequestException } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { assertVideoTransition } from "./video-status";

describe("assertVideoTransition", () => {
  it("allows the publish path", () => {
    expect(() => assertVideoTransition(VideoStatus.DRAFT, VideoStatus.UPLOADING)).not.toThrow();
    expect(() => assertVideoTransition(VideoStatus.CHECKING, VideoStatus.LIVE)).not.toThrow();
    expect(() => assertVideoTransition(VideoStatus.CHECKING, VideoStatus.HELD)).not.toThrow();
  });

  it("rejects a skip from draft to live", () => {
    expect(() => assertVideoTransition(VideoStatus.DRAFT, VideoStatus.LIVE)).toThrow(BadRequestException);
  });
});
