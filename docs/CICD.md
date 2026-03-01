# GitHub Actions CI/CD 配置指南

本项目已配置 GitHub Actions 自动化流水线，包含持续集成（CI）和持续部署（CD）。

---

## 📋 流水线说明

### 1. CI - 持续集成（`.github/workflows/ci.yml`）

**触发条件**：
- Push 到 `main` 分支
- 向 `main` 分支提交 Pull Request
- 忽略文档变更（`*.md` 和 `docs/` 目录）

**执行内容**（并行执行）：
- **代码检查**：运行 ESLint 检查代码规范
- **运行测试**：运行 Vitest 测试用例
- **构建验证**：运行 Next.js 构建，验证代码可正常编译

**预估时间**：2-4 分钟（并行执行 + 缓存命中）

---

### 2. CD - 持续部署（`.github/workflows/cd.yml`）

**触发条件**：
- 在 GitHub 上发布 Release（Tag 格式：`v1.0.0`）

**执行内容**：
- 构建多平台 Docker 镜像（`linux/amd64` + `linux/arm64`）
- 推送到 Docker Hub：`hanilbert/3d-filament-manager`
- 自动生成语义化标签：
  - `v1.0.0` → `1.0.0`, `1.0`, `1`, `latest`

**预估时间**：
- 首次构建：12-15 分钟
- 缓存命中：3-5 分钟

---

## 🔑 配置 GitHub Secrets（必需）

在开始使用 CD 流水线前，需要配置 Docker Hub 凭证。

### 步骤 1：获取 Docker Hub Access Token

1. 登录 [Docker Hub](https://hub.docker.com/)
2. 点击右上角头像 → **Account Settings**
3. 左侧菜单选择 **Security**
4. 点击 **New Access Token**
5. 填写信息：
   - **Access Token Description**：`GitHub Actions CI/CD`
   - **Access permissions**：`Read, Write, Delete`
6. 点击 **Generate**，复制生成的 Token（只显示一次）

### 步骤 2：在 GitHub 仓库中添加 Secrets

1. 打开 GitHub 仓库页面
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下两个 Secret：

| Secret 名称 | 值 | 说明 |
|------------|---|------|
| `DOCKER_USERNAME` | `hanilbert` | 您的 Docker Hub 用户名 |
| `DOCKER_TOKEN` | `dckr_pat_xxxxx` | 刚才生成的 Access Token |

---

## 🚀 使用指南

### 测试 CI 流水线

1. 提交代码到 `main` 分支：
   ```bash
   git add .github/workflows/
   git commit -m "ci: add GitHub Actions CI/CD workflows"
   git push origin main
   ```

2. 查看运行状态：
   - GitHub 仓库 → **Actions** 标签页
   - 找到 "CI - 持续集成" workflow
   - 查看 Lint、Test、Build 三个任务的执行结果

### 测试 CD 流水线

1. 在 GitHub 上创建 Release：
   - GitHub 仓库 → **Releases** → **Create a new release**
   - **Choose a tag**：输入 `v1.0.1`（或其他版本号）
   - **Release title**：`Release v1.0.1`
   - **Describe this release**：填写更新说明
   - 点击 **Publish release**

2. 查看构建进度：
   - GitHub 仓库 → **Actions** 标签页
   - 找到 "CD - 持续部署" workflow
   - 等待构建完成（12-15 分钟）

3. 验证镜像：
   ```bash
   # 拉取最新镜像
   docker pull hanilbert/3d-filament-manager:latest

   # 或拉取指定版本
   docker pull hanilbert/3d-filament-manager:1.0.1
   ```

---

## 📊 缓存机制

### Node.js 依赖缓存
- 使用 `actions/setup-node@v4` 内置缓存
- 缓存键：基于 `package-lock.json` 的 hash
- 缓存命中率：>90%

### Docker Layer 缓存
- 使用 GitHub Actions Cache（`type=gha`）
- 缓存所有构建层（`mode=max`）
- 首次构建后，后续构建仅重新构建变更层

---

## ⚠️ 常见问题

### Q1: CI 失败怎么办？

**Lint 失败**：
```bash
# 本地运行检查
npm run lint

# 自动修复（如果支持）
npm run lint -- --fix
```

**Test 失败**：
```bash
# 本地运行测试
npm run test

# 监听模式调试
npm run test:watch
```

**Build 失败**：
```bash
# 本地运行构建
npm run build
```

### Q2: CD 推送失败怎么办？

**错误信息**：`denied: requested access to the resource is denied`

**解决方案**：
1. 检查 `DOCKER_USERNAME` 是否正确
2. 检查 `DOCKER_TOKEN` 是否过期
3. 重新生成 Token 并更新 GitHub Secrets

### Q3: 多平台构建超时怎么办？

如果构建时间超过 GitHub Actions 限制（6 小时），可以：
1. 分离 amd64 和 arm64 构建为两个独立任务
2. 仅构建 amd64 架构（删除 `linux/arm64`）

### Q4: 如何跳过 CI 检查？

在 commit message 中添加 `[skip ci]`：
```bash
git commit -m "docs: update README [skip ci]"
```

---

## 🔒 安全最佳实践

1. **定期轮换 Token**：建议每 90 天更新一次 `DOCKER_TOKEN`
2. **最小权限原则**：Token 权限仅设置为 `Read, Write, Delete`（镜像仓库）
3. **不要在日志中打印 Secrets**：GitHub Actions 会自动屏蔽 Secrets
4. **使用官方 Actions**：所有 Actions 均来自 `actions/*` 和 `docker/*` 官方仓库

---

## 📈 后续优化方向

1. **安全扫描**：集成 Trivy 扫描 Docker 镜像漏洞
2. **测试覆盖率**：上传测试覆盖率报告到 Codecov
3. **通知集成**：失败时发送 Slack/Discord 通知
4. **自动化依赖更新**：配置 Dependabot 自动更新依赖
5. **E2E 测试**：集成 Playwright 进行端到端测试

---

## 📚 参考资料

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Docker Metadata Action](https://github.com/docker/metadata-action)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
