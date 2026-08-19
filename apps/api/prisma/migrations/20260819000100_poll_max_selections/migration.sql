-- AlterTable
ALTER TABLE "Poll" ADD COLUMN "maxSelections" INTEGER NOT NULL DEFAULT 1;

-- Preserve the previous unrestricted behavior for existing non-single polls.
UPDATE "Poll"
SET "maxSelections" = LEAST(12, GREATEST(1, jsonb_array_length("options")))
WHERE "type" <> 'SINGLE';

-- AddConstraint
ALTER TABLE "Poll"
ADD CONSTRAINT "Poll_maxSelections_check"
CHECK ("maxSelections" >= 1 AND "maxSelections" <= 12);
