-- CreateEnum
CREATE TYPE "PenaltyAction" AS ENUM ('KICK', 'DIVE');

-- CreateEnum
CREATE TYPE "PenaltyDirection" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "PenaltyMatchStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'PENALTY_KICK';

-- CreateTable
CREATE TABLE "PenaltyMatch" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "opponentId" TEXT,
    "winnerId" TEXT,
    "creatorAction" "PenaltyAction" NOT NULL,
    "creatorDirection" "PenaltyDirection" NOT NULL,
    "opponentAction" "PenaltyAction",
    "opponentDirection" "PenaltyDirection",
    "wager" INTEGER NOT NULL,
    "status" "PenaltyMatchStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PenaltyMatch_tripId_status_createdAt_idx" ON "PenaltyMatch"("tripId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PenaltyMatch" ADD CONSTRAINT "PenaltyMatch_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyMatch" ADD CONSTRAINT "PenaltyMatch_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyMatch" ADD CONSTRAINT "PenaltyMatch_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyMatch" ADD CONSTRAINT "PenaltyMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PenaltyMatch" ADD CONSTRAINT "PenaltyMatch_wager_check" CHECK ("wager" > 0);
