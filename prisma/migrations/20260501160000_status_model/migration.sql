-- CreateEnum
CREATE TYPE "ShelterStatus_new" AS ENUM ('NEED', 'PROJECT', 'CONSTRUCTION', 'OPERATION', 'MODERNIZATION', 'REPAIR', 'CONSERVATION', 'MISUSE', 'DESTROYED');

-- CreateEnum
CREATE TYPE "AccountingStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ACCOUNTED', 'REMOVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterTable
ALTER TABLE "Shelter" ADD COLUMN "accountingStatus" "AccountingStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Shelter" ADD COLUMN "recordStatus" "RecordStatus" NOT NULL DEFAULT 'DRAFT';

-- Rename old enum so we can replace it with the new lifecycle model.
ALTER TYPE "ShelterStatus" RENAME TO "ShelterStatus_old";
ALTER TYPE "ShelterStatus_new" RENAME TO "ShelterStatus";

-- AlterTable
ALTER TABLE "Shelter" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Shelter" ALTER COLUMN "status" TYPE "ShelterStatus" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'NEED'
    WHEN 'PENDING' THEN 'PROJECT'
    WHEN 'VERIFIED' THEN 'OPERATION'
    WHEN 'REJECTED' THEN 'MISUSE'
    ELSE 'NEED'
  END
)::"ShelterStatus";
ALTER TABLE "Shelter" ALTER COLUMN "status" SET DEFAULT 'NEED';

-- Drop old enum after the column has been migrated.
DROP TYPE "ShelterStatus_old";
