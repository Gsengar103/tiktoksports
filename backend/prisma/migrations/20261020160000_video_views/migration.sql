CREATE TABLE "VideoViewDaily" (
    "videoId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "ageBand" "AgeBand" NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VideoViewDaily_pkey" PRIMARY KEY ("videoId","day","ageBand")
);

ALTER TABLE "VideoViewDaily" ADD CONSTRAINT "VideoViewDaily_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
