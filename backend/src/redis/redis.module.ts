import { Global, Injectable, Module, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { Env } from "../config/env";

export const REDIS = Symbol("REDIS");

@Injectable()
export class RedisLifecycle implements OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => new Redis(config.get("REDIS_URL", { infer: true })),
    },
    {
      provide: RedisLifecycle,
      inject: [REDIS],
      useFactory: (redis: Redis) => new RedisLifecycle(redis),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
