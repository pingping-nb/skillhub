---
title: 安全架構
sidebar_position: 3
description: 安全架構設計
---

# 安全架構

## 認證架構

### OAuth2 登入

- 基於 Spring Security OAuth2 Client
- 一期支援 GitHub
- 架構支援擴充套件多 Provider

### CLI 認證

- OAuth Device Flow
- Web 授權後簽發 CLI 憑證
- 支援 API Token

### Session 管理

- Spring Session + Redis
- 分散式 Session 共享
- 支援多 Pod 部署

## 授權架構

### 平臺角色

| 角色 | 許可權 |
|------|------|
| `SUPER_ADMIN` | 所有許可權 |
| `SKILL_ADMIN` | 技能治理 |
| `USER_ADMIN` | 使用者治理 |
| `AUDITOR` | 審計只讀 |

### 名稱空間角色

| 角色 | 許可權 |
|------|------|
| `OWNER` | 名稱空間所有者 |
| `ADMIN` | 稽核、成員管理 |
| `MEMBER` | 發布技能 |

### 可見性規則

| 可見性 | 誰可訪問 |
|--------|---------|
| `PUBLIC` | 任何人（匿名） |
| `NAMESPACE_ONLY` | 名稱空間成員 |
| `PRIVATE` | owner + 名稱空間 ADMIN |

## 審計

所有關鍵操作同步寫入審計日誌：
- 發布、下載、刪除
- 稽核透過、拒絕
- 許可權變更
- 配置變更

## 限流

- Ingress 層基礎限流（Nginx）
- 應用層精細限流（Redis 滑動視窗）

## 下一步

- [技能協議](../plugins/skill-protocol) - 技能包規範
