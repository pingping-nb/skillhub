---
title: 故障排查
sidebar_position: 2
description: 常見問題診斷和解決方案
---

# 故障排查

## 服務無法啟動

### 檢查清單

1. 檢查容器狀態：`docker compose ps`
2. 檢視服務日誌：`docker compose logs <service>`
3. 驗證環境變數：檢查 `.env.release` 配置
4. 檢查埠佔用：`netstat -tlnp`

### 常見原因

- 埠被佔用
- 資料庫連線失敗
- Redis 連線失敗
- 環境變數缺失

### PostgreSQL 容器啟動報 `operation not permitted`（寫 `postmaster.pid` / `pg_wal` 失敗）

SkillHub 預設的 Compose / `runtime.sh` 使用 Docker named volume（`postgres_data`），通常不需要手工處理宿主機目錄許可權。這個錯誤更多出現在你把 PostgreSQL 資料目錄改成宿主機 bind mount 時，例如 `/data/skillhub/postgres:/var/lib/postgresql/data`。

排查順序：

1. 優先恢復為 Docker named volume，或直接使用官方 `runtime.sh` 部署指令碼，避免手寫 compose 時漏配許可權。
2. 如果必須使用 bind mount，先確認當前映象中的 `postgres` 使用者 UID/GID：`docker run --rm postgres:16-alpine id postgres`，再按實際 UID/GID 調整資料目錄屬主，例如 `chown -R <uid>:<gid> <資料目錄>`。不要固定假設所有環境都是 `999:999`。
3. 在 RHEL/CentOS 上檢查 SELinux；在啟用 AppArmor、rootless Docker、NFS/CIFS/NAS 等環境時，也要確認宿主檔案系統是否允許 PostgreSQL 需要的寫入、鎖和許可權變更。
4. 不建議把 PostgreSQL `PGDATA` 放在不支援完整 POSIX 許可權語義的網路檔案系統上；生產環境優先使用本地盤、Docker named volume、塊儲存或外部 PostgreSQL。

## 上傳失敗

### 技能包上傳失敗

1. 檢查檔案大小
2. 檢查檔案型別
3. 檢查 SKILL.md 格式
4. 檢視服務端日誌

## 認證問題

### 無法登入

1. 檢查 OAuth 配置
2. 檢查回撥地址配置
3. 檢查 `SKILLHUB_PUBLIC_BASE_URL` 配置

## 效能問題

### 搜尋慢

1. 檢查 PostgreSQL 全文索引
2. 考慮升級到 Elasticsearch（後續版本）

### 下載慢

1. 檢查物件儲存配置
2. 檢查網路頻寬

## 獲取幫助

如以上方案無法解決問題：
1. 檢視日誌
2. 提交 Issue
3. 聯絡技術支援

## 下一步

- [變更日誌](./changelog) - 版本歷史
