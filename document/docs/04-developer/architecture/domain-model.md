---
title: 領域模型
sidebar_position: 2
description: 核心領域實體和關係
---

# 領域模型

## 核心實體

### Namespace（名稱空間）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| slug | varchar(64) | URL 友好標識 |
| display_name | varchar(128) | 展示名 |
| type | enum | `GLOBAL` / `TEAM` |
| description | text | 描述 |
| status | enum | `ACTIVE` / `FROZEN` / `ARCHIVED` |

### NamespaceMember（名稱空間成員）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| namespace_id | bigint | 名稱空間 ID |
| user_id | varchar(128) | 使用者 ID |
| role | enum | `OWNER` / `ADMIN` / `MEMBER` |

### Skill（技能）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| namespace_id | bigint | 所屬名稱空間 |
| slug | varchar(128) | URL 友好標識 |
| display_name | varchar(256) | 展示名 |
| summary | varchar(512) | 摘要 |
| owner_id | varchar(128) | 主要維護人 |
| visibility | enum | `PUBLIC` / `NAMESPACE_ONLY` / `PRIVATE` |
| status | enum | `ACTIVE` / `HIDDEN` / `ARCHIVED` |
| latest_version_id | bigint | 最新已發布版本 |

**唯一約束**：`(namespace_id, slug)`

### SkillVersion（技能版本）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| skill_id | bigint | 技能 ID |
| version | varchar(32) | semver 版本號 |
| status | enum | `DRAFT` / `PENDING_REVIEW` / `PUBLISHED` / `REJECTED` / `YANKED` |
| manifest_json | json | 檔案清單 |
| parsed_metadata_json | json | SKILL.md 解析結果 |

**唯一約束**：`(skill_id, version)`

### SkillTag（技能標籤）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| skill_id | bigint | 技能 ID |
| tag_name | varchar(64) | 標籤名 |
| target_version_id | bigint | 目標版本 |

**唯一約束**：`(skill_id, tag_name)`

## 座標系統

技能完整定址：`@{namespace_slug}/{skill_slug}`

## 下一步

- [安全架構](./security) - 安全設計
