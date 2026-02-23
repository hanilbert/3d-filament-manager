/** All optional fields on GlobalFilament (used for allowedFields, form values, etc.) */
export const FILAMENT_OPTIONAL_FIELDS = [
  "color_hex", "nozzle_temp", "bed_temp", "print_speed", "logo_url",
  "density", "diameter", "nominal_weight", "softening_temp", "chamber_temp",
  "ironing_flow", "ironing_speed", "shrinkage", "empty_spool_weight", "pressure_advance",
  "fan_min", "fan_max",
  "first_layer_walls", "first_layer_infill", "first_layer_outer_wall", "first_layer_top_surface",
  "other_layers_walls", "other_layers_infill", "other_layers_outer_wall", "other_layers_top_surface",
  "measured_rgb", "top_voted_td", "num_td_votes",
  "max_volumetric_speed", "flow_ratio",
  "drying_temp", "dry_time",
  "ams_compatibility", "build_plates",
] as const;

/** All fields that can be set on GlobalFilament (required + optional) */
export const FILAMENT_ALLOWED_FIELDS = [
  "brand", "material", "material_type", "color_name",
  ...FILAMENT_OPTIONAL_FIELDS,
] as const;

export type FilamentFieldName = (typeof FILAMENT_ALLOWED_FIELDS)[number];

/** Base GlobalFilament shape — use this instead of redefining in every file */
export interface GlobalFilament {
  id: string;
  brand: string;
  material: string;
  material_type?: string | null;
  color_name: string;
  color_hex?: string | null;
  nozzle_temp?: string | null;
  bed_temp?: string | null;
  print_speed?: string | null;
  logo_url?: string | null;
  density?: string | null;
  diameter?: string | null;
  nominal_weight?: string | null;
  softening_temp?: string | null;
  chamber_temp?: string | null;
  ironing_flow?: string | null;
  ironing_speed?: string | null;
  shrinkage?: string | null;
  empty_spool_weight?: string | null;
  pressure_advance?: string | null;
  fan_min?: string | null;
  fan_max?: string | null;
  first_layer_walls?: string | null;
  first_layer_infill?: string | null;
  first_layer_outer_wall?: string | null;
  first_layer_top_surface?: string | null;
  other_layers_walls?: string | null;
  other_layers_infill?: string | null;
  other_layers_outer_wall?: string | null;
  other_layers_top_surface?: string | null;
  measured_rgb?: string | null;
  top_voted_td?: string | null;
  num_td_votes?: string | null;
  max_volumetric_speed?: string | null;
  flow_ratio?: string | null;
  drying_temp?: string | null;
  dry_time?: string | null;
  ams_compatibility?: string | null;
  build_plates?: string | null;
  created_at?: string;
}
