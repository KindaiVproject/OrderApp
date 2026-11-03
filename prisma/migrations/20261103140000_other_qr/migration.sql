-- CreateTable
CREATE TABLE "OtherQr" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherQr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtherQr_instanceId_createdAt_idx" ON "OtherQr"("instanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "OtherQr" ADD CONSTRAINT "OtherQr_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
