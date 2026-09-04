---
title: 認證 API
sidebar_position: 3
description: 需要認證的 API
---

# 認證 API

## 認證相關

### 獲取當前使用者

```http
GET /api/v1/auth/me
```

### 登出

```http
POST /api/v1/auth/logout
```

## 技能發布

```http
POST /api/v1/publish
Content-Type: multipart/form-data

file: <zip-file>
namespace: <namespace-slug>
```

## 收藏

```http
POST /api/v1/skills/{namespace}/{slug}/star
DELETE /api/v1/skills/{namespace}/{slug}/star
```

## 評分

```http
POST /api/v1/skills/{namespace}/{slug}/rating
Content-Type: application/json

{
  "score": 5
}
```

## 標籤管理

```http
GET /api/v1/skills/{namespace}/{slug}/tags
PUT /api/v1/skills/{namespace}/{slug}/tags/{tagName}
DELETE /api/v1/skills/{namespace}/{slug}/tags/{tagName}
```

## 我的資源

```http
GET /api/v1/me/stars
GET /api/v1/me/skills
```

## 名稱空間管理

```http
POST /api/v1/namespaces
PUT /api/v1/namespaces/{slug}
GET /api/v1/namespaces/{slug}/members
POST /api/v1/namespaces/{slug}/members
PUT /api/v1/namespaces/{slug}/members/{userId}/role
DELETE /api/v1/namespaces/{slug}/members/{userId}
```

## 稽核

```http
GET /api/v1/namespaces/{slug}/reviews
POST /api/v1/namespaces/{slug}/reviews/{id}/approve
POST /api/v1/namespaces/{slug}/reviews/{id}/reject
```

## 提升申請

```http
POST /api/v1/namespaces/{slug}/skills/{skillId}/promote
```

## API Token

```http
POST /api/v1/tokens
GET /api/v1/tokens
DELETE /api/v1/tokens/{id}
```

## 下一步

- [CLI 相容層](./cli-compat) - ClawHub 相容介面
