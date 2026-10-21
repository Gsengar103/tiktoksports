import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { LibraryController } from "./library.controller";
import { VideosController } from "./videos.controller";

@Module({
  imports: [StorageModule],
  controllers: [VideosController, LibraryController],
})
export class VideosModule {}
