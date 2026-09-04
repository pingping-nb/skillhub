---
title: 單機部署
sidebar_position: 1
description: 使用 Docker Compose 單機部署 SkillHub
---

# 單機部署

本文介紹如何使用 Docker Compose 在單臺伺服器上部署 SkillHub。

## 前置要求

- Docker Engine 20.10+
- Docker Compose Plugin 2.0+
- 至少 4GB 可用記憶體
- 至少 20GB 可用磁碟空間

## 快速部署

```bash
# 1. 克隆倉庫
git clone https://github.com/iflytek/skillhub.git
cd skillhub

# 2. 複製環境變數模板
cp .env.release.example .env.release

# 3. 編輯配置
# 修改 .env.release 中的配置項，特別是密碼和公網地址

# 4. 驗證配置
make validate-release-config

# 5. 啟動服務
docker compose --env-file .env.release -f compose.release.yml up -d
```

## 配置說明

詳見 [配置說明](./configuration) 檔案。

## 驗證部署

```bash
# 檢查容器狀態
docker compose --env-file .env.release -f compose.release.yml ps

# 檢查後端健康狀態
curl -i http://127.0.0.1:8080/actuator/health

# 訪問 Web UI
# 瀏覽器開啟 http://localhost（或配置的公網地址）
```

## 首登配置

1. 使用 `BOOTSTRAP_ADMIN_USERNAME` 和 `BOOTSTRAP_ADMIN_PASSWORD` 登入（預設 `admin` / `ChangeMe!2026`）
2. 立即修改管理員密碼
3. 配置企業 SSO（可選）
4. 建立團隊名稱空間

## 下一步

- [配置說明](./configuration) - 詳細配置項說明
- [Kubernetes 部署](./kubernetes) - 高可用部署
