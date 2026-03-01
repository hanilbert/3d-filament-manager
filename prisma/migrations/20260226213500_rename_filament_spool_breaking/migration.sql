PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Filament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    "color_name" TEXT NOT NULL,
    "upc_gtin" TEXT,
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
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TEMP TABLE "_filament_id_map" AS
WITH "ranked_filament" AS (
  SELECT
    "id" AS "old_id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "brand", COALESCE("material_type", ''), COALESCE("material", ''), "color_name"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
    ) AS "canonical_id",
    ROW_NUMBER() OVER (
      PARTITION BY "brand", COALESCE("material_type", ''), COALESCE("material", ''), "color_name"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
    ) AS "row_num"
  FROM "GlobalFilament"
)
SELECT "old_id", "canonical_id", "row_num"
FROM "ranked_filament";

INSERT INTO "new_Filament" (
    "id", "brand", "material", "variant", "color_name", "upc_gtin", "color_hex", "nozzle_temp", "bed_temp",
    "print_speed", "logo_url", "density", "diameter", "nominal_weight", "softening_temp", "chamber_temp",
    "ironing_flow", "ironing_speed", "shrinkage", "empty_spool_weight", "pressure_advance", "fan_min", "fan_max",
    "first_layer_walls", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface",
    "other_layers_walls", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface",
    "measured_rgb", "top_voted_td", "num_td_votes", "max_volumetric_speed", "flow_ratio",
    "drying_temp", "dry_time", "ams_compatibility", "build_plates", "created_at", "updated_at"
)
SELECT
    gf."id",
    gf."brand",
    COALESCE(gf."material_type", ''),
    COALESCE(gf."material", ''),
    gf."color_name",
    gf."upc_gtin",
    gf."color_hex",
    gf."nozzle_temp",
    gf."bed_temp",
    gf."print_speed",
    gf."logo_url",
    gf."density",
    gf."diameter",
    gf."nominal_weight",
    gf."softening_temp",
    gf."chamber_temp",
    gf."ironing_flow",
    gf."ironing_speed",
    gf."shrinkage",
    gf."empty_spool_weight",
    gf."pressure_advance",
    gf."fan_min",
    gf."fan_max",
    gf."first_layer_walls",
    gf."first_layer_infill",
    gf."first_layer_outer_wall",
    gf."first_layer_top_surface",
    gf."other_layers_walls",
    gf."other_layers_infill",
    gf."other_layers_outer_wall",
    gf."other_layers_top_surface",
    gf."measured_rgb",
    gf."top_voted_td",
    gf."num_td_votes",
    gf."max_volumetric_speed",
    gf."flow_ratio",
    gf."drying_temp",
    gf."dry_time",
    gf."ams_compatibility",
    gf."build_plates",
    gf."created_at",
    gf."updated_at"
FROM "GlobalFilament" gf
JOIN "_filament_id_map" fmap ON fmap."old_id" = gf."id"
WHERE fmap."row_num" = 1;

DROP TABLE "GlobalFilament";
ALTER TABLE "new_Filament" RENAME TO "Filament";

CREATE UNIQUE INDEX "Filament_brand_material_variant_color_name_key"
ON "Filament"("brand", "material", "variant", "color_name");
CREATE UNIQUE INDEX "Filament_upc_gtin_key"
ON "Filament"("upc_gtin");

CREATE TABLE "new_Spool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filament_id" TEXT NOT NULL,
    "location_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Spool_filament_id_fkey"
      FOREIGN KEY ("filament_id") REFERENCES "Filament" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Spool_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "Location" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Spool" (
    "id", "filament_id", "location_id", "status", "metadata", "created_at", "updated_at"
)
SELECT
    s."id",
    fmap."canonical_id" AS "filament_id",
    s."location_id",
    s."status",
    s."metadata",
    s."created_at",
    s."updated_at"
FROM "Spool" s
JOIN "_filament_id_map" fmap ON fmap."old_id" = s."filament_id";

DROP TABLE "Spool";
ALTER TABLE "new_Spool" RENAME TO "Spool";

CREATE INDEX "Spool_filament_id_idx" ON "Spool"("filament_id");
CREATE INDEX "Spool_location_id_idx" ON "Spool"("location_id");
CREATE INDEX "Spool_status_idx" ON "Spool"("status");

PRAGMA foreign_keys=ON;
