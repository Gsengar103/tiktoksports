import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AccountStatus, AgeBand, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { ageBandFromDob } from "../common/age";
import { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { OBJECT_STORAGE, ObjectStorage } from "../storage/object-storage";
import type { FacebookAuthDto, GoogleAuthDto, PhoneVerifyDto, RegisterDto } from "./auth.controller";
import { AuthUser } from "./current-user";
import { verifyFacebookAccessToken, verifyGoogleIdToken } from "./identity-providers";
import { normalizePhone } from "./phone";
import { PhoneOtpService } from "./phone-otp.service";

type NewProfile = { displayName: string; dateOfBirth: Date; ageBand: AgeBand };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly otp: PhoneOtpService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async register(dto: RegisterDto) {
    const profile = this.parseNewProfile(dto.displayName, dto.dateOfBirth);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ForbiddenException("An account with that email already exists");

    const user = await this.createUser({
      email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      ageBand: profile.ageBand,
      profile: { create: {} },
    });
    return this.issue(this.toAuthUser(user));
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status !== AccountStatus.ACTIVE || !user.passwordHash) {
      throw new UnauthorizedException("Email or password is wrong");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Email or password is wrong");
    return this.issue(this.toAuthUser(user));
  }

  async startPhone(phone: string) {
    await this.otp.start(normalizePhone(phone));
    return { sent: true };
  }

  async verifyPhone(dto: PhoneVerifyDto) {
    const phone = normalizePhone(dto.phone);
    await this.otp.assertValid(phone, dto.code);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      this.assertActive(existing);
      await this.otp.consume(phone);
      return this.issue(this.toAuthUser(existing));
    }
    const profile = this.requireNewProfile(dto.displayName, dto.dateOfBirth);
    const user = await this.createUser({
      phone,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      ageBand: profile.ageBand,
      profile: { create: {} },
    });
    await this.otp.consume(phone);
    return this.issue(this.toAuthUser(user));
  }

  async google(dto: GoogleAuthDto) {
    const clientId = this.config.get("GOOGLE_CLIENT_ID", { infer: true });
    if (!clientId) throw new ServiceUnavailableException("Google sign-in is not configured");
    const identity = await verifyGoogleIdToken(dto.idToken, clientId);
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: identity.sub } });
    if (bySub) {
      this.assertActive(bySub);
      return this.issue(this.toAuthUser(bySub));
    }
    if (identity.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== identity.sub) {
          throw new ForbiddenException("That email is already linked to another Google account");
        }
        this.assertActive(byEmail);
        const linked = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleSub: identity.sub },
        });
        return this.issue(this.toAuthUser(linked));
      }
    }
    const profile = this.requireNewProfile(dto.displayName, dto.dateOfBirth, identity.name);
    const user = await this.createUser({
      email: identity.email ?? null,
      googleSub: identity.sub,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      ageBand: profile.ageBand,
      profile: { create: {} },
    });
    return this.issue(this.toAuthUser(user));
  }

  async facebook(dto: FacebookAuthDto) {
    const appId = this.config.get("FACEBOOK_APP_ID", { infer: true });
    const appSecret = this.config.get("FACEBOOK_APP_SECRET", { infer: true });
    if (!appId || !appSecret) throw new ServiceUnavailableException("Facebook sign-in is not configured");
    const identity = await verifyFacebookAccessToken(dto.accessToken, appId, appSecret);
    const existing = await this.prisma.user.findUnique({ where: { facebookId: identity.id } });
    if (existing) {
      this.assertActive(existing);
      return this.issue(this.toAuthUser(existing));
    }
    const profile = this.requireNewProfile(dto.displayName, dto.dateOfBirth, identity.name);
    const user = await this.createUser({
      facebookId: identity.id,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      ageBand: profile.ageBand,
      profile: { create: {} },
    });
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
      include: { profile: { include: { sports: true, photos: { orderBy: { createdAt: "asc" } } } } },
    });
    const profile = user.profile;
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      providers: {
        password: user.passwordHash != null,
        phone: user.phone != null,
        google: user.googleSub != null,
        facebook: user.facebookId != null,
      },
      displayName: user.displayName,
      ageBand: user.ageBand,
      role: user.role,
      profile: profile
        ? {
            kind: profile.kind,
            city: profile.city,
            area: profile.area,
            cityVisible: profile.cityVisible,
            goal: profile.goal,
            playFrequency: profile.playFrequency,
            aboutPlay: profile.aboutPlay,
            academyName: profile.academyName,
            linkUrl: profile.linkUrl,
            groundName: profile.groundName,
            establishedYear: profile.establishedYear,
            trialNote: profile.trialNote,
            coachesWhat: profile.coachesWhat,
            qualification: profile.qualification,
            yearsCoaching: profile.yearsCoaching,
            achievements: profile.achievements,
            about: profile.about,
            ageGroups: profile.ageGroups,
            batches: profile.batches,
            sports: profile.sports.map((sport) => ({
              sportId: sport.sportId,
              relation: sport.relation,
              levelId: sport.levelId,
            })),
            photos: await Promise.all(
              profile.photos.map(async (photo) => ({
                id: photo.id,
                role: photo.role,
                url: await this.storage.presignGet(photo.objectKey),
              })),
            ),
          }
        : null,
    };
  }

  private requireNewProfile(displayName?: string, dateOfBirth?: string, suggestedName?: string): NewProfile {
    const name = displayName?.trim();
    if (!name || !dateOfBirth) {
      const suggestion = suggestedName?.trim();
      throw new BadRequestException({
        needsProfile: true,
        message: "Name and date of birth are required",
        ...(suggestion && suggestion.length >= 2 && suggestion.length <= 40 ? { suggestedDisplayName: suggestion } : {}),
      });
    }
    return this.parseNewProfile(name, dateOfBirth);
  }

  private parseNewProfile(displayName: string, dateOfBirth: string): NewProfile {
    const name = displayName.trim();
    if (name.length < 2 || name.length > 40) throw new BadRequestException("Name must be 2 to 40 characters");
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
      throw new ForbiddenException("Date of birth is not valid");
    }
    const ageBand = ageBandFromDob(dob);
    if (!ageBand) throw new ForbiddenException("You must be 13 or older");
    return { displayName: name, dateOfBirth: dob, ageBand };
  }

  private assertActive(user: { status: AccountStatus }) {
    if (user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException("This account is not active");
  }

  private async createUser(data: Prisma.UserCreateInput) {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ForbiddenException("An account with those details already exists");
      }
      throw error;
    }
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

  private toAuthUser(user: {
    id: string;
    email: string | null;
    displayName: string;
    ageBand: AuthUser["ageBand"];
    role: AuthUser["role"];
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      ageBand: user.ageBand,
      role: user.role,
    };
  }
}
