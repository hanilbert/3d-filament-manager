-- CreateIndex
CREATE INDEX "Filament_brand_idx" ON "Filament"("brand");

-- CreateIndex
CREATE INDEX "Filament_brand_updated_at_idx" ON "Filament"("brand", "updated_at");
