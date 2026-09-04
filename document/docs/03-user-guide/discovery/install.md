---
title: 安裝使用
sidebar_position: 2
description: 安裝和使用技能
---

# 安裝使用

## 透過 CLI 安裝

### 安裝最新版本

```bash
clawhub install @team/my-skill
```

### 安裝指定版本

```bash
clawhub install @team/my-skill@1.2.0
```

### 按標籤安裝

```bash
clawhub install @team/my-skill@beta
```

### 使用 ClawHub CLI 安裝

```bash
clawhub install my-skill
clawhub install team-name--my-skill
```

## 安裝目錄

按以下優先順序安裝：

| 優先順序 | 路徑 | 說明 |
|--------|------|------|
| 1 | `./.agent/skills/` | 專案級，universal 模式 |
| 2 | `~/.agent/skills/` | 全域性級，universal 模式 |
| 3 | `./.claude/skills/` | 專案級，Claude 預設 |
| 4 | `~/.claude/skills/` | 全域性級，Claude 預設 |

## 在 Claude Code 中使用

安裝後，技能會被 Claude Code 自動發現和載入。

## 下一步

- [評分與收藏](./ratings) - 反饋和收藏技能
