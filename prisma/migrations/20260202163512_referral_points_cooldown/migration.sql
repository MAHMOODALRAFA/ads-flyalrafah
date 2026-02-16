/*
  Warnings:

  - The primary key for the `Referral` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `joinedId` on the `Referral` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `referredPhone` to the `Referral` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "referredPhone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Referral" ("createdAt", "id", "referrerId") SELECT "createdAt", "id", "referrerId" FROM "Referral";
DROP TABLE "Referral";
ALTER TABLE "new_Referral" RENAME TO "Referral";
CREATE UNIQUE INDEX "Referral_referredPhone_key" ON "Referral"("referredPhone");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "destination" TEXT,
    "refCode" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastShareAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "destination", "id", "name", "phone", "points", "refCode") SELECT "createdAt", "destination", "id", "name", "phone", "points", "refCode" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_refCode_key" ON "User"("refCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
