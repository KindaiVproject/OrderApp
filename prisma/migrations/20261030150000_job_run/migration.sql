-- CreateTable
CREATE TABLE "JobRun" (
    "name" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("name")
);

