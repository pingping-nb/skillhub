---
title: API 概述
sidebar_position: 1
description: SkillHub API 概述
---

# API 概述

SkillHub 提供 RESTful API 用於整合和自動化。

## API 分類

### 公開 API
- 技能搜尋
- 技能詳情
- 版本列表
- 下載技能
- 無需認證（PUBLIC 技能）

### 認證 API
- 發布技能
- 收藏/評分
- 名稱空間管理
- 需要登入或 Bearer Token

### CLI 相容層
- 相容 ClawHub CLI 協議
- 現有工具可無縫遷移

## 響應格式

### 統一響應結構

```json
{
  "code": 0,
  "msg": "成功",
  "data": {},
  "timestamp": "2026-03-15T06:00:00Z",
  "requestId": "req-123"
}
```

### 分頁響應

```json
{
  "code": 0,
  "msg": "成功",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "size": 20
  },
  "timestamp": "2026-03-15T06:00:00Z",
  "requestId": "req-123"
}
```

## 認證方式

### Session Cookie
Web 端使用 Session Cookie 認證。

### Bearer Token
CLI 和 API 整合使用 Bearer Token：

```bash
Authorization: Bearer <token>
```

### API Token
可建立長期有效的 API Token 用於自動化。

## 冪等性

所有寫操作支援 `X-Request-Id` 請求頭實現冪等：

```bash
X-Request-Id: <uuid-v4>
```

## 下一步

- [公開 API](./public) - 檢視公開介面
