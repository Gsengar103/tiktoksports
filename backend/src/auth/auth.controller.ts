import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { IsDateString, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { AuthUser, CurrentUser } from "./current-user";
import { JwtAuthGuard } from "./jwt-auth.guard";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName!: string;

  @IsDateString()
  dateOfBirth!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class PhoneStartDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phone!: string;
}

export class PhoneVerifyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

export class FacebookAuthDto {
  @IsString()
  @MinLength(20)
  accessToken!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}

@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("phone/start")
  startPhone(@Body() dto: PhoneStartDto) {
    return this.auth.startPhone(dto.phone);
  }

  @Post("phone/verify")
  verifyPhone(@Body() dto: PhoneVerifyDto) {
    return this.auth.verifyPhone(dto);
  }

  @Post("google")
  google(@Body() dto: GoogleAuthDto) {
    return this.auth.google(dto);
  }

  @Post("facebook")
  facebook(@Body() dto: FacebookAuthDto) {
    return this.auth.facebook(dto);
  }
}

@Controller("v1")
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
