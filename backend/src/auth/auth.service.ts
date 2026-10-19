import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { ageBandFromDob } from "../common/age";
import { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "./current-user";
import { RegisterDto } from "./auth.controller";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto) {
    const dateOfBirth = new Date(dto.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.getTime() > Date.now()) {
      throw new ForbiddenException("Date of birth is not valid");
    }
    const ageBand = ageBandFromDob(dateOfBirth);
    if (!ageBand) throw new ForbiddenException("You must be 13 or older");

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ForbiddenException("An account with that email already exists");

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        displayName: dto.displayName.trim(),
        dateOfBirth,
        ageBand,
        profile: { create: {} },
      },
    });
    return this.issue(this.toAuthUser(user));
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("Email or password is wrong");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Email or password is wrong");
    return this.issue(this.toAuthUser(user));
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hash(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row || row.expiresAt.getTime() < Date.now() || row.user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException("Refresh token is not valid");
    }
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issue(this.toAuthUser(row.user));
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: { include: { sports: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      ageBand: user.ageBand,
      role: user.role,
      profile: user.profile
        ? {
            city: user.profile.cityVisible ? user.profile.city : null,
            cityVisible: user.profile.cityVisible,
            goal: user.profile.goal,
            sports: user.profile.sports.map((sport) => ({
              sportId: sport.sportId,
              relation: sport.relation,
              levelId: sport.levelId,
            })),
          }
        : null,
    };
  }

  private async issue(user: AuthUser) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, ageBand: user.ageBand, role: user.role },
      {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
        expiresIn: this.config.get("JWT_ACCESS_TTL", { infer: true }) as `${number}${"s" | "m" | "h" | "d"}`,
      },
    );
    const refreshToken = randomBytes(32).toString("hex");
    const days = this.config.get("JWT_REFRESH_TTL_DAYS", { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, user };
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private toAuthUser(user: { id: string; email: string; displayName: string; ageBand: AuthUser["ageBand"]; role: AuthUser["role"] }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      ageBand: user.ageBand,
      role: user.role,
    };
  }
}
