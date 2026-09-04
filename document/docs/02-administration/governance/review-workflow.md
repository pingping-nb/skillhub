---
title: 稽核流程
sidebar_position: 2
description: 技能發布稽核流程配置
---

# 稽核流程

SkillHub 採用雙層稽核機制，保障技能質量。

## 稽核流程

### 團隊空間技能

1. 團隊成員提交發布
2. 建立稽核任務（PENDING）
3. 團隊 ADMIN 或 OWNER 稽核
   - 透過 → 技能發布（PUBLISHED）
   - 拒絕 → 返回修改（REJECTED）

### 全域性空間技能

1. 提交發布
2. 平臺 SKILL_ADMIN 或 SUPER_ADMIN 稽核
3. 稽核透過後發布

## 團隊技能提升到全域性

1. 團隊技能已發布
2. 團隊 ADMIN 或 OWNER 申請"提升到全域性"
3. 平臺管理員稽核
4. 稽核透過後在全域性空間建立新技能

## 稽核許可權

| 稽核型別 | 所需角色 |
|---------|---------|
| 團隊空間技能稽核 | 名稱空間 ADMIN/OWNER |
| 全域性空間技能稽核 | SKILL_ADMIN/SUPER_ADMIN |
| 提升申請稽核 | SKILL_ADMIN/SUPER_ADMIN |

## 下一步

- [使用者管理](./user-management) - 管理平臺使用者
