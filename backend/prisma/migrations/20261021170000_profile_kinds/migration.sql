CREATE TYPE "ProfileKind" AS ENUM ('PLAYER', 'COACH', 'ACADEMY');
CREATE TYPE "ProfilePhotoRole" AS ENUM ('LOGO', 'COVER', 'PORTRAIT', 'GALLERY');

ALTER TABLE "Profile" ADD COLUMN "kind" "ProfileKind" NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "Profile" ADD COLUMN "linkUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "groundName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "establishedYear" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "trialNote" TEXT;
ALTER TABLE "Profile" ADD COLUMN "coachesWhat" TEXT;
ALTER TABLE "Profile" ADD COLUMN "qualification" TEXT;
ALTER TABLE "Profile" ADD COLUMN "yearsCoaching" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "achievements" TEXT;
ALTER TABLE "Profile" ADD COLUMN "about" TEXT;
ALTER TABLE "Profile" ADD COLUMN "ageGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Profile" ADD COLUMN "batches" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ProfilePhoto" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" "ProfilePhotoRole" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfilePhoto_profileId_role_idx" ON "ProfilePhoto"("profileId", "role");

ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
