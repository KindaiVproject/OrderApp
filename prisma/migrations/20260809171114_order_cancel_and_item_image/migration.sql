-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "imageUrl" TEXT;
