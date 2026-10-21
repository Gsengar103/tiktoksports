import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { INGEST_QUEUE } from "../ingest/ingest.constants";
import { StorageModule } from "../storage/storage.module";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [BullModule.registerQueue({ name: INGEST_QUEUE }), StorageModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
