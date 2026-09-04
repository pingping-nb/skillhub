---
title: 建立技能包
sidebar_position: 1
description: 學習如何建立符合規範的技能包
---

# 建立技能包

## 技能包結構

一個標準的 SkillHub 技能包結構如下：

```
my-skill/
├── SKILL.md              # 主入口檔案（必需）
├── references/           # 參考資料（可選）
├── scripts/              # 指令碼（可選）
└── assets/               # 靜態資源（可選）
```

## SKILL.md 格式

SKILL.md 是技能包的主入口檔案，使用 YAML frontmatter + Markdown 正文格式：

```markdown
---
name: my-skill
description: 一句話描述這個技能的用途
x-astron-category: code-review
---

# 技能說明

這裡是技能的詳細說明...
```

### Frontmatter 欄位

| 欄位 | 必需 | 說明 |
|------|------|------|
| `name` | 是 | 技能標識，kebab-case 格式 |
| `description` | 是 | 技能簡短描述 |
| `x-astron-category` | 否 | 分類標籤 |
| `x-astron-runtime` | 否 | 執行時要求 |
| `x-astron-min-version` | 否 | 最低版本要求 |

## 檔案限制

- 單檔案大小：最大 1MB
- 總包大小：最大 10MB
- 檔案數量：最多 100 個
- 允許的檔案型別：`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.js`, `.ts`, `.py`, `.sh`, `.png`, `.jpg`, `.svg`

## 下一步

- [發布流程](./publish) - 發布技能包
