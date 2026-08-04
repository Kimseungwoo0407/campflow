-- Manager-granted rewards are stored as pending, zero-cost redemptions until the member uses them.
ALTER TABLE "RewardRedemption" ADD COLUMN "sourceKey" TEXT;

DROP INDEX IF EXISTS "RewardRedemption_tripId_sourceKey_key";
CREATE UNIQUE INDEX "RewardRedemption_tripId_sourceKey_key"
ON "RewardRedemption"("tripId", "sourceKey");

ALTER TABLE "RewardRedemption" DROP CONSTRAINT "RewardRedemption_cost_check";
ALTER TABLE "RewardRedemption"
ADD CONSTRAINT "RewardRedemption_cost_check" CHECK ("cost" >= 0);
