import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { INGEST_QUEUE } from "./ingest.constants";
import { IngestService } from "./ingest.service";

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  constructor(private readonly ingest: IngestService) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    await this.ingest.run(job.data.videoId);
  }
}
