---
title: 配置說明
sidebar_position: 3
description: SkillHub 配置項詳細說明
---

# 配置說明

## 環境變數

SkillHub 透過環境變數進行配置，主要配置項如下：

### 基礎配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `SKILLHUB_PUBLIC_BASE_URL` | 公網訪問地址 | - |
| `SKILLHUB_VERSION` | 映象版本 | `edge` |

### 資料庫配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `POSTGRES_HOST` | PostgreSQL 主機 | `postgres` |
| `POSTGRES_PORT` | PostgreSQL 埠 | `5432` |
| `POSTGRES_DB` | 資料庫名 | `skillhub` |
| `POSTGRES_USER` | 資料庫使用者 | `skillhub` |
| `POSTGRES_PASSWORD` | 資料庫密碼 | - |

### Redis 配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `REDIS_HOST` | Redis 主機 | `redis` |
| `REDIS_PORT` | Redis 埠 | `6379` |
| `REDIS_PASSWORD` | Redis 密碼 | - |

### 儲存配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `SKILLHUB_STORAGE_PROVIDER` | 儲存提供方 | `local` |
| `SKILLHUB_STORAGE_S3_ENDPOINT` | S3 端點 | - |
| `SKILLHUB_STORAGE_S3_BUCKET` | S3 桶名 | - |
| `SKILLHUB_STORAGE_S3_ACCESS_KEY` | S3 Access Key | - |
| `SKILLHUB_STORAGE_S3_SECRET_KEY` | S3 Secret Key | - |

### OAuth 配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `OAUTH2_GITHUB_CLIENT_ID` | GitHub OAuth Client ID | - |
| `OAUTH2_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | - |

### 首登管理員配置

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `BOOTSTRAP_ADMIN_ENABLED` | 是否啟用首登管理員 | `true` |
| `BOOTSTRAP_ADMIN_USERNAME` | 首登管理員使用者名稱 | `admin` |
| `BOOTSTRAP_ADMIN_PASSWORD` | 首登管理員密碼 | `ChangeMe!2026` |

## 配置檔案

Spring Boot 配置檔案位於 `server/skillhub-app/src/main/resources/`。

## 下一步

- [認證配置](../security/authentication) - 配置身份認證
