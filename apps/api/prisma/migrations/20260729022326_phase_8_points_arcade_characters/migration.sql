-- CreateEnum
CREATE TYPE "PointEntryKind" AS ENUM ('EARN', 'SPEND', 'WIN', 'LOSS', 'ADJUST');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('PRIVILEGE', 'TARGET_PENALTY', 'PROTECTION');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('APPLIED', 'PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('TAP', 'ODD_EVEN', 'SNAIL_RACE', 'RPS_ROULETTE', 'LOTTERY');

-- CreateTable
CREATE TABLE "PointWallet" (
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "earnedTotal" INTEGER NOT NULL DEFAULT 0,
    "spentTotal" INTEGER NOT NULL DEFAULT 0,
    "checkInStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckInDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointWallet_pkey" PRIMARY KEY ("tripId","userId")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "kind" "PointEntryKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "seedKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "type" "RewardType" NOT NULL,
    "effect" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "rewardItemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "targetId" TEXT,
    "cost" INTEGER NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'APPLIED',
    "note" TEXT,
    "outcome" JSONB NOT NULL DEFAULT '{}',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRound" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "clientRoundId" TEXT,
    "wager" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "pointDelta" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCharacterProfile" (
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripCharacterProfile_pkey" PRIMARY KEY ("tripId","userId")
);

-- CreateIndex
CREATE INDEX "PointWallet_tripId_balance_idx" ON "PointWallet"("tripId", "balance");

-- CreateIndex
CREATE INDEX "PointLedger_tripId_createdAt_idx" ON "PointLedger"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointLedger_tripId_userId_sourceKey_key" ON "PointLedger"("tripId", "userId", "sourceKey");

-- CreateIndex
CREATE INDEX "RewardItem_tripId_active_sortOrder_idx" ON "RewardItem"("tripId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RewardItem_tripId_seedKey_key" ON "RewardItem"("tripId", "seedKey");

-- CreateIndex
CREATE INDEX "RewardRedemption_tripId_createdAt_idx" ON "RewardRedemption"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_targetId_status_idx" ON "RewardRedemption"("targetId", "status");

-- CreateIndex
CREATE INDEX "GameRound_tripId_gameType_createdAt_idx" ON "GameRound"("tripId", "gameType", "createdAt");

-- CreateIndex
CREATE INDEX "GameRound_tripId_score_idx" ON "GameRound"("tripId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_tripId_userId_clientRoundId_key" ON "GameRound"("tripId", "userId", "clientRoundId");

-- AddForeignKey
ALTER TABLE "PointWallet" ADD CONSTRAINT "PointWallet_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWallet" ADD CONSTRAINT "PointWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardItem" ADD CONSTRAINT "RewardItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardItemId_fkey" FOREIGN KEY ("rewardItemId") REFERENCES "RewardItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCharacterProfile" ADD CONSTRAINT "TripCharacterProfile_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCharacterProfile" ADD CONSTRAINT "TripCharacterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Point balances and game values are non-cash, non-negative in storage.
ALTER TABLE "PointWallet" ADD CONSTRAINT "PointWallet_balance_check" CHECK ("balance" >= 0);
ALTER TABLE "PointWallet" ADD CONSTRAINT "PointWallet_totals_check" CHECK ("earnedTotal" >= 0 AND "spentTotal" >= 0);
ALTER TABLE "RewardItem" ADD CONSTRAINT "RewardItem_cost_check" CHECK ("cost" > 0);
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_cost_check" CHECK ("cost" > 0);
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_wager_check" CHECK ("wager" >= 0);
