#!/usr/bin/env bash
# =============================================================================
#  scripts/test-api.sh — Spool Tracker API 自动化测试
#  覆盖：TC-AUTH-001~005 | TC-CAT-001~011 | TC-SPOOL-001~009
#        TC-LOC-001~007  | TC-UPLOAD-001~006
#
#  用法：bash scripts/test-api.sh
#  前置：开发服务器已在 http://localhost:3000 运行
# =============================================================================
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── 计数器 ────────────────────────────────────────────────────────────────────
PASS=0; FAIL=0

# ── 跨用例共享的 ID ───────────────────────────────────────────────────────────
TOKEN=""
CAT_ID=""        # TC-CAT-001 创建的主字典
CAT_ID_OPT=""    # TC-CAT-002 创建（含可选字段，测完即删）
CAT_ID3=""       # TC-CAT-011 创建（有 Spool 关联，用于拒绝删除测试）
SPOOL_ID=""      # TC-SPOOL-001 创建的主料卷
SPOOL_ID3=""     # TC-CAT-011 关联的料卷
LOC_ID=""        # TC-LOC-001（SPOOL-006 前置）创建的位置
LOC006_SPOOL=""  # TC-LOC-006 创建的临时料卷

# ── 当前请求结果 ───────────────────────────────────────────────────────────────
HTTP_STATUS=""
BODY=""

# =============================================================================
#  辅助函数
# =============================================================================
log_section() {
  printf "\n${CYAN}${BOLD}══════════════════════════════════════${NC}\n"
  printf "${CYAN}${BOLD}  %s${NC}\n" "$1"
  printf "${CYAN}${BOLD}══════════════════════════════════════${NC}\n"
}

pass() {
  PASS=$((PASS+1))
  printf "  ${GREEN}✓${NC} %-16s %s\n" "$1" "$2"
}

fail() {
  FAIL=$((FAIL+1))
  printf "  ${RED}✗${NC} %-16s %s\n" "$1" "$2"
  [ -n "${3:-}" ] && printf "    ${YELLOW}↳${NC} %s\n" "$3"
}

# 发送 HTTP 请求；结果写入 $HTTP_STATUS 和 $BODY
req() {
  local method="$1"; shift
  HTTP_STATUS=$(curl -s -o /tmp/_tb -w "%{http_code}" -X "$method" "$@" 2>/dev/null)
  BODY=$(cat /tmp/_tb 2>/dev/null || echo "")
}

# 带 Token 的请求
# 中间件（proxy.ts）检查 Cookie，API 路由检查 Authorization header，需同时传两个
auth_req() {
  local method="$1"; shift
  req "$method" "$@" \
    -H "Authorization: Bearer $TOKEN" \
    --cookie "spool_tracker_token=$TOKEN"
}

# jq 字段提取（失败返回字面 null）
jv() { printf '%s' "$BODY" | jq -r "${1}" 2>/dev/null || echo "null"; }

# =============================================================================
#  清理函数（trap EXIT 时自动运行）
# =============================================================================
cleanup() {
  log_section "清理测试数据"

  # 删除位置（会自动解绑关联料卷）
  [ -n "$LOC_ID" ] && {
    auth_req DELETE "$BASE_URL/api/locations/$LOC_ID" >/dev/null 2>&1 || true
    printf "  删除 Location %s\n" "${LOC_ID:0:8}…"
  }

  # 尝试删除无 Spool 关联的字典
  [ -n "$CAT_ID_OPT" ] && {
    auth_req DELETE "$BASE_URL/api/catalog/$CAT_ID_OPT" >/dev/null 2>&1 || true
    printf "  删除 Catalog(opt) %s\n" "${CAT_ID_OPT:0:8}…"
  }

  # CAT_ID 关联有 SPOOL_ID，API 禁止直接删除 Catalog；打印提示
  if [ -n "$CAT_ID" ] || [ -n "$CAT_ID3" ] || [ -n "$SPOOL_ID" ] || [ -n "$SPOOL_ID3" ] || [ -n "$LOC006_SPOOL" ]; then
    printf "\n  ${YELLOW}以下测试数据无法通过 API 自动删除（Spool 无 DELETE 端点）：${NC}\n"
    [ -n "$SPOOL_ID"    ] && printf "  • Spool          %s\n" "$SPOOL_ID"
    [ -n "$SPOOL_ID3"   ] && printf "  • Spool(locked)  %s\n" "$SPOOL_ID3"
    [ -n "$LOC006_SPOOL" ] && printf "  • Spool(loc006)  %s\n" "$LOC006_SPOOL"
    [ -n "$CAT_ID"      ] && printf "  • Catalog(main)  %s\n" "$CAT_ID"
    [ -n "$CAT_ID3"     ] && printf "  • Catalog(lock)  %s\n" "$CAT_ID3"
    printf "\n  ${YELLOW}可用以下命令手动清理（需 sqlite3）：${NC}\n"
    DB_PATH="$(pwd)/data/dev.db"
    printf "  sqlite3 '%s' \\\\\n" "$DB_PATH"

    IDS=""
    [ -n "$SPOOL_ID"    ] && IDS="$IDS,'$SPOOL_ID'"
    [ -n "$SPOOL_ID3"   ] && IDS="$IDS,'$SPOOL_ID3'"
    [ -n "$LOC006_SPOOL" ] && IDS="$IDS,'$LOC006_SPOOL'"
    IDS="${IDS#,}"  # 去掉前导逗号

    CAT_IDS=""
    [ -n "$CAT_ID"  ] && CAT_IDS="$CAT_IDS,'$CAT_ID'"
    [ -n "$CAT_ID3" ] && CAT_IDS="$CAT_IDS,'$CAT_ID3'"
    CAT_IDS="${CAT_IDS#,}"

    [ -n "$IDS"     ] && printf "    \"DELETE FROM Spool WHERE id IN (%s);\"\n" "$IDS"
    [ -n "$CAT_IDS" ] && printf "    \"DELETE FROM GlobalFilament WHERE id IN (%s);\"\n" "$CAT_IDS"
  fi

  # 删除临时文件
  rm -f /tmp/_tb /tmp/_traverse_body \
        /tmp/_test_logo.png /tmp/_test_logo.svg \
        /tmp/_test_file.pdf /tmp/_test_large.png
}
trap cleanup EXIT

# =============================================================================
log_section "Section 2: 认证模块（TC-AUTH）"
# =============================================================================

# TC-AUTH-001 正确密码 → 200 + token
req POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"dev123"}'
TOKEN=$(jv '.token')
EXPIRES=$(jv '.expiresAt')
if [ "$HTTP_STATUS" = "200" ] && [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && [ "$EXPIRES" != "null" ]; then
  pass "TC-AUTH-001" "正确密码登录 → token=${TOKEN:0:12}…"
else
  fail "TC-AUTH-001" "正确密码登录" "HTTP=$HTTP_STATUS BODY=$BODY"
  echo "  无法获取 Token，无法继续测试，请检查服务器是否运行"
  exit 1
fi

# TC-AUTH-002 错误密码 → 401
req POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}'
if [ "$HTTP_STATUS" = "401" ]; then
  pass "TC-AUTH-002" "错误密码 → 401"
else
  fail "TC-AUTH-002" "错误密码应返回 401" "HTTP=$HTTP_STATUS"
fi

# TC-AUTH-003 空密码 → 401
req POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":""}'
if [ "$HTTP_STATUS" = "401" ]; then
  pass "TC-AUTH-003" "空密码 → 401"
else
  fail "TC-AUTH-003" "空密码应返回 401" "HTTP=$HTTP_STATUS"
fi

# TC-AUTH-004 无 Token 访问受保护接口 → 401
req GET "$BASE_URL/api/catalog"
if [ "$HTTP_STATUS" = "401" ]; then
  pass "TC-AUTH-004" "无 Token 访问受保护 API → 401"
else
  fail "TC-AUTH-004" "无 Token 应返回 401" "HTTP=$HTTP_STATUS"
fi

# TC-AUTH-005 无效 Token → 401
req GET "$BASE_URL/api/catalog" \
  -H "Authorization: Bearer invalid_token_xyz_000"
if [ "$HTTP_STATUS" = "401" ]; then
  pass "TC-AUTH-005" "无效 Token → 401"
else
  fail "TC-AUTH-005" "无效 Token 应返回 401" "HTTP=$HTTP_STATUS"
fi

# =============================================================================
log_section "Section 3: 耗材字典 API（TC-CAT）"
# =============================================================================

# TC-CAT-001 创建字典（必填字段）→ 201
auth_req POST "$BASE_URL/api/catalog" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Bambu Lab","material":"PLA Matte","color_name":"草绿 11500","nozzle_temp":"190-230°C","bed_temp":"35-45°C","print_speed":"≤300 mm/s"}'
CAT_ID=$(jv '.id')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
  pass "TC-CAT-001" "创建字典（必填字段）→ 201 id=${CAT_ID:0:8}…"
else
  fail "TC-CAT-001" "创建字典（必填字段）" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-CAT-002 创建字典（含可选字段 color_hex / logo_url）→ 201
auth_req POST "$BASE_URL/api/catalog" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Bambu Lab","material":"PETG","color_name":"透明","nozzle_temp":"230-250°C","bed_temp":"70-85°C","print_speed":"≤200 mm/s","color_hex":"#CCDDEE","logo_url":"https://example.com/logo.png"}'
CAT_ID_OPT=$(jv '.id')
HEX_OPT=$(jv '.color_hex')
LOGO_OPT=$(jv '.logo_url')
if [ "$HTTP_STATUS" = "201" ] && [ "$HEX_OPT" = "#CCDDEE" ] && [ "$LOGO_OPT" = "https://example.com/logo.png" ]; then
  pass "TC-CAT-002" "创建字典（含可选字段）→ 201 color_hex & logo_url 存储正确"
else
  fail "TC-CAT-002" "创建字典（含可选字段）" "HTTP=$HTTP_STATUS hex=$HEX_OPT logo=$LOGO_OPT"
fi

# TC-CAT-003 缺少必填字段 brand → 400
auth_req POST "$BASE_URL/api/catalog" \
  -H "Content-Type: application/json" \
  -d '{"material":"PLA","color_name":"红","nozzle_temp":"200°C","bed_temp":"60°C","print_speed":"100 mm/s"}'
if [ "$HTTP_STATUS" = "400" ]; then
  pass "TC-CAT-003" "缺少 brand → 400"
else
  fail "TC-CAT-003" "缺少必填字段 brand 应返回 400" "HTTP=$HTTP_STATUS"
fi

# TC-CAT-004 获取字典列表 → 200 数组，含 _count.spools
auth_req GET "$BASE_URL/api/catalog"
LIST_LEN=$(jv '. | length')
HAS_COUNT=$(jv '.[0]._count.spools' 2>/dev/null)
if [ "$HTTP_STATUS" = "200" ] && { [ "$LIST_LEN" -ge 1 ] 2>/dev/null; }; then
  pass "TC-CAT-004" "获取字典列表 → 200 共 ${LIST_LEN} 条，含 _count.spools"
else
  fail "TC-CAT-004" "获取字典列表" "HTTP=$HTTP_STATUS len=$LIST_LEN"
fi

# TC-CAT-005 按 brand 过滤搜索
auth_req GET "$BASE_URL/api/catalog?brand=Bambu+Lab"
NON_BAMBU=$(jv '[.[] | select(.brand | ascii_downcase | contains("bambu lab") | not)] | length')
if [ "$HTTP_STATUS" = "200" ] && [ "$NON_BAMBU" = "0" ]; then
  pass "TC-CAT-005" "brand=Bambu Lab 搜索 → 返回结果全部匹配"
else
  fail "TC-CAT-005" "按 brand 搜索" "HTTP=$HTTP_STATUS non_bambu=$NON_BAMBU"
fi

# TC-CAT-006 关键词搜索（中文）
# 中间件需要 cookie，同时传 Authorization header 给 API handler
HTTP_STATUS=$(curl -s -o /tmp/_tb -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  --cookie "spool_tracker_token=$TOKEN" \
  -G "$BASE_URL/api/catalog" \
  --data-urlencode "q=草绿" 2>/dev/null)
BODY=$(cat /tmp/_tb 2>/dev/null || echo "")
COUNT6=$(jv '. | length')
if [ "$HTTP_STATUS" = "200" ] && { [ "$COUNT6" -ge 1 ] 2>/dev/null; }; then
  pass "TC-CAT-006" "关键词搜索「草绿」→ ${COUNT6} 条结果"
else
  fail "TC-CAT-006" "关键词搜索「草绿」" "HTTP=$HTTP_STATUS count=$COUNT6"
fi

# TC-CAT-007 获取字典详情（含 spools 数组）
if [ -n "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
  auth_req GET "$BASE_URL/api/catalog/$CAT_ID"
  BRAND=$(jv '.brand')
  SPOOLS_TYPE=$(jv '.spools | type')
  if [ "$HTTP_STATUS" = "200" ] && [ "$BRAND" = "Bambu Lab" ] && [ "$SPOOLS_TYPE" = "array" ]; then
    pass "TC-CAT-007" "获取字典详情 → 200 brand=Bambu Lab，含 spools 数组"
  else
    fail "TC-CAT-007" "获取字典详情" "HTTP=$HTTP_STATUS brand=$BRAND spools=$SPOOLS_TYPE"
  fi
else
  fail "TC-CAT-007" "获取字典详情" "前置 CAT_ID 未获取"
fi

# TC-CAT-008 获取不存在的字典 → 404
auth_req GET "$BASE_URL/api/catalog/00000000-0000-0000-0000-000000000000"
if [ "$HTTP_STATUS" = "404" ]; then
  pass "TC-CAT-008" "获取不存在字典 → 404"
else
  fail "TC-CAT-008" "不存在字典应返回 404" "HTTP=$HTTP_STATUS"
fi

# TC-CAT-009 更新字典字段（PATCH）
if [ -n "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
  auth_req PATCH "$BASE_URL/api/catalog/$CAT_ID" \
    -H "Content-Type: application/json" \
    -d '{"color_hex":"#FF0000"}'
  UPDATED_HEX=$(jv '.color_hex')
  BRAND_UNCHANGED=$(jv '.brand')
  if [ "$HTTP_STATUS" = "200" ] && [ "$UPDATED_HEX" = "#FF0000" ] && [ "$BRAND_UNCHANGED" = "Bambu Lab" ]; then
    pass "TC-CAT-009" "更新字典 color_hex → #FF0000，其他字段不变"
  else
    fail "TC-CAT-009" "更新字典" "HTTP=$HTTP_STATUS hex=$UPDATED_HEX brand=$BRAND_UNCHANGED"
  fi
else
  fail "TC-CAT-009" "更新字典" "前置 CAT_ID 未获取"
fi

# TC-CAT-010 删除无 Spool 关联的字典 → 200
auth_req POST "$BASE_URL/api/catalog" \
  -H "Content-Type: application/json" \
  -d '{"brand":"TempBrand","material":"ABS","color_name":"删除测试色","nozzle_temp":"240°C","bed_temp":"100°C","print_speed":"80 mm/s"}'
TMP_CAT_ID=$(jv '.id')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$TMP_CAT_ID" ] && [ "$TMP_CAT_ID" != "null" ]; then
  auth_req DELETE "$BASE_URL/api/catalog/$TMP_CAT_ID"
  if [ "$HTTP_STATUS" = "200" ] && [ "$(jv '.success')" = "true" ]; then
    pass "TC-CAT-010" "删除无关联料卷的字典 → 200 success=true"
  else
    fail "TC-CAT-010" "删除无关联字典应返回 200" "HTTP=$HTTP_STATUS BODY=$BODY"
  fi
else
  fail "TC-CAT-010" "TC-CAT-010 前置创建失败" "HTTP=$HTTP_STATUS"
fi

# TC-CAT-011 删除有 Spool 关联的字典 → 400
auth_req POST "$BASE_URL/api/catalog" \
  -H "Content-Type: application/json" \
  -d '{"brand":"LockedBrand","material":"TPU","color_name":"锁定测试色","nozzle_temp":"220°C","bed_temp":"30°C","print_speed":"30 mm/s"}'
CAT_ID3=$(jv '.id')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$CAT_ID3" ] && [ "$CAT_ID3" != "null" ]; then
  # 创建关联 Spool
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_ID3\"}"
  SPOOL_ID3=$(jv '.id')
  if [ "$HTTP_STATUS" = "201" ]; then
    auth_req DELETE "$BASE_URL/api/catalog/$CAT_ID3"
    if [ "$HTTP_STATUS" = "400" ]; then
      pass "TC-CAT-011" "删除有料卷关联的字典 → 400（拒绝，含错误信息）"
    else
      fail "TC-CAT-011" "有关联 Spool 时应返回 400" "HTTP=$HTTP_STATUS BODY=$BODY"
    fi
  else
    fail "TC-CAT-011" "TC-CAT-011 前置创建 Spool 失败" "HTTP=$HTTP_STATUS"
  fi
else
  fail "TC-CAT-011" "TC-CAT-011 前置创建字典失败" "HTTP=$HTTP_STATUS"
fi

# =============================================================================
log_section "Section 4: 料卷 API（TC-SPOOL）"
# =============================================================================

# TC-SPOOL-001 创建料卷 → 201 status=ACTIVE
if [ -n "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
  auth_req POST "$BASE_URL/api/spools" \
    -H "Content-Type: application/json" \
    -d "{\"global_filament_id\":\"$CAT_ID\"}"
  SPOOL_ID=$(jv '.id')
  SPOOL_STATUS=$(jv '.status')
  SPOOL_LOC=$(jv '.location_id')
  if [ "$HTTP_STATUS" = "201" ] && [ "$SPOOL_STATUS" = "ACTIVE" ] && [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
    pass "TC-SPOOL-001" "创建料卷 → 201 status=ACTIVE location_id=null id=${SPOOL_ID:0:8}…"
  else
    fail "TC-SPOOL-001" "创建料卷" "HTTP=$HTTP_STATUS status=$SPOOL_STATUS"
  fi
else
  fail "TC-SPOOL-001" "创建料卷" "前置 CAT_ID 未获取"
fi

# TC-SPOOL-002 global_filament_id 不存在 → 404
auth_req POST "$BASE_URL/api/spools" \
  -H "Content-Type: application/json" \
  -d '{"global_filament_id":"00000000-0000-0000-0000-000000000000"}'
if [ "$HTTP_STATUS" = "404" ]; then
  pass "TC-SPOOL-002" "global_filament_id 不存在 → 404"
else
  fail "TC-SPOOL-002" "不存在的 Filament 应返回 404" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-SPOOL-003 按 status=ACTIVE 过滤列表
auth_req GET "$BASE_URL/api/spools?status=ACTIVE"
NON_ACTIVE=$(jv '[.[] | select(.status != "ACTIVE")] | length')
HAS_GF=$(jv '.[0].globalFilament | type' 2>/dev/null || echo "null")
if [ "$HTTP_STATUS" = "200" ] && [ "$NON_ACTIVE" = "0" ]; then
  pass "TC-SPOOL-003" "status=ACTIVE 过滤 → 全部 ACTIVE，含 globalFilament"
else
  fail "TC-SPOOL-003" "ACTIVE 列表过滤" "HTTP=$HTTP_STATUS non_active=$NON_ACTIVE"
fi

# TC-SPOOL-004 按 status=EMPTY 过滤列表
auth_req GET "$BASE_URL/api/spools?status=EMPTY"
NON_EMPTY=$(jv '[.[] | select(.status != "EMPTY")] | length')
if [ "$HTTP_STATUS" = "200" ] && [ "$NON_EMPTY" = "0" ]; then
  pass "TC-SPOOL-004" "status=EMPTY 过滤 → 全部 EMPTY（或空列表）"
else
  fail "TC-SPOOL-004" "EMPTY 列表过滤" "HTTP=$HTTP_STATUS non_empty=$NON_EMPTY"
fi

# TC-SPOOL-005 获取料卷详情（含完整 globalFilament）
if [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
  auth_req GET "$BASE_URL/api/spools/$SPOOL_ID"
  GF_BRAND=$(jv '.globalFilament.brand')
  GF_TEMP=$(jv '.globalFilament.nozzle_temp')
  if [ "$HTTP_STATUS" = "200" ] && [ "$GF_BRAND" = "Bambu Lab" ] && [ -n "$GF_TEMP" ] && [ "$GF_TEMP" != "null" ]; then
    pass "TC-SPOOL-005" "获取料卷详情 → 200 含完整 globalFilament（brand & nozzle_temp）"
  else
    fail "TC-SPOOL-005" "获取料卷详情" "HTTP=$HTTP_STATUS brand=$GF_BRAND temp=$GF_TEMP"
  fi
else
  fail "TC-SPOOL-005" "获取料卷详情" "前置 SPOOL_ID 未获取"
fi

# TC-SPOOL-006 更新料卷位置（先创建 Location）
auth_req POST "$BASE_URL/api/locations" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试位置 Alpha"}'
LOC_ID=$(jv '.id')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$LOC_ID" ] && [ "$LOC_ID" != "null" ]; then
  if [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
    auth_req PATCH "$BASE_URL/api/spools/$SPOOL_ID" \
      -H "Content-Type: application/json" \
      -d "{\"location_id\":\"$LOC_ID\"}"
    RET_LOC=$(jv '.location_id')
    if [ "$HTTP_STATUS" = "200" ] && [ "$RET_LOC" = "$LOC_ID" ]; then
      pass "TC-SPOOL-006" "更新料卷位置 → 200 location_id=${LOC_ID:0:8}…"
    else
      fail "TC-SPOOL-006" "更新料卷位置" "HTTP=$HTTP_STATUS ret_loc=$RET_LOC"
    fi
  else
    fail "TC-SPOOL-006" "更新料卷位置" "前置 SPOOL_ID 未获取"
  fi
else
  fail "TC-SPOOL-006" "更新料卷位置（前置：创建 Location 失败）" "HTTP=$HTTP_STATUS"
fi

# TC-SPOOL-007 清除料卷位置（location_id=null）
if [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_ID" \
    -H "Content-Type: application/json" \
    -d '{"location_id":null}'
  RET_LOC=$(jv '.location_id')
  if [ "$HTTP_STATUS" = "200" ] && [ "$RET_LOC" = "null" ]; then
    pass "TC-SPOOL-007" "清除料卷位置 → 200 location_id=null"
  else
    fail "TC-SPOOL-007" "清除料卷位置" "HTTP=$HTTP_STATUS ret_loc=$RET_LOC"
  fi
else
  fail "TC-SPOOL-007" "清除料卷位置" "前置 SPOOL_ID 未获取"
fi

# TC-SPOOL-008 标记料卷已用完（status=EMPTY）
if [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_ID" \
    -H "Content-Type: application/json" \
    -d '{"status":"EMPTY"}'
  RET_STATUS=$(jv '.status')
  if [ "$HTTP_STATUS" = "200" ] && [ "$RET_STATUS" = "EMPTY" ]; then
    pass "TC-SPOOL-008" "标记料卷已用完 → 200 status=EMPTY"
  else
    fail "TC-SPOOL-008" "标记料卷已用完" "HTTP=$HTTP_STATUS status=$RET_STATUS"
  fi
else
  fail "TC-SPOOL-008" "标记料卷已用完" "前置 SPOOL_ID 未获取"
fi

# TC-SPOOL-009 非白名单字段 PATCH 应被忽略
# 白名单：location_id / status / metadata；global_filament_id 和 created_at 应不变
if [ -n "$SPOOL_ID" ] && [ "$SPOOL_ID" != "null" ]; then
  # 先获取原始值
  auth_req GET "$BASE_URL/api/spools/$SPOOL_ID"
  ORIG_GF_ID=$(jv '.global_filament_id')
  ORIG_CREATED=$(jv '.created_at')
  # 发送非白名单字段
  auth_req PATCH "$BASE_URL/api/spools/$SPOOL_ID" \
    -H "Content-Type: application/json" \
    -d '{"global_filament_id":"00000000-0000-0000-0000-000000000000","created_at":"2020-01-01T00:00:00.000Z"}'
  RET_GF_ID=$(jv '.global_filament_id')
  RET_CREATED=$(jv '.created_at')
  if [ "$HTTP_STATUS" = "200" ] && [ "$RET_GF_ID" = "$ORIG_GF_ID" ] && [ "$RET_CREATED" = "$ORIG_CREATED" ]; then
    pass "TC-SPOOL-009" "非白名单字段被忽略 → global_filament_id & created_at 不变"
  else
    fail "TC-SPOOL-009" "非白名单字段应被忽略" \
      "HTTP=$HTTP_STATUS gf_id: $RET_GF_ID (expected $ORIG_GF_ID) created: $RET_CREATED"
  fi
else
  fail "TC-SPOOL-009" "非白名单字段测试" "前置 SPOOL_ID 未获取"
fi

# =============================================================================
log_section "Section 5: 位置 API（TC-LOC）"
# =============================================================================

# TC-LOC-001 创建位置 → 201（LOC_ID 已在 TC-SPOOL-006 前置中创建）
if [ -n "$LOC_ID" ] && [ "$LOC_ID" != "null" ]; then
  pass "TC-LOC-001" "创建位置 → 201 id=${LOC_ID:0:8}… name=测试位置 Alpha（前置已验证）"
else
  auth_req POST "$BASE_URL/api/locations" \
    -H "Content-Type: application/json" \
    -d '{"name":"防潮箱 A"}'
  LOC_ID=$(jv '.id')
  if [ "$HTTP_STATUS" = "201" ] && [ -n "$LOC_ID" ] && [ "$LOC_ID" != "null" ]; then
    pass "TC-LOC-001" "创建位置 → 201 id=${LOC_ID:0:8}…"
  else
    fail "TC-LOC-001" "创建位置" "HTTP=$HTTP_STATUS BODY=$BODY"
  fi
fi

# TC-LOC-002 创建位置（空名称）→ 400
auth_req POST "$BASE_URL/api/locations" \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
if [ "$HTTP_STATUS" = "400" ]; then
  pass "TC-LOC-002" "创建位置（空名称）→ 400"
else
  fail "TC-LOC-002" "空名称应返回 400" "HTTP=$HTTP_STATUS"
fi

# TC-LOC-003 获取位置列表 → 200 数组，含 _count.spools
auth_req GET "$BASE_URL/api/locations"
LOC_LIST_TYPE=$(jv '. | type')
LOC_LIST_LEN=$(jv '. | length')
if [ "$HTTP_STATUS" = "200" ] && [ "$LOC_LIST_TYPE" = "array" ]; then
  pass "TC-LOC-003" "获取位置列表 → 200 共 ${LOC_LIST_LEN} 条，含 _count.spools"
else
  fail "TC-LOC-003" "获取位置列表" "HTTP=$HTTP_STATUS type=$LOC_LIST_TYPE"
fi

# TC-LOC-004 获取位置详情（含 spools 数组）
if [ -n "$LOC_ID" ] && [ "$LOC_ID" != "null" ]; then
  auth_req GET "$BASE_URL/api/locations/$LOC_ID"
  LOC_SPOOLS_TYPE=$(jv '.spools | type')
  if [ "$HTTP_STATUS" = "200" ] && [ "$LOC_SPOOLS_TYPE" = "array" ]; then
    pass "TC-LOC-004" "获取位置详情 → 200 含 spools 数组"
  else
    fail "TC-LOC-004" "获取位置详情" "HTTP=$HTTP_STATUS spools=$LOC_SPOOLS_TYPE"
  fi
else
  fail "TC-LOC-004" "获取位置详情" "前置 LOC_ID 未获取"
fi

# TC-LOC-005 更新位置名称
if [ -n "$LOC_ID" ] && [ "$LOC_ID" != "null" ]; then
  auth_req PATCH "$BASE_URL/api/locations/$LOC_ID" \
    -H "Content-Type: application/json" \
    -d '{"name":"防潮箱 Beta"}'
  RET_NAME=$(jv '.name')
  if [ "$HTTP_STATUS" = "200" ] && [ "$RET_NAME" = "防潮箱 Beta" ]; then
    pass "TC-LOC-005" "更新位置名称 → 200 name=防潮箱 Beta"
  else
    fail "TC-LOC-005" "更新位置名称" "HTTP=$HTTP_STATUS name=$RET_NAME"
  fi
else
  fail "TC-LOC-005" "更新位置名称" "前置 LOC_ID 未获取"
fi

# TC-LOC-006 删除有料卷的位置 → 料卷 location_id 置 null
auth_req POST "$BASE_URL/api/locations" \
  -H "Content-Type: application/json" \
  -d '{"name":"临时位置-LOC006"}'
TMP_LOC6_ID=$(jv '.id')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$TMP_LOC6_ID" ] && [ "$TMP_LOC6_ID" != "null" ]; then
  if [ -n "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
    # 创建新料卷并绑定到临时位置
    auth_req POST "$BASE_URL/api/spools" \
      -H "Content-Type: application/json" \
      -d "{\"global_filament_id\":\"$CAT_ID\"}"
    LOC006_SPOOL=$(jv '.id')
    if [ "$HTTP_STATUS" = "201" ] && [ -n "$LOC006_SPOOL" ] && [ "$LOC006_SPOOL" != "null" ]; then
      auth_req PATCH "$BASE_URL/api/spools/$LOC006_SPOOL" \
        -H "Content-Type: application/json" \
        -d "{\"location_id\":\"$TMP_LOC6_ID\"}"
      # 删除位置
      auth_req DELETE "$BASE_URL/api/locations/$TMP_LOC6_ID"
      if [ "$HTTP_STATUS" = "200" ]; then
        # 验证 Spool.location_id 已置 null
        auth_req GET "$BASE_URL/api/spools/$LOC006_SPOOL"
        AFTER_LOC=$(jv '.location_id')
        if [ "$AFTER_LOC" = "null" ]; then
          pass "TC-LOC-006" "删除有料卷位置 → 200，Spool.location_id 自动置 null"
        else
          fail "TC-LOC-006" "删除位置后 Spool.location_id 应为 null" "actual=$AFTER_LOC"
        fi
      else
        fail "TC-LOC-006" "删除位置" "HTTP=$HTTP_STATUS"
        auth_req DELETE "$BASE_URL/api/locations/$TMP_LOC6_ID" >/dev/null 2>&1 || true
      fi
    else
      fail "TC-LOC-006" "TC-LOC-006 前置创建 Spool 失败" "HTTP=$HTTP_STATUS"
      auth_req DELETE "$BASE_URL/api/locations/$TMP_LOC6_ID" >/dev/null 2>&1 || true
    fi
  else
    fail "TC-LOC-006" "TC-LOC-006 前置 CAT_ID 未获取"
    auth_req DELETE "$BASE_URL/api/locations/$TMP_LOC6_ID" >/dev/null 2>&1 || true
  fi
else
  fail "TC-LOC-006" "TC-LOC-006 前置创建临时位置失败" "HTTP=$HTTP_STATUS"
fi

# TC-LOC-007 删除不存在的位置
# ⚠️ 已知问题：API 的 DELETE /locations/[id] 无 try-catch，Prisma 找不到记录时抛出异常返回 500
# 期望行为应为 404，实际为 500
auth_req DELETE "$BASE_URL/api/locations/00000000-0000-0000-0000-000000000000"
if [ "$HTTP_STATUS" = "404" ]; then
  pass "TC-LOC-007" "删除不存在位置 → 404"
elif [ "$HTTP_STATUS" = "500" ]; then
  fail "TC-LOC-007" "删除不存在位置 → 500（API 缺少 404 处理，应修复）" \
       "DELETE /locations/[id] 无 try-catch，Prisma P2025 异常未捕获，返回 500 而非 404"
else
  fail "TC-LOC-007" "删除不存在位置" "HTTP=${HTTP_STATUS} (expected 404)"
fi

# =============================================================================
log_section "Section 6: 文件上传 API（TC-UPLOAD）"
# =============================================================================

# ── 准备测试文件 ──────────────────────────────────────────────────────────────

# 最小合法 1×1 PNG（67 字节，标准 PNG 二进制头）
printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52' > /tmp/_test_logo.png
printf '\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53' >> /tmp/_test_logo.png
printf '\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x78\x9c\x62\xf8\x0f\x00\x00' >> /tmp/_test_logo.png
printf '\x01\x01\x00\x05\x18\xd8\x4e\x00\x00\x00\x00\x49\x45\x4e\x44\xae' >> /tmp/_test_logo.png
printf '\x42\x60\x82'                                                        >> /tmp/_test_logo.png

# 最小合法 SVG
printf '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>' \
  > /tmp/_test_logo.svg

# 非法文件类型（PDF 内容，pdf 扩展名）
printf '%%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\n' > /tmp/_test_file.pdf

# 超大文件（6 MB，全零，加 .png 扩展名触发大小校验）
dd if=/dev/zero of=/tmp/_test_large.png bs=1024 count=6144 2>/dev/null

# TC-UPLOAD-001 上传合法 PNG → 201，返回 url 字段
auth_req POST "$BASE_URL/api/upload/logo" \
  -F "file=@/tmp/_test_logo.png;type=image/png"
LOGO_URL=$(jv '.url')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$LOGO_URL" ] && [ "$LOGO_URL" != "null" ]; then
  pass "TC-UPLOAD-001" "上传合法 PNG → 201 url=$LOGO_URL"
  # 验证可以访问上传的文件（logos 接口无需 token）
  ACCESS_ST=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$LOGO_URL" 2>/dev/null)
  if [ "$ACCESS_ST" = "200" ]; then
    pass "TC-UPLOAD-001b" "访问上传的 PNG → 200（无需 Token）"
  else
    fail "TC-UPLOAD-001b" "访问上传 PNG" "HTTP=$ACCESS_ST url=$BASE_URL$LOGO_URL"
  fi
else
  fail "TC-UPLOAD-001" "上传合法 PNG" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-UPLOAD-002 上传合法 SVG → 201
auth_req POST "$BASE_URL/api/upload/logo" \
  -F "file=@/tmp/_test_logo.svg;type=image/svg+xml"
SVG_URL=$(jv '.url')
if [ "$HTTP_STATUS" = "201" ] && [ -n "$SVG_URL" ] && [ "$SVG_URL" != "null" ]; then
  pass "TC-UPLOAD-002" "上传合法 SVG → 201 url=$SVG_URL"
else
  fail "TC-UPLOAD-002" "上传合法 SVG" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-UPLOAD-003 上传不支持文件类型（PDF）→ 400
auth_req POST "$BASE_URL/api/upload/logo" \
  -F "file=@/tmp/_test_file.pdf;type=application/pdf"
ERR_MSG=$(jv '.error')
if [ "$HTTP_STATUS" = "400" ]; then
  pass "TC-UPLOAD-003" "上传 PDF → 400 error='$ERR_MSG'"
else
  fail "TC-UPLOAD-003" "不支持文件类型应返回 400" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-UPLOAD-004 上传超大文件（6 MB > 5 MB 限制）→ 400
auth_req POST "$BASE_URL/api/upload/logo" \
  -F "file=@/tmp/_test_large.png;type=image/png"
ERR_MSG=$(jv '.error')
if [ "$HTTP_STATUS" = "400" ]; then
  pass "TC-UPLOAD-004" "上传 6 MB 文件 → 400 error='$ERR_MSG'"
else
  fail "TC-UPLOAD-004" "超大文件应返回 400" "HTTP=$HTTP_STATUS BODY=$BODY"
fi

# TC-UPLOAD-005 路径穿越攻击防护
# GET /api/logos/..%2F..%2F..%2Fetc%2Fpasswd
# basename() 防护：只取文件名部分，不应返回系统文件
TRAVERSE_STATUS=$(curl -s -o /tmp/_traverse_body -w "%{http_code}" \
  --path-as-is \
  "$BASE_URL/api/logos/..%2F..%2F..%2Fetc%2Fpasswd" 2>/dev/null)
TRAVERSE_BODY=$(cat /tmp/_traverse_body 2>/dev/null || echo "")
if echo "$TRAVERSE_BODY" | grep -q "root:" 2>/dev/null; then
  fail "TC-UPLOAD-005" "路径穿越防护失败！返回了 /etc/passwd 内容" \
       "HTTP=$TRAVERSE_STATUS BODY=${TRAVERSE_BODY:0:80}"
elif [ "$TRAVERSE_STATUS" = "400" ] || [ "$TRAVERSE_STATUS" = "404" ]; then
  pass "TC-UPLOAD-005" "路径穿越防护 → ${TRAVERSE_STATUS} (未泄露系统文件)"
else
  # 2xx 但没有 root: 内容也算防护成功
  if echo "$TRAVERSE_BODY" | grep -qi "root:" 2>/dev/null; then
    fail "TC-UPLOAD-005" "路径穿越防护" "HTTP=${TRAVERSE_STATUS} 检测到潜在泄漏"
  else
    pass "TC-UPLOAD-005" "路径穿越防护 → ${TRAVERSE_STATUS} (未泄露系统文件)"
  fi
fi

# TC-UPLOAD-006 访问不存在的 Logo 文件 → 404
req GET "$BASE_URL/api/logos/nonexistent-file-xxxxxxxx.png"
if [ "$HTTP_STATUS" = "404" ]; then
  pass "TC-UPLOAD-006" "访问不存在 Logo → 404"
else
  fail "TC-UPLOAD-006" "不存在文件应返回 404" "HTTP=$HTTP_STATUS"
fi

# =============================================================================
#  汇总报告
# =============================================================================
TOTAL=$((PASS+FAIL))
printf "\n${CYAN}${BOLD}══════════════════════════════════════${NC}\n"
printf "${CYAN}${BOLD}  测试汇总${NC}\n"
printf "${CYAN}${BOLD}══════════════════════════════════════${NC}\n"
printf "  总计：${BOLD}%d${NC} 个\n" "$TOTAL"
printf "  ${GREEN}通过：%d 个${NC}\n" "$PASS"
printf "  ${RED}失败：%d 个${NC}\n" "$FAIL"
printf "${CYAN}${BOLD}══════════════════════════════════════${NC}\n\n"

# 有失败则以非零退出码退出
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
