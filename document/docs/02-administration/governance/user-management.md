---
title: 使用者管理
sidebar_position: 3
description: 平臺使用者管理
---

# 使用者管理

## 使用者狀態

| 狀態 | 實際邏輯 |
|------|----------|
| `ACTIVE` | 可正常登入和使用系統。OAuth 首次自動准入、local 註冊成功後都會進入該狀態。 |
| `PENDING` | 賬號已建但不可登入。OAuth 在“需要審批”策略下會建立 `PENDING` 使用者並跳轉到待審批頁；local 登入遇到該狀態會直接拒絕。 |
| `DISABLED` | 不可登入。OAuth 和 local 登入都會拒絕；`/api/v1/auth/me` 發現當前會話對應使用者已被禁用時，會直接清掉 session。 |
| `MERGED` | 賬號已併入其他賬號，不可繼續登入；主要由賬號合併流程寫入，不是普通使用者管理流程的目標狀態。 |

## 使用者准入

可配置新使用者是否需要審批：
- 自動准入：新使用者登入後自動啟用
- 審批准入：新使用者需 USER_ADMIN 審批後啟用

## 角色分配

`USER_ADMIN` 或 `SUPER_ADMIN` 可呼叫使用者管理介面修改平臺角色，但當前實現有幾個關鍵點：

- 介面一次只能設定一個目標平臺角色。
- 設定時會刪除該使用者已有的顯式平臺角色，再寫入新的那個角色。
- 如果設定為 `USER`，不會寫入 `user_role_binding`，而是依賴執行時預設角色補位。
- `USER_ADMIN` 不能分配 `SUPER_ADMIN`，只有 `SUPER_ADMIN` 能分配。

當前管理介面可設定的目標角色實際上是：

- `USER`
- `SKILL_ADMIN`
- `USER_ADMIN`
- `AUDITOR`
- `SUPER_ADMIN`

## 使用者封禁/解封

`USER_ADMIN` 或 `SUPER_ADMIN` 可封禁/解封使用者。

當前公開管理介面只支援把狀態改成：

- `ACTIVE`
- `DISABLED`

其中：

- “審批透過”本質上也是把使用者狀態改成 `ACTIVE`。
- 不能透過該介面直接改成 `PENDING` 或 `MERGED`。

## 賬號合併

支援將多個賬號合併為一個，保留操作歷史。

## 下一步

- [建立技能包](../../user-guide/publishing/create-skill) - 開始發布技能
