import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import Redis from "ioredis";
import { REDIS } from "../redis/redis.module";
import { SmsSender } from "./sms.sender";

const OTP_TTL_SECONDS = 5 * 60;
const COOLDOWN_SECONDS = 60;
const HOUR_SECONDS = 60 * 60;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PhoneOtpService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly sms: SmsSender,
  ) {}

  async start(phone: string): Promise<void> {
    const cooldownKey = `auth:otp:cool:${phone}`;
    const hourKey = `auth:otp:hour:${phone}`;
    if (await this.redis.get(cooldownKey)) {
      throw new HttpException("Wait a minute before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    }
    const sent = Number((await this.redis.get(hourKey)) ?? 0);
    if (sent >= MAX_PER_HOUR) {
      throw new HttpException("Too many codes requested. Try again later", HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeKey = `auth:otp:${phone}`;
    await this.redis.set(codeKey, `${this.hash(phone, code)}:0`, "EX", OTP_TTL_SECONDS);
    await this.redis.set(cooldownKey, "1", "EX", COOLDOWN_SECONDS);
    const count = await this.redis.incr(hourKey);
    if (count === 1) await this.redis.expire(hourKey, HOUR_SECONDS);

    try {
      await this.sms.sendCode(phone, code);
    } catch (error) {
      await this.redis.del(codeKey, cooldownKey);
      throw error;
    }
  }

  async assertValid(phone: string, code: string): Promise<void> {
    const codeKey = `auth:otp:${phone}`;
    const raw = await this.redis.get(codeKey);
    if (!raw) throw new UnauthorizedException("Code is wrong or expired");
    const splitAt = raw.lastIndexOf(":");
    const hash = raw.slice(0, splitAt);
    const attempts = Number(raw.slice(splitAt + 1));
    if (!hash || Number.isNaN(attempts) || !this.same(hash, this.hash(phone, code.trim()))) {
      const next = (Number.isNaN(attempts) ? 0 : attempts) + 1;
      if (next >= MAX_ATTEMPTS) {
        await this.redis.del(codeKey);
      } else {
        const ttl = await this.redis.ttl(codeKey);
        await this.redis.set(codeKey, `${hash}:${next}`, "EX", ttl > 0 ? ttl : OTP_TTL_SECONDS);
      }
      throw new UnauthorizedException("Code is wrong or expired");
    }
  }

  async consume(phone: string): Promise<void> {
    await this.redis.del(`auth:otp:${phone}`);
  }

  private hash(phone: string, code: string): string {
    return createHash("sha256").update(`${phone}:${code}`).digest("hex");
  }

  private same(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
