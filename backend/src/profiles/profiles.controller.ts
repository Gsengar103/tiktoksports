import { BadRequestException, Body, Controller, Put, UseGuards } from "@nestjs/common";
import { Goal, SportRelation } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

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
  @IsOptional()
  @IsString()
  city?: string;

  @IsBoolean()
  cityVisible!: boolean;

  @IsEnum(Goal)
  goal!: Goal;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SportChoiceDto)
  sports!: SportChoiceDto[];
}

@Controller("v1/me/profile")
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Put()
  async save(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    const sportIds = [...new Set(dto.sports.map((sport) => sport.sportId))];
    const found = await this.prisma.sport.findMany({ where: { id: { in: sportIds } } });
    if (found.length !== sportIds.length) throw new BadRequestException("Unknown sport");

    await this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, city: dto.city, cityVisible: dto.cityVisible, goal: dto.goal },
      update: { city: dto.city, cityVisible: dto.cityVisible, goal: dto.goal },
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
    return { ok: true };
  }
}
