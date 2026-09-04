---
title: 產品概述
sidebar_position: 1
description: SkillHub 產品概述和核心特性介紹
---

# 產品概述

SkillHub 是企業級 AI 技能註冊平臺，支援技能發布、發現與管理，採用自託管架構保障資料安全。

## 核心特性

### 發布管理
- 版本控制與語義化版本（Semantic Versioning）
- 自定義標籤（如 `beta`/`stable`）
- `latest` 標籤自動跟隨最新發布版本

### 發現機制
- 全文搜尋
- 多維度篩選（名稱空間、下載量、評分）
- 可見性控制（公開/名稱空間內/私有）

### 組織架構
- 名稱空間隔離
- 基於角色的訪問控制（RBAC）
- 團隊與全域性雙層空間

### 治理體系
- 雙層稽核流程
- 審計日誌
- 許可權分離

### 儲存與部署
- 支援 S3/MinIO/本地儲存
- Docker/Kubernetes 部署
- 企業級可觀測性

## 技術棧

### 後端
- **Java 21** - 執行時
- **Spring Boot 3.2.3** - 應用框架
- **PostgreSQL 16.x** - 主資料庫 + 全文搜尋
- **Redis 7.x** - 快取與會話儲存

### 前端
- **React 19** - UI 框架
- **TypeScript** - 型別安全
- **Vite** - 構建工具
- **Tailwind CSS** - 樣式框架

### 部署
- **Docker Compose** - 單機部署
- **Kubernetes** - 生產環境編排

## 核心概念

### 名稱空間
技能隔離邊界，支援 `@global`（全域性）和 `@team-*`（團隊）字首。

### 座標系統
技能標識格式為 `@{namespace_slug}/{skill_slug}`，支援語義化版本。

### 相容性
提供 REST API 和 ClawHub 相容層，支援現有工具整合。

## 下一步

- [快速開始](./quick-start) - 一鍵啟動體驗
- [典型應用場景](./use-cases) - 瞭解如何在企業中應用
