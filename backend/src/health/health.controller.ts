import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS } from "../redis/redis.module";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<{ status: string; postgres: string; redis: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const pong = await this.redis.ping();
      if (pong !== "PONG") throw new Error("redis");
      return { status: "ok", postgres: "up", redis: "up" };
    } catch {
      throw new ServiceUnavailableException({ status: "down", postgres: "unknown", redis: "unknown" });
    }
  }
}
