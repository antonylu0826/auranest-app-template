/*
  Warnings:

  - You are about to drop the column `role` on the `api_keys` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - Added the required column `role_id` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PermissionPolicy" AS ENUM ('DENY_ALL', 'READ_ALL', 'ALLOW_ALL');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('USERS_READ', 'USERS_CREATE', 'USERS_UPDATE', 'USERS_DELETE', 'API_KEYS_READ', 'API_KEYS_CREATE', 'API_KEYS_DELETE', 'CALENDAR_READ', 'CALENDAR_CREATE', 'CALENDAR_UPDATE', 'CALENDAR_DELETE', 'EVENT_READ', 'EVENT_CREATE', 'EVENT_UPDATE', 'EVENT_DELETE');

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "role",
ADD COLUMN     "role_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role_id" TEXT NOT NULL;

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permission_policy" "PermissionPolicy" NOT NULL DEFAULT 'DENY_ALL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "role_permissions"("role_id", "permission");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
