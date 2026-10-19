import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { PublicVideosController } from "./public-videos.controller";

@Module({
  imports: [StorageModule],
  controllers: [PublicVideosController],
})
export class PublicModule {}
