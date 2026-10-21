import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "../config/env";
import { DevObjectsController } from "./dev-objects.controller";
import { MemoryObjectStorage, OBJECT_STORAGE, S3ObjectStorage } from "./object-storage";

@Module({
  controllers: [DevObjectsController],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get("STORAGE", { infer: true }) === "memory"
          ? new MemoryObjectStorage(`http://localhost:${config.get("PORT", { infer: true })}`)
          : new S3ObjectStorage(config),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
