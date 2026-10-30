import { BadRequestException, Body, Controller, Delete, Inject, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Goal, PlayFrequency, ProfileKind, ProfilePhotoRole, SportRelation } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { randomUUID } from "crypto";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";

const AGE_GROUPS = ["AGE_13_15", "AGE_16_17", "AGE_18_PLUS"] as const;
const BATCHES = ["MORNING", "EVENING", "WEEKEND"] as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

class SportChoiceDto {
  @IsString()
  sportId!: string;

  @IsEnum(SportRelation)
  relation!: SportRelation;

  @IsOptional()
  @IsString()
  levelId?: string;
}

class ProfileDto {
  @IsEnum(ProfileKind)
  kind!: ProfileKind;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @IsBoolean()
  cityVisible!: boolean;

  @IsEnum(Goal)
  goal!: Goal;

  @IsEnum(PlayFrequency)
  playFrequency!: PlayFrequency;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  aboutPlay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  academyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  groundName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  establishedYear?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  trialNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  coachesWhat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  qualification?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsCoaching?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  achievements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  about?: string;

  @IsArray()
  @IsIn(AGE_GROUPS, { each: true })
  ageGroups!: string[];

  @IsArray()
  @IsIn(BATCHES, { each: true })
  batches!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SportChoiceDto)
  sports!: SportChoiceDto[];
}

class PhotoDto {
  @IsEnum(ProfilePhotoRole)
  role!: ProfilePhotoRole;

  @IsString()
  @IsIn(IMAGE_TYPES)
  contentType!: string;
}

@Controller("v1/me/profile")
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Put()
  async save(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    const sportIds = [...new Set(dto.sports.map((sport) => sport.sportId))];
    const found = await this.prisma.sport.findMany({ where: { id: { in: sportIds } } });
    if (found.length !== sportIds.length) throw new BadRequestException("Unknown sport");
    if (dto.kind === ProfileKind.ACADEMY && !dto.academyName?.trim()) {
      throw new BadRequestException("An academy needs a name");
    }

    const details = profileDetails(dto);
    await this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...details },
      update: details,
    });
    await this.prisma.profileSport.deleteMany({ where: { profileId: user.id } });
    if (dto.sports.length > 0) {
      await this.prisma.profileSport.createMany({
        data: dto.sports.map((sport) => ({
          profileId: user.id,
          sportId: sport.sportId,
          relation: sport.relation,
          levelId: sport.levelId,
        })),
      });
    }
    const allowed = photoRoles(dto.kind);
    if (allowed.length === 0) {
      await this.prisma.profilePhoto.deleteMany({ where: { profileId: user.id } });
    } else {
      await this.prisma.profilePhoto.deleteMany({ where: { profileId: user.id, role: { notIn: allowed } } });
      await this.trimGallery(user.id, dto.kind === ProfileKind.ACADEMY ? 8 : 4);
    }
    return { ok: true };
  }

  @Post("photos")
  async addPhoto(@CurrentUser() user: AuthUser, @Body() dto: PhotoDto) {
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id }, include: { photos: true } });
    if (!profile) throw new BadRequestException("Save your profile first");
    if (!photoRoles(profile.kind).includes(dto.role)) throw new BadRequestException("This profile does not use that picture");
    if (dto.role === ProfilePhotoRole.GALLERY) {
      const count = profile.photos.filter((photo) => photo.role === ProfilePhotoRole.GALLERY).length;
      const limit = profile.kind === ProfileKind.ACADEMY ? 8 : 4;
      if (count >= limit) throw new BadRequestException(`You can add ${limit} photos`);
    } else {
      await this.prisma.profilePhoto.deleteMany({ where: { profileId: user.id, role: dto.role } });
    }
    const objectKey = `profiles/${user.id}/${dto.role.toLowerCase()}/${randomUUID()}${extensionFor(dto.contentType)}`;
    const row = await this.prisma.profilePhoto.create({
      data: { profileId: user.id, role: dto.role, objectKey, contentType: dto.contentType },
    });
    return { id: row.id, uploadUrl: await this.storage.presignPut(objectKey, dto.contentType) };
  }

  @Delete("photos/:id")
  async removePhoto(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const photo = await this.prisma.profilePhoto.findFirst({ where: { id, profileId: user.id } });
    if (!photo) throw new BadRequestException("Photo not found");
    await this.prisma.profilePhoto.delete({ where: { id } });
    return { ok: true };
  }

  private async trimGallery(userId: string, limit: number) {
    const photos = await this.prisma.profilePhoto.findMany({
      where: { profileId: userId, role: ProfilePhotoRole.GALLERY },
      orderBy: { createdAt: "asc" },
    });
    const extra = photos.slice(0, Math.max(0, photos.length - limit));
    if (extra.length === 0) return;
    await this.prisma.profilePhoto.deleteMany({ where: { id: { in: extra.map((photo) => photo.id) } } });
  }
}

function photoRoles(kind: ProfileKind): ProfilePhotoRole[] {
  if (kind === ProfileKind.COACH) return [ProfilePhotoRole.PORTRAIT, ProfilePhotoRole.GALLERY];
  if (kind === ProfileKind.ACADEMY) return [ProfilePhotoRole.LOGO, ProfilePhotoRole.COVER, ProfilePhotoRole.GALLERY];
  return [];
}

function profileDetails(dto: ProfileDto): ProfileDetails {
  const player = dto.kind === ProfileKind.PLAYER;
  const coach = dto.kind === ProfileKind.COACH;
  const academy = dto.kind === ProfileKind.ACADEMY;
  return {
    kind: dto.kind,
    city: blankToNull(dto.city),
    area: blankToNull(dto.area),
    cityVisible: dto.cityVisible,
    goal: player ? dto.goal : Goal.WATCH,
    playFrequency: player ? dto.playFrequency : PlayFrequency.WATCH_ONLY,
    aboutPlay: player ? blankToNull(dto.aboutPlay) : null,
    academyName: player ? null : blankToNull(dto.academyName),
    linkUrl: player ? null : cleanLink(dto.linkUrl),
    groundName: academy ? blankToNull(dto.groundName) : null,
    establishedYear: academy ? (dto.establishedYear ?? null) : null,
    trialNote: academy ? blankToNull(dto.trialNote) : null,
    coachesWhat: player ? null : blankToNull(dto.coachesWhat),
    qualification: coach ? blankToNull(dto.qualification) : null,
    yearsCoaching: coach ? (dto.yearsCoaching ?? null) : null,
    achievements: player ? null : blankToNull(dto.achievements),
    about: player ? null : blankToNull(dto.about),
    ageGroups: player ? [] : [...new Set(dto.ageGroups)],
    batches: player ? [] : [...new Set(dto.batches)],
  };
}

type ProfileDetails = {
  kind: ProfileKind;
  city: string | null;
  area: string | null;
  cityVisible: boolean;
  goal: Goal;
  playFrequency: PlayFrequency;
  aboutPlay: string | null;
  academyName: string | null;
  linkUrl: string | null;
  groundName: string | null;
  establishedYear: number | null;
  trialNote: string | null;
  coachesWhat: string | null;
  qualification: string | null;
  yearsCoaching: number | null;
  achievements: string | null;
  about: string | null;
  ageGroups: string[];
  batches: string[];
};

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function cleanLink(value: string | undefined): string | null {
  const trimmed = blankToNull(value);
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BadRequestException("Link must be a web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("Link must start with http or https");
  }
  return url.toString();
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return ".jpg";
}
