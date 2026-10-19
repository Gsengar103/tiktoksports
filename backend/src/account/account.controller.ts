import { Controller, Delete, HttpCode, UseGuards } from "@nestjs/common";
import { AccountStatus, VideoStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { AuthUser, CurrentUser } from "../auth/current-user";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("v1/me")
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly prisma: PrismaService) {}

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.video.updateMany({ where: { creatorId: user.id }, data: { status: VideoStatus.REMOVED } }),
      this.prisma.comment.deleteMany({ where: { userId: user.id } }),
      this.prisma.like.deleteMany({ where: { userId: user.id } }),
      this.prisma.save.deleteMany({ where: { userId: user.id } }),
      this.prisma.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followeeId: user.id }] } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: AccountStatus.DELETED,
          email: `deleted+${user.id}@invalid.local`,
          displayName: "Deleted",
          passwordHash: randomBytes(16).toString("hex"),
        },
      }),
    ]);
  }
}
