import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AccountModule } from "./account/account.module";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { Env, loadEnv } from "./config/env";
import { EngagementModule } from "./engagement/engagement.module";
import { FeedModule } from "./feed/feed.module";
import { HealthModule } from "./health/health.module";
import { IngestModule } from "./ingest/ingest.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { PublicModule } from "./public/public.module";
import { RedisModule } from "./redis/redis.module";
import { ReportsModule } from "./reports/reports.module";
import { SearchModule } from "./search/search.module";
import { StorageModule } from "./storage/storage.module";
import { TaxonomyModule } from "./taxonomy/taxonomy.module";
import { UploadsModule } from "./uploads/uploads.module";
import { VideosModule } from "./videos/videos.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: (config) => loadEnv(config) }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    TaxonomyModule,
    ProfilesModule,
    VideosModule,
    UploadsModule,
    IngestModule,
    FeedModule,
    SearchModule,
    EngagementModule,
    ReportsModule,
    AdminModule,
    PublicModule,
    AccountModule,
  ],
})
export class AppModule {}
