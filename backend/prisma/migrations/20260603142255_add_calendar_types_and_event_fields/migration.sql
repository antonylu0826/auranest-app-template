-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('PERSONAL', 'SHARED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventPrivacy" AS ENUM ('DEFAULT', 'PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "type" "CalendarType" NOT NULL DEFAULT 'PERSONAL';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_start_at" TIMESTAMP(3),
ADD COLUMN     "privacy" "EventPrivacy" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "recurring_event_id" TEXT,
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei';

-- CreateIndex
CREATE INDEX "events_calendar_id_start_at_idx" ON "events"("calendar_id", "start_at");

-- CreateIndex
CREATE INDEX "events_recurring_event_id_idx" ON "events"("recurring_event_id");
