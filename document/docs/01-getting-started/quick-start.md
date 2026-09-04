---
title: 快速開始
sidebar_position: 2
description: 一鍵啟動 SkillHub 開發環境
---

# 快速開始

## 一鍵啟動

使用以下命令一鍵啟動完整的 SkillHub 環境：

```bash
curl -fsSL https://raw.githubusercontent.com/iflytek/skillhub/main/scripts/runtime.sh | sh -s -- up
```

或者克隆倉庫後手動啟動：

```bash
git clone https://github.com/iflytek/skillhub.git
cd skillhub
make dev-all
```

## 預設賬號

兩種啟動方式都會預設建立一個 bootstrap 管理員賬號：

- 使用者名稱：`admin`
- 密碼：`ChangeMe!2026`

### `curl` 一鍵部署

| 服務 | 地址 |
|------|------|
| Web UI | http://localhost |
| Backend API | http://localhost:8080 |

使用上述預設賬號密碼登入即可。**生產環境請務必修改密碼。**

### `make dev-all` 本地開發

| 服務 | 地址 |
|------|------|
| Web UI | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

除了上述 bootstrap 管理員，本地開發還預置兩個模擬使用者（無需密碼）：

| 使用者 | 角色 | 說明 |
|------|------|------|
| `local-user` | 普通使用者 | 可發布技能、管理名稱空間 |
| `local-admin` | 超級管理員 | 擁有所有許可權，包括稽核和使用者管理 |

使用 `X-Mock-User-Id` 請求頭切換模擬使用者。
如需關閉 bootstrap 管理員，啟動前設定 `BOOTSTRAP_ADMIN_ENABLED=false`。

## 常用命令

```bash
# 啟動完整開發環境
make dev-all

# 停止所有服務
make dev-all-down

# 重置並重新啟動
make dev-all-reset

# 僅啟動後端
make dev

# 僅啟動前端
make dev-web

# 檢視所有可用命令
make help
```

## 下一步

- [產品概述](./overview) - 深入瞭解產品特性
- [典型應用場景](./use-cases) - 探索企業應用場景
- [單機部署](../administration/deployment/single-machine) - 生產環境部署指南
