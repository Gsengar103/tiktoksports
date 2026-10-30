CREATE TABLE "VideoWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "ageBand" "AgeBand" NOT NULL,
    "videoDurationMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoWatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoWatch_userId_startedAt_idx" ON "VideoWatch"("userId", "startedAt");
CREATE INDEX "VideoWatch_videoId_startedAt_idx" ON "VideoWatch"("videoId", "startedAt");

ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
