---
title: 技能協議
sidebar_position: 1
description: SKILL.md 規範和技能包協議
---

# 技能協議

## SKILL.md 規範

### 基本格式

```markdown
---
name: my-skill
description: When to use this skill
---

# Markdown 正文

技能指令內容...
```

### 必需欄位

| 欄位 | 說明 |
|------|------|
| `name` | 技能標識，kebab-case |
| `description` | 技能簡短描述 |

### 擴充套件欄位

| 欄位 | 說明 |
|------|------|
| `x-astron-category` | 分類標籤 |
| `x-astron-runtime` | 執行時要求 |
| `x-astron-min-version` | 最低版本要求 |

## 技能包結構

```
my-skill/
├── SKILL.md              # 主入口檔案（必需）
├── references/           # 參考資料（可選）
├── scripts/              # 指令碼（可選）
└── assets/               # 靜態資源（可選）
```

## 檔案校驗

- 根目錄必須包含 `SKILL.md`
- 檔案型別白名單
- 單檔案大小限制：1MB
- 總包大小限制：10MB
- 檔案數量限制：100 個

## 客戶端安裝目錄

按以下優先順序安裝：

1. `./.agent/skills/`
2. `~/.agent/skills/`
3. `./.claude/skills/`
4. `~/.claude/skills/`

## 下一步

- [儲存 SPI](./storage-spi) - 擴充套件儲存後端
