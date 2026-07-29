CREATE TYPE "TripStatus" AS ENUM (
  'DRAFT',
  'SEARCHING',
  'VOTING',
  'CONFIRMED',
  'IN_PROGRESS',
  'SETTLING',
  'ARCHIVED'
);

CREATE TYPE "TripRole" AS ENUM ('MANAGER', 'MEMBER', 'GUEST');

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "seedKey" TEXT,
  "title" TEXT NOT NULL,
  "purpose" TEXT,
  "status" "TripStatus" NOT NULL DEFAULT 'SEARCHING',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "dateRangeStart" DATE NOT NULL,
  "dateRangeEnd" DATE NOT NULL,
  "nights" INTEGER NOT NULL DEFAULT 1,
  "regionText" TEXT NOT NULL DEFAULT '가평',
  "budgetPerPerson" INTEGER,
  "attendeeCount" INTEGER NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Trip_dates_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "Trip_budget_check" CHECK ("budgetPerPerson" IS NULL OR "budgetPerPerson" >= 0),
  CONSTRAINT "Trip_attendee_count_check" CHECK ("attendeeCount" > 0)
);

CREATE TABLE "TripMember" (
  "tripId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TripRole" NOT NULL DEFAULT 'MEMBER',
  "attendanceStatus" TEXT NOT NULL DEFAULT 'ATTENDING',
  "isCoreMember" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripMember_pkey" PRIMARY KEY ("tripId", "userId")
);

CREATE TABLE "DecisionLog" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "entityId" TEXT,
  "decidedById" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Trip_seedKey_key" ON "Trip"("seedKey");
CREATE INDEX "Trip_groupId_deletedAt_updatedAt_idx" ON "Trip"("groupId", "deletedAt", "updatedAt");
CREATE INDEX "Trip_status_startDate_idx" ON "Trip"("status", "startDate");
CREATE INDEX "TripMember_userId_attendanceStatus_idx" ON "TripMember"("userId", "attendanceStatus");
CREATE INDEX "DecisionLog_tripId_createdAt_idx" ON "DecisionLog"("tripId", "createdAt");

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripMember"
  ADD CONSTRAINT "TripMember_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripMember"
  ADD CONSTRAINT "TripMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionLog"
  ADD CONSTRAINT "DecisionLog_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionLog"
  ADD CONSTRAINT "DecisionLog_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
