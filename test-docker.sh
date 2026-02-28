#!/bin/bash

# Docker 配置测试脚本
# 用于验证 Docker 配置是否正确

set -e

echo "🔍 Docker 配置测试脚本"
echo "======================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 测试函数
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. 检查 Docker 是否安装
echo "1️⃣  检查 Docker 环境"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    test_pass "Docker 已安装: $DOCKER_VERSION"

    # 检查 Docker 是否运行
    if docker info &> /dev/null; then
        test_pass "Docker 守护进程正在运行"
        DOCKER_RUNNING=true
    else
        test_fail "Docker 守护进程未运行，请启动 Docker Desktop"
        DOCKER_RUNNING=false
    fi
else
    test_fail "Docker 未安装"
    echo ""
    echo "请安装 Docker Desktop:"
    echo "  macOS: https://docs.docker.com/desktop/install/mac-install/"
    echo "  或使用 Homebrew: brew install --cask docker"
    DOCKER_RUNNING=false
fi

# 检查 docker-compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    test_pass "docker-compose 已安装: $COMPOSE_VERSION"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version)
    test_pass "docker compose (plugin) 已安装: $COMPOSE_VERSION"
else
    test_warn "docker-compose 未找到（Docker Desktop 通常包含此功能）"
fi

echo ""

# 2. 检查必需文件
echo "2️⃣  检查配置文件"
if [ -f "Dockerfile" ]; then
    test_pass "Dockerfile 存在"
else
    test_fail "Dockerfile 不存在"
fi

if [ -f "docker-compose.yml" ]; then
    test_pass "docker-compose.yml 存在"
else
    test_fail "docker-compose.yml 不存在"
fi

if [ -f ".dockerignore" ]; then
    test_pass ".dockerignore 存在"
else
    test_warn ".dockerignore 不存在（建议创建）"
fi

if [ -f ".env" ]; then
    test_pass ".env 文件存在"

    # 检查必需的环境变量
    if grep -q "APP_PASSWORD" .env; then
        test_pass "APP_PASSWORD 已配置"
    else
        test_fail "APP_PASSWORD 未配置"
    fi

    if grep -q "NEXT_PUBLIC_BASE_URL" .env; then
        test_pass "NEXT_PUBLIC_BASE_URL 已配置"
    else
        test_fail "NEXT_PUBLIC_BASE_URL 未配置"
    fi

    if grep -q "DATABASE_URL" .env; then
        test_pass "DATABASE_URL 已配置"
    else
        test_fail "DATABASE_URL 未配置"
    fi
else
    test_fail ".env 文件不存在"
    echo "  请运行: cp .env.example .env"
fi

echo ""

# 3. 验证 docker-compose.yml 语法
echo "3️⃣  验证配置文件语法"
if [ "$DOCKER_RUNNING" = true ]; then
    if docker-compose config > /dev/null 2>&1 || docker compose config > /dev/null 2>&1; then
        test_pass "docker-compose.yml 语法正确"
    else
        test_fail "docker-compose.yml 语法错误"
    fi
else
    test_warn "跳过语法验证（Docker 未运行）"
fi

echo ""

# 4. 检查端口占用
echo "4️⃣  检查端口占用"
if command -v lsof &> /dev/null; then
    if lsof -i :3000 &> /dev/null; then
        test_warn "端口 3000 已被占用"
        echo "  占用进程:"
        lsof -i :3000 | grep LISTEN
    else
        test_pass "端口 3000 可用"
    fi
else
    test_warn "无法检查端口占用（lsof 未安装）"
fi

echo ""

# 5. 检查数据目录
echo "5️⃣  检查数据目录"
if [ -d "data" ]; then
    test_pass "data 目录存在"

    if [ -w "data" ]; then
        test_pass "data 目录可写"
    else
        test_fail "data 目录不可写"
    fi
else
    test_warn "data 目录不存在（首次运行时会自动创建）"
fi

echo ""

# 6. 显示测试结果
echo "======================="
echo "📊 测试结果汇总"
echo "======================="
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    echo ""

    if [ "$DOCKER_RUNNING" = true ]; then
        echo "🚀 准备就绪！可以运行以下命令启动应用："
        echo ""
        echo "  docker-compose up -d          # 后台启动"
        echo "  docker-compose logs -f app    # 查看日志"
        echo "  docker-compose ps             # 查看状态"
        echo "  docker-compose down           # 停止并删除容器"
        echo ""
        echo "访问地址: http://localhost:3000"
    else
        echo "⚠️  请先安装并启动 Docker Desktop，然后重新运行此脚本"
    fi
else
    echo -e "${RED}✗ 有 $FAILED 个测试失败${NC}"
    echo "请修复上述问题后重试"
    exit 1
fi
