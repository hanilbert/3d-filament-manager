/*
  Warnings:

  - You are about to drop the column `short_code` on the `Location` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `GlobalFilament` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Spool` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlobalFilament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "material_type" TEXT,
    "color_name" TEXT NOT NULL,
    "color_hex" TEXT,
    "nozzle_temp" TEXT,
    "bed_temp" TEXT,
    "print_speed" TEXT,
    "logo_url" TEXT,
    "density" TEXT,
    "diameter" TEXT,
    "nominal_weight" TEXT,
    "softening_temp" TEXT,
    "chamber_temp" TEXT,
    "ironing_flow" TEXT,
    "ironing_speed" TEXT,
    "shrinkage" TEXT,
    "empty_spool_weight" TEXT,
    "pressure_advance" TEXT,
    "fan_min" TEXT,
    "fan_max" TEXT,
    "first_layer_walls" TEXT,
    "first_layer_infill" TEXT,
    "first_layer_outer_wall" TEXT,
    "first_layer_top_surface" TEXT,
    "other_layers_walls" TEXT,
    "other_layers_infill" TEXT,
    "other_layers_outer_wall" TEXT,
    "other_layers_top_surface" TEXT,
    "measured_rgb" TEXT,
    "top_voted_td" TEXT,
    "num_td_votes" TEXT,
    "max_volumetric_speed" TEXT,
    "flow_ratio" TEXT,
    "drying_temp" TEXT,
    "dry_time" TEXT,
    "ams_compatibility" TEXT,
    "build_plates" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_GlobalFilament" ("ams_compatibility", "bed_temp", "brand", "build_plates", "chamber_temp", "color_hex", "color_name", "created_at", "density", "diameter", "dry_time", "drying_temp", "empty_spool_weight", "fan_max", "fan_min", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface", "first_layer_walls", "flow_ratio", "id", "ironing_flow", "ironing_speed", "logo_url", "material", "material_type", "max_volumetric_speed", "measured_rgb", "nominal_weight", "nozzle_temp", "num_td_votes", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface", "other_layers_walls", "pressure_advance", "print_speed", "shrinkage", "softening_temp", "top_voted_td", "updated_at") SELECT "ams_compatibility", "bed_temp", "brand", "build_plates", "chamber_temp", "color_hex", "color_name", "created_at", "density", "diameter", "dry_time", "drying_temp", "empty_spool_weight", "fan_max", "fan_min", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface", "first_layer_walls", "flow_ratio", "id", "ironing_flow", "ironing_speed", "logo_url", "material", "material_type", "max_volumetric_speed", "measured_rgb", "nominal_weight", "nozzle_temp", "num_td_votes", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface", "other_layers_walls", "pressure_advance", "print_speed", "shrinkage", "softening_temp", "top_voted_td", CURRENT_TIMESTAMP FROM "GlobalFilament";
DROP TABLE "GlobalFilament";
ALTER TABLE "new_GlobalFilament" RENAME TO "GlobalFilament";
CREATE UNIQUE INDEX "GlobalFilament_brand_material_color_name_key" ON "GlobalFilament"("brand", "material", "color_name");
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "printer_name" TEXT,
    "ams_unit" TEXT,
    "ams_slot" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Location" ("ams_slot", "ams_unit", "created_at", "id", "is_default", "name", "printer_name", "type", "updated_at") SELECT "ams_slot", "ams_unit", "created_at", "id", "is_default", "name", "printer_name", "type", "updated_at" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE TABLE "new_Spool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filament_id" TEXT NOT NULL,
    "location_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Spool_filament_id_fkey" FOREIGN KEY ("filament_id") REFERENCES "GlobalFilament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Spool_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Spool" ("created_at", "filament_id", "id", "location_id", "metadata", "status", "updated_at") SELECT "created_at", "filament_id", "id", "location_id", "metadata", "status", CURRENT_TIMESTAMP FROM "Spool";
DROP TABLE "Spool";
ALTER TABLE "new_Spool" RENAME TO "Spool";
CREATE INDEX "Spool_filament_id_idx" ON "Spool"("filament_id");
CREATE INDEX "Spool_location_id_idx" ON "Spool"("location_id");
CREATE INDEX "Spool_status_idx" ON "Spool"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
