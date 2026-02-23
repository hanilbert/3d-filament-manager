#!/usr/bin/env bash
# =============================================================================
#  OpenClaw 汉化版 — 在 Mac（含 Mac mini）上一键安装
#  用途：先装 Homebrew → Colima+Docker → 再执行官方 docker-deploy.sh --china
#
#  用法（需在能输入 sudo 密码的终端执行）：
#    方式一：先拷到 Mac mini 再 SSH 执行（推荐，会提示输入 sudo 密码）
#      scp scripts/openclaw-install-mac-mini.sh 192.168.6.2:~/
#      ssh -t 192.168.6.2 'bash ~/openclaw-install-mac-mini.sh'
#    方式二：在 Mac mini 本机终端执行
#      bash ~/openclaw-install-mac-mini.sh
# =============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== OpenClaw 汉化版 - Mac 环境安装 ===${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Homebrew
# -----------------------------------------------------------------------------
if ! command -v brew &>/dev/null; then
  echo -e "${YELLOW}未检测到 Homebrew，正在安装（需要输入本机 sudo 密码）...${NC}"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon: /opt/homebrew, Intel: /usr/local
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  echo -e "${GREEN}Homebrew 安装完成。${NC}"
else
  echo -e "${GREEN}已检测到 Homebrew。${NC}"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# 2. Colima + Docker（无图形界面，适合 Mac mini / SSH）
# -----------------------------------------------------------------------------
if ! command -v docker &>/dev/null || ! docker info &>/dev/null; then
  echo -e "${YELLOW}安装 Colima 与 Docker...${NC}"
  brew install colima docker
  echo -e "${YELLOW}启动 Colima（首次可能稍慢）...${NC}"
  colima start
  echo -e "${GREEN}Docker 已就绪。${NC}"
else
  echo -e "${GREEN}Docker 已安装且可用。${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. OpenClaw 官方部署脚本（国内镜像）
# -----------------------------------------------------------------------------
echo -e "${CYAN}运行 OpenClaw 部署脚本（--china）...${NC}"
curl -fsSL https://cdn.jsdelivr.net/gh/1186258278/OpenClawChineseTranslation@main/docker-deploy.sh | bash -s -- --china

echo ""
echo -e "${GREEN}全部完成。访问 OpenClaw：http://<Mac-mini-IP>:18789${NC}"
