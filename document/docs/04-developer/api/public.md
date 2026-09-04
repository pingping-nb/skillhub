---
title: 公開 API
sidebar_position: 2
description: 無需認證的公開 API
---

# 公開 API

## 技能搜尋

```http
GET /api/v1/skills?keyword=...&namespace=...&page=1&size=20
```

**Query Parameters:**
- `keyword`: 搜尋關鍵詞
- `namespace`: 名稱空間篩選
- `page`: 頁碼
- `size`: 每頁數量

## 技能詳情

```http
GET /api/v1/skills/{namespace}/{slug}
```

## 版本列表

```http
GET /api/v1/skills/{namespace}/{slug}/versions
```

## 版本詳情

```http
GET /api/v1/skills/{namespace}/{slug}/versions/{version}
```

## 檔案清單

```http
GET /api/v1/skills/{namespace}/{slug}/versions/{version}/files
```

## 下載技能

```http
GET /api/v1/skills/{namespace}/{slug}/download
GET /api/v1/skills/{namespace}/{slug}/versions/{version}/download
```

## 解析版本

```http
GET /api/v1/skills/{namespace}/{slug}/resolve?version=...&tag=...
```

## 名稱空間列表

```http
GET /api/v1/namespaces
```

## 名稱空間詳情

```http
GET /api/v1/namespaces/{slug}
```

## 下一步

- [認證 API](./authenticated) - 檢視認證介面
