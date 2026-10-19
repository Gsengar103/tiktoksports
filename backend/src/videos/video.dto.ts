import { AssetRole, VideoStatus } from "@prisma/client";
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateVideoDto {
  @IsString()
  @MaxLength(500)
  caption!: string;

  @IsString()
  sportId!: string;

  @IsString()
  contentTypeId!: string;

  @IsString()
  levelId!: string;

  @IsInt()
  @Min(1)
  @Max(60_000)
  durationMs!: number;
}

export class AssetRequestDto {
  @IsEnum(AssetRole)
  role!: AssetRole;

  @IsString()
  @MinLength(3)
  contentType!: string;
}

export class UploadUrlsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetRequestDto)
  assets!: AssetRequestDto[];
}

export class CompletedAssetDto {
  @IsEnum(AssetRole)
  role!: AssetRole;

  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  etag?: string;
}

export class CompleteUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedAssetDto)
  assets!: CompletedAssetDto[];

  @IsInt()
  @Min(1)
  @Max(60_000)
  durationMs!: number;

  @IsOptional()
  @IsIn(["clean", "mismatch"])
  fixture?: "clean" | "mismatch";
}

export const CONTENT_TYPES: Record<AssetRole, string[]> = {
  THUMB_SM: ["image/webp", "image/jpeg"],
  THUMB_LG: ["image/webp", "image/jpeg"],
  PREVIEW: ["video/mp4"],
  PLAYLIST: ["application/vnd.apple.mpegurl", "application/x-mpegURL"],
  PROGRESSIVE: ["video/mp4"],
  SEGMENT: ["video/mp4"],
};

export const REQUIRED_ONE_OF: AssetRole[][] = [
  [AssetRole.THUMB_SM],
  [AssetRole.THUMB_LG],
  [AssetRole.PREVIEW],
  [AssetRole.PLAYLIST, AssetRole.PROGRESSIVE],
];

export function packageProblems(roles: AssetRole[], durationMs: number): string | null {
  if (durationMs < 1 || durationMs > 60_000) return "Duration must be between 1 ms and 60 seconds";
  for (const group of REQUIRED_ONE_OF) {
    if (!group.some((role) => roles.includes(role))) return `Package is missing ${group.join(" or ")}`;
  }
  return null;
}

export const OPEN_OWNER_STATUSES: VideoStatus[] = [VideoStatus.DRAFT, VideoStatus.UPLOADING];
