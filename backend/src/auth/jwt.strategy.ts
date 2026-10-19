import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { AccountStatus, StaffRole } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "./current-user";

type Payload = { sub: string; email: string; ageBand: AuthUser["ageBand"]; role: StaffRole };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  async validate(payload: Payload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      ageBand: user.ageBand,
      role: user.role,
    };
  }
}
