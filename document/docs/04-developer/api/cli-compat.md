---
title: CLI 相容層
sidebar_position: 4
description: ClawHub CLI 協議相容層
---

# CLI 相容層

SkillHub 提供 ClawHub CLI 協議相容層，現有工具可無縫遷移。

## 配置 ClawHub CLI

要讓 ClawHub CLI 連線到你的 SkillHub 例項，需要配置以下環境變數：

### 環境變數配置

**Linux/macOS (bash/zsh):**
```bash
# ~/.bashrc 或 ~/.zshrc
export CLAWHUB_SITE=https://skill.xfyun.cn
export CLAWHUB_REGISTRY=https://skill.xfyun.cn
```

**Windows (PowerShell):**
```powershell
# 永久設定（當前使用者）
[Environment]::SetEnvironmentVariable('CLAWHUB_SITE', 'https://skill.xfyun.cn', 'User')
[Environment]::SetEnvironmentVariable('CLAWHUB_REGISTRY', 'https://skill.xfyun.cn', 'User')

# 或者臨時設定（當前會話）
$env:CLAWHUB_SITE = 'https://skill.xfyun.cn'
$env:CLAWHUB_REGISTRY = 'https://skill.xfyun.cn'
```

### 使用 CLI 標誌（單次命令）

```bash
clawhub --site https://skill.xfyun.cn --registry https://skill.xfyun.cn install <skill>
```

### 前端一鍵複製

SkillHub 網頁端的技能詳情頁會自動顯示帶有正確環境變數的安裝命令，直接複製即可使用。

## Well-known 發現

```http
GET /.well-known/clawhub.json
```

響應：

```json
{
  "apiBase": "/api/v1"
}
```

## 相容層 API

### Whoami

```http
GET /api/v1/whoami
```

響應：

```json
{
  "handle": "username",
  "displayName": "User Name",
  "role": "user"
}
```

### 搜尋

```http
GET /api/v1/search?q={keyword}&page={page}&limit={limit}
```

響應：

```json
{
  "results": [
    {
      "slug": "my-skill",
      "name": "My Skill",
      "description": "...",
      "author": {
        "handle": "username",
        "displayName": "User Name"
      },
      "version": "1.2.0",
      "downloadCount": 100,
      "starCount": 50,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-03-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 解析

```http
GET /api/v1/resolve?slug={slug}&version={version}
```

響應：

```json
{
  "slug": "my-skill",
  "version": "1.2.0",
  "downloadUrl": "/api/v1/download/my-skill/1.2.0"
}
```

### 下載

```http
GET /api/v1/download/{slug}/{version}
```

### 發布

```http
POST /api/v1/publish
Content-Type: multipart/form-data

file: <zip-file>
```

響應：

```json
{
  "slug": "my-skill",
  "version": "1.0.0",
  "status": "published"
}
```

## 座標對映

| SkillHub 座標 | ClawHub canonical slug |
|---------------|------------------------|
| `@global/my-skill` | `my-skill` |
| `@team-name/my-skill` | `team-name--my-skill` |

## 下一步

- [系統架構](../architecture/overview) - 瞭解架構設計
