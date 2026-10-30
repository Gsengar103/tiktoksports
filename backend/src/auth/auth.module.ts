import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Env } from "../config/env";
import { StorageModule } from "../storage/storage.module";
import { AuthController, MeController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { PhoneOtpService } from "./phone-otp.service";
import { SmsSender } from "./sms.sender";

@Module({
  imports: [
    StorageModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, PhoneOtpService, SmsSender, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
