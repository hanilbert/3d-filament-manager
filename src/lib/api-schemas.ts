import { z } from "zod";
import { FILAMENT_OPTIONAL_FIELDS } from "@/lib/types";
import { LOCATION_TYPES } from "@/lib/location-types";

/**
 * API 请求体验证 Schema
 * 使用 Zod 进行运行时类型验证和数据清洗
 *
 * 所有 Schema 使用 .strict() 模式，拒绝未定义的额外字段
 */

/** 文本字段最大长度（用于描述、备注等长文本） */
const MAX_TEXT_FIELD_LENGTH = 2000;
/** 短文本字段最大长度（用于名称、标签等） */
const MAX_SHORT_TEXT_LENGTH = 120;

/** 可选的可空文本字段 Schema */
const optionalNullableText = z
  .union([z.string().max(MAX_TEXT_FIELD_LENGTH), z.null()])
  .optional();

const locationTypeValues = LOCATION_TYPES.map((item) => item.value) as [
  (typeof LOCATION_TYPES)[number]["value"],
  ...(typeof LOCATION_TYPES)[number]["value"][],
];

const filamentOptionalCreateShape = FILAMENT_OPTIONAL_FIELDS.reduce<
  Record<string, z.ZodTypeAny>
>((shape, key) => {
  shape[key] = optionalNullableText;
  return shape;
}, {});

const filamentOptionalPatchShape = FILAMENT_OPTIONAL_FIELDS.reduce<
  Record<string, z.ZodTypeAny>
>((shape, key) => {
  shape[key] = optionalNullableText;
  return shape;
}, {});

/**
 * 登录请求体 Schema
 * POST /api/auth/login
 */
export const loginBodySchema = z
  .object({
    password: z.string().min(1).max(256),
  })
  .strict();

/**
 * 创建耗材请求体 Schema
 * POST /api/filaments
 *
 * 必填字段：brand, material, color_name
 * 可选字段：variant + 40+ 打印参数字段
 */
export const filamentCreateSchema = z
  .object({
    brand: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
    material: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
    variant: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
    color_name: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
    ...filamentOptionalCreateShape,
  })
  .strict();

/**
 * 更新耗材请求体 Schema
 * PATCH /api/filaments/[id]
 *
 * 所有字段均为可选，仅更新提供的字段
 */
export const filamentPatchSchema = z
  .object({
    brand: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH).optional(),
    material: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH).optional(),
    color_name: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH).optional(),
    variant: optionalNullableText,
    ...filamentOptionalPatchShape,
  })
  .strict();

/**
 * 品牌重命名请求体 Schema
 * PATCH /api/filaments/brand-rename
 *
 * 批量更新所有指定品牌的耗材
 */
export const brandRenameBodySchema = z
  .object({
    oldBrand: z.string().trim().min(1).max(80),
    newBrand: z.string().trim().min(1).max(80),
  })
  .strict();

/**
 * 创建位置请求体 Schema
 * POST /api/locations
 *
 * 支持 AMS 插槽字段：printer_name, ams_unit, ams_slot
 */
export const locationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(locationTypeValues).optional(),
    is_default: z.boolean().optional(),
    printer_name: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
    ams_unit: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
    ams_slot: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  })
  .strict();

/**
 * 更新位置请求体 Schema
 * PATCH /api/locations/[id]
 *
 * 所有字段均为可选，AMS 字段支持设置为 null
 */
export const locationPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: z.enum(locationTypeValues).optional(),
    is_default: z.boolean().optional(),
    printer_name: z.union([z.string().max(MAX_SHORT_TEXT_LENGTH), z.null()]).optional(),
    ams_unit: z.union([z.string().max(MAX_SHORT_TEXT_LENGTH), z.null()]).optional(),
    ams_slot: z.union([z.string().max(MAX_SHORT_TEXT_LENGTH), z.null()]).optional(),
  })
  .strict();

/**
 * 创建线轴请求体 Schema
 * POST /api/spools
 *
 * 仅需提供 filament_id，状态默认为 ACTIVE
 */
export const spoolCreateSchema = z
  .object({
    filament_id: z.string().trim().min(1).max(MAX_SHORT_TEXT_LENGTH),
  })
  .strict();

/**
 * 更新线轴请求体 Schema
 * PATCH /api/spools/[id]
 *
 * 可更新：status（ACTIVE/EMPTY）、location_id、metadata（任意 JSON）
 */
export const spoolPatchSchema = z
  .object({
    status: z.enum(["ACTIVE", "EMPTY"]).optional(),
    location_id: z.union([z.string().trim().min(1), z.null()]).optional(),
    metadata: z.unknown().optional(),
  })
  .strict();
