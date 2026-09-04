# Skill Lifecycle

Date: 2026-03-18
Status: current code-aligned reference

本檔案是 skill 生命週期的單一規範入口。結論以當前程式碼實現為準，並已經同步到領域模型、業務流程、API、前端、搜尋和相容層檔案。

## 1. 設計原則

- skill 生命週期不再被建模為一個混雜狀態機，而是拆分為容器狀態、版本狀態、稽核工作流狀態和可見性覆蓋層
- 前端不再從 `status + hidden + latestVersionStatus + viewingVersionStatus` 拼裝狀態，而統一消費後端 lifecycle projection
- destructive action 和 reversible action 必須分離；`withdraw-review` 只表示撤回提審，不表示刪除版本
- 對外仍可保留 `latest` 協議詞彙，但內部語義必須嚴格等價於 latest published

## 2. 狀態模型

### 2.1 Skill 容器狀態

- `ACTIVE`
- `ARCHIVED`

說明：

- `hidden` 是獨立治理覆蓋層，不屬於 `Skill.status`
- `SkillStatus.HIDDEN` 不再視為有效生命週期語義

### 2.2 SkillVersion 版本狀態

- `DRAFT`
- `PENDING_REVIEW`
- `PUBLISHED`
- `REJECTED`
- `YANKED`

狀態含義：

- `DRAFT`：可再次提交稽核或刪除的非公開版本
- `PENDING_REVIEW`：凍結待審版本
- `PUBLISHED`：當前可分發版本
- `REJECTED`：稽核拒絕後保留的版本
- `YANKED`：曾發布、現已撤回分發的版本

### 2.3 ReviewTask 稽核工作流狀態

- `PENDING`
- `APPROVED`
- `REJECTED`

`ReviewTask` 僅表達稽核流程，不再被前端當作展示態來源。

## 3. 核心語義

### 3.1 Latest

- `Skill.latestVersionId` 的唯一語義是 latest published pointer
- 它只能指向 `PUBLISHED` 版本
- 若 skill 沒有任何已發布版本，則允許為 `null`
- `latest` 系統保留標籤自動跟隨該指標

### 3.2 Lifecycle Projection

詳情頁、我的技能、我的收藏、搜尋等讀模型統一基於以下 projection：

- `headlineVersion`：當前頁面主展示版本
- `publishedVersion`：最新已發布版本
- `ownerPreviewVersion`：owner / namespace 管理者可見的待稽核預覽版本
- `resolutionMode`：`PUBLISHED` / `OWNER_PREVIEW` / `NONE`

約束：

- 公開瀏覽、安裝、下載、搜尋只認 `publishedVersion`
- owner 詳情頁只有在不存在 `publishedVersion` 時，才允許 `headlineVersion = ownerPreviewVersion`
- promotion、compat latest、預設下載等公開分發行為都只能繫結 `publishedVersion`

## 4. 程式碼實際鏈路

### 4.1 首次上傳

- 普通使用者上傳後直接建立 `PENDING_REVIEW` 版本
- 同時建立 `PENDING` review task
- 不會建立初始 `DRAFT`
- 不會更新 `latestVersionId`

### 4.2 稽核透過

- `PENDING_REVIEW -> PUBLISHED`
- review task 標記為 `APPROVED`
- `Skill.latestVersionId` 指向該版本
- skill 展示後設資料從發布版本重新整理

### 4.3 稽核拒絕

- `PENDING_REVIEW -> REJECTED`
- review task 標記為 `REJECTED`
- 版本保留，可後續刪除

### 4.4 撤回稽核

- `withdraw-review` 的統一語義是 `PENDING_REVIEW -> DRAFT`
- 同時刪除關聯的 `PENDING review_task`
- 該操作是可逆、非破壞性的
- 當前程式碼只允許提交人本人撤回

### 4.5 重傳新版本

- 若發現舊的 `PENDING_REVIEW` 版本，會先把舊版本自動降回 `DRAFT`
- 然後建立新的待審版本
- 自動撤回與手動撤回必須保持同一語義

### 4.6 已發布版本重發

- rerelease 當前本質上是從已發布版本複製並重新走發布流程
- 當前實現允許特權路徑直接產出新 `PUBLISHED` 版本
- 該能力應被理解為發布路徑特例，不是生命週期展示態

### 4.7 隱藏 / 恢復 / 歸檔 / 撤回已發布版本

- 隱藏：只改 `hidden=true`
- 恢復：只改 `hidden=false`
- 歸檔：`Skill.status = ARCHIVED`
- 取消歸檔：`Skill.status = ACTIVE`
- yank：`PUBLISHED -> YANKED`

### 4.8 Yank 後指標修正

- yank 已發布版本時，若命中當前 `latestVersionId`，必須重算 latest published pointer
- 若仍有其他 `PUBLISHED` 版本，則指向最新一個
- 若已無任何 `PUBLISHED` 版本，則 `latestVersionId = null`

## 5. 對外協議約束

### 5.1 Public / Search / Compat

- 對外協議可以繼續暴露 `latestVersion`、`latest`、預設下載等概念
- 但它們都必須嚴格表示“最新已發布版本”
- compat 層內部實現必須從統一 lifecycle projection 的 `publishedVersion` 對映，不允許自行推導“當前版本”

### 5.2 Frontend

- 頁面狀態展示統一消費 projection
- 不再新增舊相容欄位依賴
- `hidden` 僅作為治理標記展示，不參與版本狀態拼裝

## 6. 許可權邊界

- `withdraw-review`：僅提交人本人
- 刪除版本：owner 或 namespace 管理者，且僅限 `DRAFT` / `REJECTED`
- 歸檔 / 取消歸檔：owner 或 namespace 管理者
- 隱藏 / 恢復技能、撤回已發布版本：平臺技能治理許可權

## 7. 當前最終約束

- 一個 skill 生命週期的唯一規範入口就是本檔案
- 其它檔案如 `02-domain-model`、`05-business-flows`、`06-api-design`、`08-frontend-architecture` 必須與本檔案保持一致
- 若後續程式碼再次改變生命週期語義，應先修改程式碼，再同步更新本檔案和相關子檔案
