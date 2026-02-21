-- CreateTable
CREATE TABLE "GlobalFilament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,
    "color_hex" TEXT,
    "nozzle_temp" TEXT NOT NULL,
    "bed_temp" TEXT NOT NULL,
    "print_speed" TEXT NOT NULL,
    "logo_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Spool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "global_filament_id" TEXT NOT NULL,
    "location_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Spool_global_filament_id_fkey" FOREIGN KEY ("global_filament_id") REFERENCES "GlobalFilament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Spool_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
