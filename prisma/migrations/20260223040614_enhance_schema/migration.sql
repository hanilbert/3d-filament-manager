/*
  Warnings:

  - Added the required column `updated_at` to the `Location` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GlobalFilament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,
    "color_hex" TEXT,
    "nozzle_temp" TEXT,
    "bed_temp" TEXT,
    "print_speed" TEXT,
    "logo_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_GlobalFilament" ("bed_temp", "brand", "color_hex", "color_name", "created_at", "id", "logo_url", "material", "nozzle_temp", "print_speed") SELECT "bed_temp", "brand", "color_hex", "color_name", "created_at", "id", "logo_url", "material", "nozzle_temp", "print_speed" FROM "GlobalFilament";
DROP TABLE "GlobalFilament";
ALTER TABLE "new_GlobalFilament" RENAME TO "GlobalFilament";
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "short_code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "printer_name" TEXT,
    "ams_unit" TEXT,
    "ams_slot" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Location" ("id", "name", "updated_at") SELECT "id", "name", CURRENT_TIMESTAMP FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_short_code_key" ON "Location"("short_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
