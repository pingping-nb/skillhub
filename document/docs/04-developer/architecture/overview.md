---
title: 系統架構
sidebar_position: 1
description: SkillHub 系統架構概覽
---

# 系統架構

## 架構原則

- **單體優先**：一期採用模組化單體，不拆微服務
- **依賴倒置**：領域層不依賴基礎設施
- **可替換邊界**：搜尋、儲存都有 SPI 抽象

## 模組結構

```
server/
├── skillhub-app/          # 啟動、配置裝配、Controller
├── skillhub-domain/       # 領域模型 + 領域服務 + 應用服務
├── skillhub-auth/         # OAuth2 認證 + RBAC + 授權判定
├── skillhub-search/       # 搜尋 SPI + PostgreSQL 全文實現
├── skillhub-storage/      # 物件儲存抽象 + LocalFile/S3
└── skillhub-infra/        # JPA、通用工具、配置基礎
```

## 模組依賴

```
app → domain, auth, search, storage, infra
infra → domain
auth → domain
search → domain
storage → (獨立)
```

## 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 執行時 | Java | 21 |
| 框架 | Spring Boot | 3.2.3 |
| 資料庫 | PostgreSQL | 16.x |
| 快取/會話 | Redis | 7.x |

## 部署架構

```
┌──────────────┐
│ Browser / CLI│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Web/Nginx   │
└──────┬───────┘
       │ /api/*
       ▼
┌──────────────┐
│ Spring Boot  │
└───┬────┬─────┘
    │    │
    ▼    ▼
PostgreSQL  Redis
```

## 下一步

- [領域模型](./domain-model) - 核心實體
