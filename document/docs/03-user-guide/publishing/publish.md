---
title: 發布流程
sidebar_position: 2
description: 發布技能到 SkillHub
---

# 發布流程

## 透過 Web 發布

1. 登入 SkillHub
2. 點選"發布技能"
3. 選擇目標名稱空間
4. 上傳技能包 ZIP 檔案
5. 填寫版本資訊（變更日誌等）
6. 提交發布
7. 等待稽核（如需要）
8. 稽核透過後發布成功

## 透過 CLI 發布

```bash
# 1. 登入
clawhub login

# 2. 發布
clawhub publish ./my-skill.zip --namespace @team-myteam
```

## 透過 ClawHub CLI 發布

配置 registry 後使用：

```bash
clawhub publish ./my-skill.zip
```

## 發布狀態

| 狀態 | 說明 |
|------|------|
| `DRAFT` | 草稿，未提交稽核 |
| `PENDING_REVIEW` | 等待稽核 |
| `PUBLISHED` | 已發布，可被發現和下載 |
| `REJECTED` | 已拒絕，需修改後重新提交 |
| `YANKED` | 已撤回，不再推薦使用 |

## 下一步

- [版本管理](./versioning) - 管理技能版本
