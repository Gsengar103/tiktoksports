import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { INGEST_QUEUE } from "./ingest.constants";
import { IngestProcessor } from "./ingest.processor";
import { IngestService } from "./ingest.service";

@Module({
  imports: [BullModule.registerQueue({ name: INGEST_QUEUE })],
  providers: [IngestService, IngestProcessor],
  exports: [IngestService],
})
export class IngestModule {}
