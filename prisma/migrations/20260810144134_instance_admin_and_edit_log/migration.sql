-- AlterTable
ALTER TABLE "InstanceMember" ADD COLUMN     "isInstanceAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EditLog" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditLog_instanceId_createdAt_idx" ON "EditLog"("instanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "EditLog" ADD CONSTRAINT "EditLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
