-- AlterTable
ALTER TABLE "GlobalFilament" ADD COLUMN "upc_gtin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalFilament_upc_gtin_key" ON "GlobalFilament"("upc_gtin");
