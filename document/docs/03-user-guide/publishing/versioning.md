---
title: 版本管理
sidebar_position: 3
description: 技能版本和標籤管理
---

# 版本管理

## 語義化版本

SkillHub 使用語義化版本（Semantic Versioning）：`MAJOR.MINOR.PATCH`

- `MAJOR`：不相容的 API 變更
- `MINOR`：向後相容的功能新增
- `PATCH`：向後相容的問題修復

示例：`1.0.0`, `1.1.0`, `2.0.0`

## latest 標籤

`latest` 是系統保留標籤，自動跟隨最新已發布版本，不可手動移動。

## 自定義標籤

可建立自定義標籤用於版本通道管理：

- `beta` - 測試版本
- `stable` - 穩定版本
- `stable-2026q1` - 季度穩定版本

### 建立/移動標籤

```bash
clawhub tag set @team/my-skill beta 1.2.0
```

### 刪除標籤

```bash
clawhub tag delete @team/my-skill beta
```

## 版本撤回

已發布版本發現問題可撤回：

1. 進入技能詳情頁
2. 找到目標版本
3. 點選"撤回版本"
4. 確認撤回

撤回後的版本仍可檢視，但會標記為不推薦使用。

## 下一步

- [搜尋技能](../discovery/search) - 發現技能
