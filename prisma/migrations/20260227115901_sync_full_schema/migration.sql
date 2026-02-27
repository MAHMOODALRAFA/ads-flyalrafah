/*
  Warnings:

  - The `destination` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[referredUserId]` on the table `Referral` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referredPhone,campaign]` on the table `Referral` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Destination" AS ENUM ('SHIRAZ', 'TEHRAN', 'CHABAHAR', 'KISH', 'BANDAR_ABBAS', 'AHWAZ', 'MASHHAD');

-- DropForeignKey
ALTER TABLE "Referral" DROP CONSTRAINT "Referral_referrerId_fkey";

-- DropIndex
DROP INDEX "Referral_referredPhone_key";

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "referredUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sharesGiven" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "destination",
ADD COLUMN     "destination" "Destination";

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destination" "Destination" NOT NULL,
    "q1" TEXT NOT NULL,
    "q2" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswer_userId_key" ON "QuestionAnswer"("userId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_destination_createdAt_idx" ON "QuestionAnswer"("destination", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_createdAt_idx" ON "Referral"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredPhone_campaign_key" ON "Referral"("referredPhone", "campaign");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_points_idx" ON "User"("points");

-- CreateIndex
CREATE INDEX "User_sharesGiven_idx" ON "User"("sharesGiven");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
