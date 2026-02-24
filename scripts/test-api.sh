#!/usr/bin/env bash
# =============================================================================
# scripts/test-api.sh — Spool Tracker API 测试（v2）
#
# 用法:
#   bash scripts/test-api.sh            # 运行 P0 冒烟
#   bash scripts/test-api.sh --full     # 运行完整 API 回归（含冒烟）
#
# 环境变量:
#   BASE_URL=http://localhost:3000
#   APP_PASSWORD=dev123
# =============================================================================

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
APP_PASSWORD="${APP_PASSWORD:-dev123}"
SUITE="smoke"
if [[ "${1:-}" == "--full" ]]; then
  SUITE="full"
fi

# ----- Colors -----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ----- Counters -----
PASS=0
FAIL=0
SKIP=0

# ----- Runtime vars -----
HTTP_STATUS=""
BODY=""
HEADERS=""
LAST_ERR=""
TOKEN=""

RUN_ID="$(date +%s)"
BRAND_BASE="TC2_BRAND_${RUN_ID}"
COLOR_BASE="TC2_COLOR_${RUN_ID}"

CAT_MAIN=""
CAT_LOCKED=""
SPOOL_MAIN=""
SPOOL_RESTOCK=""
SPOOL_LOCKED=""
LOC_MAIN=""
LOC_AMS=""
LOC_DEFAULT_A=""
LOC_DEFAULT_B=""

UPLOAD_PNG=""
UPLOAD_SVG=""
UPLOAD_PDF=""
UPLOAD_LARGE=""
UPLOADED_URL_PNG=""
UPLOADED_URL_SVG=""

# cleanup arrays
SPOOL_IDS=()
LOC_IDS=()
CAT_IDS=()

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    printf "${RED}缺少依赖: %s${NC}\n" "$1"
    exit 1
  }
}

log_section() {
  printf "\n${CYAN}${BOLD}════════════════════════════════════════════${NC}\n"
  printf "${CYAN}${BOLD}%s${NC}\n" "$1"
  printf "${CYAN}${BOLD}════════════════════════════════════════════${NC}\n"
}

pass() {
  PASS=$((PASS + 1))
  printf "  ${GREEN}✓${NC} %-14s %s\n" "$1" "$2"
}

fail() {
  FAIL=$((FAIL + 1))
  printf "  ${RED}✗${NC} %-14s %s\n" "$1" "$2"
  if [[ -n "${LAST_ERR:-}" ]]; then
    printf "    ${YELLOW}↳${NC} %s\n" "$LAST_ERR"
  fi
}

skip() {
  SKIP=$((SKIP + 1))
  printf "  ${YELLOW}•${NC} %-14s %s\n" "$1" "$2"
}

run_test() {
  local id="$1"
  local desc="$2"
  local fn="$3"
  LAST_ERR=""
  if "$fn"; then
    pass "$id" "$desc"
  else
    fail "$id" "$desc"
  fi
}

add_spool_id() {
  local id="$1"
  [[ -z "$id" ]] && return 0
  for x in "${SPOOL_IDS[@]}"; do
    [[ "$x" == "$id" ]] && return 0
  done
  SPOOL_IDS+=("$id")
}

add_loc_id() {
  local id="$1"
  [[ -z "$id" ]] && return 0
  for x in "${LOC_IDS[@]}"; do
    [[ "$x" == "$id" ]] && return 0
  done
  LOC_IDS+=("$id")
}

add_cat_id() {
  local id="$1"
  [[ -z "$id" ]] && return 0
  for x in "${CAT_IDS[@]}"; do
    [[ "$x" == "$id" ]] && return 0
  done
  CAT_IDS+=("$id")
}

b64dec() {
  if base64 --help 2>/dev/null | grep -q -- '--decode'; then
    base64 --decode
  else
    base64 -D
  fi
}

req() {
  local method="$1"
  local url="$2"
  shift 2

  local body_file
  local head_file
  body_file="$(mktemp)"
  head_file="$(mktemp)"

  HTTP_STATUS="$(curl -sS -o "$body_file" -D "$head_file" -w "%{http_code}" -X "$method" "$@" "$url" 2>/dev/null || echo "000")"
  BODY="$(cat "$body_file")"
  HEADERS="$(cat "$head_file")"

  rm -f "$body_file" "$head_file"
}

auth_req() {
  local method="$1"
  local url="$2"
  shift 2

  req "$method" "$url" \
    -H "Authorization: Bearer $TOKEN" \
    --cookie "spool_tracker_token=$TOKEN" \
    "$@"
}

jget() {
  local filter="$1"
  printf '%s' "$BODY" | jq -r "$filter" 2>/dev/null || echo ""
}

contains_header() {
  local pattern="$1"
  printf '%s' "$HEADERS" | grep -qi "$pattern"
}

server_ready() {
  req GET "$BASE_URL/login"
  [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "307" || "$HTTP_STATUS" == "308" ]]
}

prepare_upload_files() {
  UPLOAD_PNG="$(mktemp /tmp/spool-logo-XXXXXX.png)"
  UPLOAD_SVG="$(mktemp /tmp/spool-logo-XXXXXX.svg)"
  UPLOAD_PDF="$(mktemp /tmp/spool-file-XXXXXX.pdf)"
  UPLOAD_LARGE="$(mktemp /tmp/spool-large-XXXXXX.png)"

  # 1x1 transparent PNG
  printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W4d8AAAAASUVORK5CYII=' | b64dec > "$UPLOAD_PNG"

  cat > "$UPLOAD_SVG" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#111"/></svg>
SVG

  printf '%s\n' '%PDF-1.1 fake' > "$UPLOAD_PDF"

  dd if=/dev/zero of="$UPLOAD_LARGE" bs=1048576 count=6 >/dev/null 2>&1
}

cleanup() {
  # 删除 spool（优先）
  if [[ -n "$TOKEN" ]]; then
    for (( i=${#SPOOL_IDS[@]}-1; i>=0; i-- )); do
      auth_req DELETE "$BASE_URL/api/spools/${SPOOL_IDS[$i]}" >/dev/null 2>&1 || true
    done

    # 删除 location
    for (( i=${#LOC_IDS[@]}-1; i>=0; i-- )); do
      auth_req DELETE "$BASE_URL/api/locations/${LOC_IDS[$i]}" >/dev/null 2>&1 || true
    done

    # 删除 catalog
    for (( i=${#CAT_IDS[@]}-1; i>=0; i-- )); do
      auth_req DELETE "$BASE_URL/api/catalog/${CAT_IDS[$i]}" >/dev/null 2>&1 || true
    done
  fi

  rm -f "$UPLOAD_PNG" "$UPLOAD_SVG" "$UPLOAD_PDF" "$UPLOAD_LARGE" 2>/dev/null || true
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
# Smoke Tests (P0)
# -----------------------------------------------------------------------------

t_smk_001_login_ok() {
  req POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"$APP_PASSWORD\"}"

  TOKEN="$(jget '.token')"
  local exp
  exp="$(jget '.expiresAt')"

  if [[ "$HTTP_STATUS" != "200" || -z "$TOKEN" || "$TOKEN" == "null" || -z "$exp" || "$exp" == "null" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"
    return 1
  fi
  return 0
}

t_smk_002_no_token_catalog_401() {
  req GET "$BASE_URL/api/catalog"
  [[ "$HTTP_STATUS" == "401" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_smk_003_create_catalog() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"$BRAND_BASE\",\"material_type\":\"PLA\",\"material\":\"Matte\",\"color_name\":\"$COLOR_BASE\"}"

  CAT_MAIN="$(jget '.id')"
  if [[ "$HTTP_STATUS" != "201" || -z "$CAT_MAIN" || "$CAT_MAIN" == "null" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"
    return 1
  fi
  add_cat_id "$CAT_MAIN"
  return 0
}

t_smk_004_create_spool() {
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_MAIN\"}"

  SPOOL_MAIN="$(jget '.id')"
  local status
  status="$(jget '.status')"
  if [[ "$HTTP_STATUS" != "201" || "$status" != "ACTIVE" || -z "$SPOOL_MAIN" || "$SPOOL_MAIN" == "null" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS status=$status BODY=$BODY"
    return 1
  fi
  add_spool_id "$SPOOL_MAIN"
  return 0
}

t_smk_005_create_location() {
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"TC2_LOC_$RUN_ID\",\"type\":\"custom\"}"

  LOC_MAIN="$(jget '.id')"
  if [[ "$HTTP_STATUS" != "201" || -z "$LOC_MAIN" || "$LOC_MAIN" == "null" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"
    return 1
  fi
  add_loc_id "$LOC_MAIN"
  return 0
}

t_smk_006_patch_spool_location() {
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_MAIN" \
    -H "Content-Type: application/json" \
    -d "{\"location_id\":\"$LOC_MAIN\"}"

  local loc
  loc="$(jget '.location_id')"
  [[ "$HTTP_STATUS" == "200" && "$loc" == "$LOC_MAIN" ]] || {
    LAST_ERR="HTTP=$HTTP_STATUS location_id=$loc"
    return 1
  }
}

t_smk_007_patch_spool_empty() {
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_MAIN" \
    -H "Content-Type: application/json" \
    -d '{"status":"EMPTY"}'

  local status
  status="$(jget '.status')"
  [[ "$HTTP_STATUS" == "200" && "$status" == "EMPTY" ]] || {
    LAST_ERR="HTTP=$HTTP_STATUS status=$status"
    return 1
  }
}

t_smk_008_restock_create_new_spool() {
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_MAIN\"}"

  SPOOL_RESTOCK="$(jget '.id')"
  local status
  status="$(jget '.status')"
  if [[ "$HTTP_STATUS" != "201" || "$status" != "ACTIVE" || -z "$SPOOL_RESTOCK" || "$SPOOL_RESTOCK" == "null" || "$SPOOL_RESTOCK" == "$SPOOL_MAIN" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS status=$status id=$SPOOL_RESTOCK"
    return 1
  fi
  add_spool_id "$SPOOL_RESTOCK"
  return 0
}

t_smk_009_delete_location_unbind_spool() {
  auth_req DELETE "$BASE_URL/api/locations/$LOC_MAIN"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="DELETE location HTTP=$HTTP_STATUS"; return 1; }

  auth_req GET "$BASE_URL/api/spools/$SPOOL_MAIN"
  local loc
  loc="$(jget '.location_id')"
  [[ "$HTTP_STATUS" == "200" && "$loc" == "null" ]] || {
    LAST_ERR="GET spool HTTP=$HTTP_STATUS location_id=$loc"
    return 1
  }
}

t_smk_010_upload_logo() {
  auth_req POST "$BASE_URL/api/upload/logo" \
    -F "file=@$UPLOAD_SVG;type=image/svg+xml"

  UPLOADED_URL_SVG="$(jget '.url')"
  if [[ "$HTTP_STATUS" != "201" || -z "$UPLOADED_URL_SVG" || "$UPLOADED_URL_SVG" == "null" ]]; then
    LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"
    return 1
  fi

  req GET "$BASE_URL$UPLOADED_URL_SVG"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="GET logo HTTP=$HTTP_STATUS"; return 1; }
}

# -----------------------------------------------------------------------------
# Full Regression (P1/P2 API)
# -----------------------------------------------------------------------------

t_full_auth_001_wrong_password_401() {
  req POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"password":"wrong-password"}'
  [[ "$HTTP_STATUS" == "401" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_auth_002_invalid_token_401() {
  req GET "$BASE_URL/api/spools" \
    -H "Authorization: Bearer invalid.token" \
    --cookie "spool_tracker_token=invalid.token"
  [[ "$HTTP_STATUS" == "401" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_auth_003_logout_header() {
  req POST "$BASE_URL/api/auth/logout"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
  contains_header 'Set-Cookie: spool_tracker_token=;' || { LAST_ERR="Set-Cookie not found"; return 1; }
}

t_full_cat_001_missing_brand_400() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d '{"material_type":"PLA","color_name":"x"}'
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_002_missing_material_type_400() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"${BRAND_BASE}_M1\",\"color_name\":\"x\"}"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
}

t_full_cat_003_custom_sentinel_400() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"${BRAND_BASE}_M2\",\"material_type\":\"__custom\",\"color_name\":\"x\"}"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
}

t_full_cat_004_list_flat_200() {
  auth_req GET "$BASE_URL/api/catalog"
  local t
  t="$(jget '. | type')"
  [[ "$HTTP_STATUS" == "200" && "$t" == "array" ]] || { LAST_ERR="HTTP=$HTTP_STATUS type=$t"; return 1; }
}

t_full_cat_005_search_q_200() {
  auth_req GET "$BASE_URL/api/catalog?q=$(printf '%s' "$COLOR_BASE" | sed 's/ /%20/g')"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_006_group_brand_list_200() {
  auth_req GET "$BASE_URL/api/catalog?groupBy=brandList"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_007_group_brand_200() {
  auth_req GET "$BASE_URL/api/catalog?groupBy=brand"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_008_group_material_200() {
  auth_req GET "$BASE_URL/api/catalog?groupBy=material"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_009_group_material_type_missing_400() {
  auth_req GET "$BASE_URL/api/catalog?groupBy=materialType"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_010_group_material_type_200() {
  auth_req GET "$BASE_URL/api/catalog?groupBy=materialType&materialType=PLA"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_011_detail_200() {
  auth_req GET "$BASE_URL/api/catalog/$CAT_MAIN"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_012_detail_404() {
  auth_req GET "$BASE_URL/api/catalog/00000000-0000-0000-0000-000000000000"
  [[ "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_cat_013_patch_200() {
  auth_req PATCH "$BASE_URL/api/catalog/$CAT_MAIN" \
    -H "Content-Type: application/json" \
    -d '{"color_hex":"#112233"}'
  local c
  c="$(jget '.color_hex')"
  [[ "$HTTP_STATUS" == "200" && "$c" == "#112233" ]] || { LAST_ERR="HTTP=$HTTP_STATUS color_hex=$c"; return 1; }
}

t_full_cat_014_delete_linked_400() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"${BRAND_BASE}_LOCK\",\"material_type\":\"PETG\",\"material\":\"Basic\",\"color_name\":\"LOCK\"}"
  CAT_LOCKED="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$CAT_LOCKED" && "$CAT_LOCKED" != "null" ]] || { LAST_ERR="create locked catalog failed HTTP=$HTTP_STATUS"; return 1; }
  add_cat_id "$CAT_LOCKED"

  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_LOCKED\"}"
  SPOOL_LOCKED="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$SPOOL_LOCKED" && "$SPOOL_LOCKED" != "null" ]] || { LAST_ERR="create locked spool failed HTTP=$HTTP_STATUS"; return 1; }
  add_spool_id "$SPOOL_LOCKED"

  auth_req DELETE "$BASE_URL/api/catalog/$CAT_LOCKED"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
}

t_full_cat_015_delete_unlinked_200() {
  auth_req POST "$BASE_URL/api/catalog" \
    -H "Content-Type: application/json" \
    -d "{\"brand\":\"${BRAND_BASE}_TMP\",\"material_type\":\"ABS\",\"material\":\"Plus\",\"color_name\":\"TMP\"}"
  local tmp_id
  tmp_id="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$tmp_id" && "$tmp_id" != "null" ]] || { LAST_ERR="create tmp catalog failed HTTP=$HTTP_STATUS"; return 1; }

  auth_req DELETE "$BASE_URL/api/catalog/$tmp_id"
  local ok
  ok="$(jget '.success')"
  [[ "$HTTP_STATUS" == "200" && "$ok" == "true" ]] || { LAST_ERR="HTTP=$HTTP_STATUS success=$ok"; return 1; }
}

t_full_cat_016_brand_rename_post_200() {
  local new_brand
  new_brand="${BRAND_BASE}_RENAMED"
  auth_req POST "$BASE_URL/api/catalog/brand-rename" \
    -H "Content-Type: application/json" \
    -d "{\"oldBrand\":\"$BRAND_BASE\",\"newBrand\":\"$new_brand\"}"

  local updated
  updated="$(jget '.updated')"
  [[ "$HTTP_STATUS" == "200" && -n "$updated" && "$updated" != "null" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }

  # 更新后验
  auth_req GET "$BASE_URL/api/catalog?brand=$new_brand"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="verify rename HTTP=$HTTP_STATUS"; return 1; }
  BRAND_BASE="$new_brand"
}

t_full_cat_017_brand_rename_patch_405() {
  auth_req PATCH "$BASE_URL/api/catalog/brand-rename" \
    -H "Content-Type: application/json" \
    -d '{"oldBrand":"x","newBrand":"y"}'
  [[ "$HTTP_STATUS" == "405" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_spool_001_create_not_found_404() {
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d '{"global_filament_id":"00000000-0000-0000-0000-000000000000"}'
  [[ "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_spool_002_list_active_200() {
  auth_req GET "$BASE_URL/api/spools?status=ACTIVE"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_spool_003_list_empty_200() {
  auth_req GET "$BASE_URL/api/spools?status=EMPTY"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_spool_004_detail_404() {
  auth_req GET "$BASE_URL/api/spools/00000000-0000-0000-0000-000000000000"
  [[ "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_spool_005_clear_location_200() {
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_RESTOCK" \
    -H "Content-Type: application/json" \
    -d '{"location_id":null}'
  local loc
  loc="$(jget '.location_id')"
  [[ "$HTTP_STATUS" == "200" && "$loc" == "null" ]] || { LAST_ERR="HTTP=$HTTP_STATUS location_id=$loc"; return 1; }
}

t_full_spool_006_patch_non_whitelist_ignored() {
  auth_req GET "$BASE_URL/api/spools/$SPOOL_RESTOCK"
  local orig_gf orig_created
  orig_gf="$(jget '.global_filament_id')"
  orig_created="$(jget '.created_at')"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="pre GET failed HTTP=$HTTP_STATUS"; return 1; }

  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_RESTOCK" \
    -H "Content-Type: application/json" \
    -d '{"global_filament_id":"00000000-0000-0000-0000-000000000000","created_at":"2020-01-01T00:00:00.000Z"}'
  local ret_gf ret_created
  ret_gf="$(jget '.global_filament_id')"
  ret_created="$(jget '.created_at')"

  [[ "$HTTP_STATUS" == "200" && "$ret_gf" == "$orig_gf" && "$ret_created" == "$orig_created" ]] || {
    LAST_ERR="HTTP=$HTTP_STATUS gf=$ret_gf/$orig_gf created=$ret_created/$orig_created"
    return 1
  }
}

t_full_spool_007_patch_metadata_200() {
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_RESTOCK" \
    -H "Content-Type: application/json" \
    -d '{"metadata":"{\"note\":\"tc2\"}"}'
  local md
  md="$(jget '.metadata')"
  [[ "$HTTP_STATUS" == "200" && "$md" == '{"note":"tc2"}' ]] || { LAST_ERR="HTTP=$HTTP_STATUS metadata=$md"; return 1; }
}

t_full_spool_008_delete_200() {
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_MAIN\"}"
  local sid
  sid="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$sid" && "$sid" != "null" ]] || { LAST_ERR="create delete-target spool failed HTTP=$HTTP_STATUS"; return 1; }

  auth_req DELETE "$BASE_URL/api/spools/$sid"
  local ok
  ok="$(jget '.success')"
  [[ "$HTTP_STATUS" == "200" && "$ok" == "true" ]] || { LAST_ERR="HTTP=$HTTP_STATUS success=$ok"; return 1; }
}

t_full_loc_001_empty_name_400() {
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":""}'
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_loc_002_create_ams_201() {
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":"TC2 AMS","type":"ams_slot","printer_name":"X1C","ams_unit":"1","ams_slot":"2"}'
  LOC_AMS="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$LOC_AMS" && "$LOC_AMS" != "null" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
  add_loc_id "$LOC_AMS"
}

t_full_loc_003_create_ams_missing_400() {
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":"Bad AMS","type":"ams_slot","printer_name":"X1C"}'
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_loc_004_list_200() {
  auth_req GET "$BASE_URL/api/locations"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_loc_005_detail_200() {
  auth_req GET "$BASE_URL/api/locations/$LOC_AMS"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_loc_006_patch_basic_200() {
  auth_req PATCH "$BASE_URL/api/locations/$LOC_AMS" \
    -H "Content-Type: application/json" \
    -d '{"name":"TC2 AMS Renamed","type":"ams_slot","printer_name":"X1C","ams_unit":"1","ams_slot":"3"}'
  local slot
  slot="$(jget '.ams_slot')"
  [[ "$HTTP_STATUS" == "200" && "$slot" == "3" ]] || { LAST_ERR="HTTP=$HTTP_STATUS ams_slot=$slot"; return 1; }
}

t_full_loc_007_patch_ams_missing_400() {
  auth_req PATCH "$BASE_URL/api/locations/$LOC_AMS" \
    -H "Content-Type: application/json" \
    -d '{"type":"ams_slot","printer_name":"X1C"}'
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_loc_008_default_mutual_exclusion() {
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":"TC2 Default A","is_default":true}'
  LOC_DEFAULT_A="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$LOC_DEFAULT_A" && "$LOC_DEFAULT_A" != "null" ]] || { LAST_ERR="create A failed HTTP=$HTTP_STATUS"; return 1; }
  add_loc_id "$LOC_DEFAULT_A"

  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":"TC2 Default B","is_default":true}'
  LOC_DEFAULT_B="$(jget '.id')"
  [[ "$HTTP_STATUS" == "201" && -n "$LOC_DEFAULT_B" && "$LOC_DEFAULT_B" != "null" ]] || { LAST_ERR="create B failed HTTP=$HTTP_STATUS"; return 1; }
  add_loc_id "$LOC_DEFAULT_B"

  auth_req GET "$BASE_URL/api/locations/$LOC_DEFAULT_A"
  local a
  a="$(jget '.is_default')"
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="get A failed HTTP=$HTTP_STATUS"; return 1; }

  auth_req GET "$BASE_URL/api/locations/$LOC_DEFAULT_B"
  local b
  b="$(jget '.is_default')"
  [[ "$HTTP_STATUS" == "200" && "$a" == "false" && "$b" == "true" ]] || {
    LAST_ERR="A=$a B=$b"
    return 1
  }
}

t_full_loc_009_delete_not_found_404() {
  auth_req DELETE "$BASE_URL/api/locations/00000000-0000-0000-0000-000000000000"
  [[ "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_upload_001_png_201_and_get_200() {
  auth_req POST "$BASE_URL/api/upload/logo" \
    -F "file=@$UPLOAD_PNG;type=image/png"
  UPLOADED_URL_PNG="$(jget '.url')"
  [[ "$HTTP_STATUS" == "201" && -n "$UPLOADED_URL_PNG" && "$UPLOADED_URL_PNG" != "null" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }

  req GET "$BASE_URL$UPLOADED_URL_PNG"
  contains_header 'Content-Type: image/png' || {
    LAST_ERR="GET png HTTP=$HTTP_STATUS headers=$(printf '%s' "$HEADERS" | tr '\n' ' ')"
    return 1
  }
  [[ "$HTTP_STATUS" == "200" ]] || { LAST_ERR="GET png HTTP=$HTTP_STATUS"; return 1; }
}

t_full_upload_002_unsupported_type_400() {
  auth_req POST "$BASE_URL/api/upload/logo" \
    -F "file=@$UPLOAD_PDF;type=application/pdf"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
}

t_full_upload_003_oversize_400() {
  auth_req POST "$BASE_URL/api/upload/logo" \
    -F "file=@$UPLOAD_LARGE;type=image/png"
  [[ "$HTTP_STATUS" == "400" ]] || { LAST_ERR="HTTP=$HTTP_STATUS BODY=$BODY"; return 1; }
}

t_full_upload_004_path_traversal_blocked() {
  req GET "$BASE_URL/api/logos/../../../etc/passwd"
  [[ "$HTTP_STATUS" == "400" || "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

t_full_upload_005_nonexistent_404() {
  req GET "$BASE_URL/api/logos/nonexistent-tc2-file.png"
  [[ "$HTTP_STATUS" == "404" ]] || { LAST_ERR="HTTP=$HTTP_STATUS"; return 1; }
}

run_smoke_suite() {
  log_section "P0 冒烟集"
  run_test "SMK-001" "正确密码登录" t_smk_001_login_ok
  run_test "SMK-002" "无 token 访问受保护 API" t_smk_002_no_token_catalog_401
  run_test "SMK-003" "创建 Catalog（含 material_type）" t_smk_003_create_catalog
  run_test "SMK-004" "基于 Catalog 创建 Spool" t_smk_004_create_spool
  run_test "SMK-005" "创建 Location（custom）" t_smk_005_create_location
  run_test "SMK-006" "PATCH Spool 位置" t_smk_006_patch_spool_location
  run_test "SMK-007" "PATCH Spool 状态 EMPTY" t_smk_007_patch_spool_empty
  run_test "SMK-008" "重新创建 ACTIVE Spool" t_smk_008_restock_create_new_spool
  run_test "SMK-009" "删除 Location 解绑 Spool" t_smk_009_delete_location_unbind_spool
  run_test "SMK-010" "上传合法 Logo" t_smk_010_upload_logo
}

run_full_suite() {
  log_section "扩展回归（P1/P2 API）"
  run_test "AUTH-011" "错误密码返回 401" t_full_auth_001_wrong_password_401
  run_test "AUTH-012" "无效 token 返回 401" t_full_auth_002_invalid_token_401
  run_test "AUTH-013" "logout 返回清 cookie header" t_full_auth_003_logout_header

  run_test "CAT-021" "缺少 brand 返回 400" t_full_cat_001_missing_brand_400
  run_test "CAT-022" "缺少 material_type 返回 400" t_full_cat_002_missing_material_type_400
  run_test "CAT-023" "material_type=__custom 返回 400" t_full_cat_003_custom_sentinel_400
  run_test "CAT-024" "catalog 扁平列表" t_full_cat_004_list_flat_200
  run_test "CAT-025" "catalog 关键词查询" t_full_cat_005_search_q_200
  run_test "CAT-026" "groupBy=brandList" t_full_cat_006_group_brand_list_200
  run_test "CAT-027" "groupBy=brand" t_full_cat_007_group_brand_200
  run_test "CAT-028" "groupBy=material" t_full_cat_008_group_material_200
  run_test "CAT-029" "groupBy=materialType 缺参数" t_full_cat_009_group_material_type_missing_400
  run_test "CAT-030" "groupBy=materialType 有参数" t_full_cat_010_group_material_type_200
  run_test "CAT-031" "catalog 详情存在" t_full_cat_011_detail_200
  run_test "CAT-032" "catalog 详情不存在" t_full_cat_012_detail_404
  run_test "CAT-033" "catalog PATCH" t_full_cat_013_patch_200
  run_test "CAT-034" "catalog 删除有关联拒绝" t_full_cat_014_delete_linked_400
  run_test "CAT-035" "catalog 删除无关联成功" t_full_cat_015_delete_unlinked_200
  run_test "CAT-036" "brand-rename POST" t_full_cat_016_brand_rename_post_200
  run_test "CAT-037" "brand-rename PATCH=405" t_full_cat_017_brand_rename_patch_405

  run_test "SPOOL-021" "spool 创建不存在字典=404" t_full_spool_001_create_not_found_404
  run_test "SPOOL-022" "spool ACTIVE 列表" t_full_spool_002_list_active_200
  run_test "SPOOL-023" "spool EMPTY 列表" t_full_spool_003_list_empty_200
  run_test "SPOOL-024" "spool 详情不存在=404" t_full_spool_004_detail_404
  run_test "SPOOL-025" "spool 清空位置" t_full_spool_005_clear_location_200
  run_test "SPOOL-026" "spool 非白名单字段忽略" t_full_spool_006_patch_non_whitelist_ignored
  run_test "SPOOL-027" "spool metadata 更新" t_full_spool_007_patch_metadata_200
  run_test "SPOOL-028" "spool DELETE" t_full_spool_008_delete_200

  run_test "LOC-021" "location 空名称=400" t_full_loc_001_empty_name_400
  run_test "LOC-022" "location 创建 AMS" t_full_loc_002_create_ams_201
  run_test "LOC-023" "location AMS 缺字段=400" t_full_loc_003_create_ams_missing_400
  run_test "LOC-024" "location 列表" t_full_loc_004_list_200
  run_test "LOC-025" "location 详情" t_full_loc_005_detail_200
  run_test "LOC-026" "location PATCH 基础字段" t_full_loc_006_patch_basic_200
  run_test "LOC-027" "location PATCH AMS 缺字段=400" t_full_loc_007_patch_ams_missing_400
  run_test "LOC-028" "location 默认互斥" t_full_loc_008_default_mutual_exclusion
  run_test "LOC-029" "location 删除不存在=404" t_full_loc_009_delete_not_found_404

  run_test "UP-021" "上传 PNG 并读取" t_full_upload_001_png_201_and_get_200
  run_test "UP-022" "上传不支持类型=400" t_full_upload_002_unsupported_type_400
  run_test "UP-023" "上传超大文件=400" t_full_upload_003_oversize_400
  run_test "UP-024" "logos 路径穿越防护" t_full_upload_004_path_traversal_blocked
  run_test "UP-025" "logos 不存在文件=404" t_full_upload_005_nonexistent_404
}

print_summary_and_exit() {
  log_section "测试汇总"
  printf "  通过: ${GREEN}%d${NC}\n" "$PASS"
  printf "  失败: ${RED}%d${NC}\n" "$FAIL"
  printf "  跳过: ${YELLOW}%d${NC}\n" "$SKIP"

  if [[ "$FAIL" -gt 0 ]]; then
    exit 1
  fi
}

main() {
  require_bin curl
  require_bin jq

  prepare_upload_files

  if ! server_ready; then
    printf "${RED}服务不可用: %s${NC}\n" "$BASE_URL"
    printf "请先运行: npm run dev\n"
    exit 1
  fi

  printf "${BOLD}Base URL:${NC} %s\n" "$BASE_URL"
  printf "${BOLD}Suite:${NC} %s\n" "$SUITE"

  run_smoke_suite

  if [[ "$SUITE" == "full" ]]; then
    run_full_suite
  else
    skip "FULL" "未执行（使用 --full 可运行完整回归）"
  fi

  print_summary_and_exit
}

main
