ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "facebookId" TEXT;

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");
