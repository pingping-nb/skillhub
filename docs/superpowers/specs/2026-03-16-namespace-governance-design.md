# Namespace 治理補齊設計檔案

> **Goal:** 在現有 namespace 基礎能力上，補齊名稱空間生命週期治理閉環。實現團隊名稱空間狀態管理、管理臺讀模型拆分、前後端治理互動、跨模組狀態約束、審計記錄和錯誤語義統一。

> **前置條件:** Phase 2 名稱空間模型、成員管理、Skill 核心鏈路已完成；Phase 3 稽核與提升流程已接入 namespace 角色體系。

> **重要約束：系統內建全域性空間**
> `@global` 是系統內建名稱空間，不允許任何業務介面修改其基礎資訊、成員、狀態或所有權。它只允許讀取。

## 關鍵設計決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 治理模式 | 生命週期收斂型 | 一次性統一狀態機、許可權矩陣、頁面行為和跨模組約束，避免零散補丁 |
| 全域性空間策略 | `@global` 內建只讀 | 與產品定位一致，避免把全域性公共空間誤當作普通團隊空間治理 |
| 團隊空間狀態機 | `ACTIVE / FROZEN / ARCHIVED` | 已在領域模型中定義，補齊介面和行為即可 |
| 恢復語義 | `ARCHIVED -> ACTIVE` | 軟歸檔恢復後直接回歸正常運營態，避免多餘狀態分支 |
| 服務邊界 | `NamespaceGovernanceService` 獨立承載狀態流轉 | 避免 `NamespaceService` 混雜 CRUD、成員和生命週期邏輯 |
| 管理讀模型 | 新增 `/me/namespaces` | 區分公開目錄和管理臺檢視，支援返回凍結/歸檔空間 |
| 歸檔許可權 | 團隊空間僅 `OWNER` 可歸檔/恢復 | 歸檔是高風險操作，需要明確責任人 |
| 凍結許可權 | 團隊空間 `OWNER/ADMIN` 可凍結/解凍 | 保留日常治理能力，同時不擴大歸檔許可權 |
| 錯誤暴露策略 | 歸檔空間對非成員公開訪問按不可見處理 | 符合軟歸檔“對外隱藏”語義 |

## Tech Stack（沿用現有實現）

- Backend: Spring Boot 3.x + JDK 21 + Spring Data JPA + Spring Security
- Frontend: React 19 + TypeScript + TanStack Query + TanStack Router
- Governance/Audit: 複用 `AuditLogService`

---

## 1. 背景與問題

現有設計與實現已經具備 namespace 的基礎模型、成員角色和稽核邊界，但仍存在以下缺口：

1. 缺少 namespace 狀態管理介面，`FROZEN / ARCHIVED` 僅停留在領域列舉層
2. 公開空間列表與“我的名稱空間”複用同一查詢介面，無法呈現管理態空間
3. 發布、稽核、提升等寫操作尚未統一受 namespace 狀態約束
4. 前端成員管理和治理互動處於禁用或缺失狀態
5. `@global` 的“內建只讀”定位尚未在業務介面層被系統化約束

本設計目標是把 namespace 從“基礎協作物件”提升為“完整治理物件”。

## 2. 目標與非目標

### 2.1 目標

- 補齊團隊名稱空間狀態管理：凍結、解凍、歸檔、恢復
- 明確 `@global` 為不可變系統空間
- 拆分公開讀模型和管理臺讀模型
- 統一 namespace 狀態對發布、稽核、提升、公開可見性的影響
- 補齊管理臺頁面互動與狀態提示
- 為狀態變更增加審計記錄和穩定錯誤語義

### 2.2 非目標

- 不新增“刪除名稱空間”能力
- 不重構 skill 生命週期模型
- 不引入新的平臺後臺審批流
- 不改變現有 namespace 基礎資料結構

## 3. 生命週期模型

### 3.1 名稱空間型別邊界

#### GLOBAL

- 代表系統內建公共空間（`@global`）
- 只允許讀取
- 不允許更新基礎資訊
- 不允許成員增刪改
- 不允許凍結、解凍、歸檔、恢復
- 不允許轉讓所有權

#### TEAM

- 普通團隊協作空間
- 支援完整生命週期治理

### 3.2 狀態機

僅 `TEAM` 型別可發生以下流轉：

```text
ACTIVE -> FROZEN
FROZEN -> ACTIVE
ACTIVE -> ARCHIVED
FROZEN -> ARCHIVED
ARCHIVED -> ACTIVE
```

不支援以下流轉：

- `ARCHIVED -> FROZEN`
- 任意對 `GLOBAL` 型別的狀態變更

### 3.3 狀態語義

#### ACTIVE

- 公開可見
- 成員可管理
- 可發布、可稽核、可提升

#### FROZEN

- 只讀態
- 公開內容仍可瀏覽和下載
- 成員仍可檢視空間詳情、成員列表、稽核列表
- 禁止發布新版本
- 禁止稽核操作
- 禁止發起提升
- 禁止編輯名稱空間資訊
- 禁止成員增刪改
- 禁止所有權轉移

#### ARCHIVED

- 軟歸檔
- 公開列表、公開搜尋、公開詳情預設隱藏
- 普通使用者不可下載
- 名稱空間成員仍可在管理臺看到該空間
- 除恢復外，禁止所有寫操作
- 恢復後回到 `ACTIVE`

## 4. 許可權矩陣

### 4.1 團隊空間角色許可權

| 操作 | OWNER | ADMIN | MEMBER |
|------|-------|-------|--------|
| 編輯空間基礎資訊 | `ACTIVE` 可 | `ACTIVE` 可 | 不可 |
| 新增/移除成員 | `ACTIVE` 可 | `ACTIVE` 可 | 不可 |
| 修改成員角色 | `ACTIVE` 可 | `ACTIVE` 可 | 不可 |
| 轉讓所有權 | `ACTIVE` 可 | 不可 | 不可 |
| 凍結 | 可 | 可 | 不可 |
| 解凍 | 可 | 可 | 不可 |
| 歸檔 | 可 | 不可 | 不可 |
| 恢復 | 可 | 不可 | 不可 |

### 4.2 全域性空間許可權

`@global` 不接受任何業務寫操作。無論呼叫者擁有哪些平臺角色或 namespace 角色，都返回“系統內建名稱空間不可修改”錯誤。

## 5. 後端架構設計

### 5.1 服務拆分

建議新增 `NamespaceGovernanceService`，負責所有 namespace 生命週期變更：

- `freezeNamespace`
- `unfreezeNamespace`
- `archiveNamespace`
- `restoreNamespace`

現有服務職責調整如下：

- `NamespaceService`
  - 建立名稱空間
  - 查詢 namespace
  - 更新基礎資訊
  - 只保留基礎管理員校驗
- `NamespaceMemberService`
  - 成員增刪改
  - 所有權轉移
- `NamespaceGovernanceService`
  - 生命週期狀態流轉
  - `@global` 只讀校驗
  - 狀態合法性校驗
  - 審計記錄

建議補充 `NamespaceAccessPolicy` 或同級幫助類，集中回答以下問題：

- 當前 namespace 是否允許編輯
- 是否允許成員管理
- 是否允許發布
- 是否允許稽核
- 是否允許提升
- 是否允許公開訪問

### 5.2 控制器設計

現有 [`NamespaceController`](/Users/yunzhi/Documents/skillhub/server/skillhub-app/src/main/java/com/iflytek/skillhub/controller/portal/NamespaceController.java) 增加以下端點：

```text
GET  /api/v1/me/namespaces
POST /api/v1/namespaces/{slug}/freeze
POST /api/v1/namespaces/{slug}/unfreeze
POST /api/v1/namespaces/{slug}/archive
POST /api/v1/namespaces/{slug}/restore
```

Web 別名同步開放在 `/api/web/...`。

### 5.3 公開檢視與管理檢視拆分

#### 公開檢視

- `GET /api/v1/namespaces`
  - 僅返回 `ACTIVE` namespace
- `GET /api/v1/namespaces/{slug}`
  - 匿名或普通公開訪問僅可讀取 `ACTIVE`
  - `ARCHIVED` 對非成員按不可見處理

#### 管理檢視

- `GET /api/v1/me/namespaces`
  - 返回當前使用者所屬 namespace
  - 包含 `ACTIVE / FROZEN / ARCHIVED`
  - 用於“我的名稱空間”頁面

這是本次設計的關鍵修正：當前前端“我的名稱空間”錯誤複用了公開 `/namespaces`，必須改為管理檢視介面。

## 6. 跨模組業務約束

### 6.1 發布鏈路

在 [`SkillPublishService`](/Users/yunzhi/Documents/skillhub/server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/service/SkillPublishService.java) 中增加 namespace 狀態校驗：

- `FROZEN`：拒絕發布新版本
- `ARCHIVED`：拒絕發布新版本

錯誤語義建議區分：

- `namespace.frozen`
- `namespace.archived`

### 6.2 稽核鏈路

稽核相關寫操作在 namespace 非 `ACTIVE` 時全部拒絕：

- 提交稽核
- 稽核透過
- 稽核拒絕
- 撤回提審後再次提審

稽核列表是否可讀：

- `FROZEN`：可讀，不可寫
- `ARCHIVED`：成員可讀，不可寫

### 6.3 提升鏈路

`PromotionController` 發起提升時增加 namespace 狀態校驗：

- `FROZEN`：拒絕發起
- `ARCHIVED`：拒絕發起

### 6.4 公開可見性

#### namespace 層

- 公開列表只顯示 `ACTIVE`
- 歸檔空間不進入公開目錄

#### skill 層

- 若所屬 namespace 為 `ARCHIVED`，公開搜尋和公開詳情頁不再暴露該 skill
- 若所屬 namespace 為 `FROZEN`，skill 仍可公開瀏覽和下載

## 7. 前端互動設計

涉及頁面：

- [`web/src/pages/dashboard/my-namespaces.tsx`](/Users/yunzhi/Documents/skillhub/web/src/pages/dashboard/my-namespaces.tsx)
- [`web/src/pages/dashboard/namespace-members.tsx`](/Users/yunzhi/Documents/skillhub/web/src/pages/dashboard/namespace-members.tsx)
- [`web/src/pages/dashboard/namespace-reviews.tsx`](/Users/yunzhi/Documents/skillhub/web/src/pages/dashboard/namespace-reviews.tsx)
- [`web/src/features/namespace/namespace-header.tsx`](/Users/yunzhi/Documents/skillhub/web/src/features/namespace/namespace-header.tsx)

### 7.1 我的名稱空間

- 資料來源切換為 `GET /api/web/me/namespaces`
- 卡片展示 status badge
- 團隊空間顯示治理操作入口
- `@global` 顯示“系統內建，只讀”提示

按鈕可見性：

- `OWNER`
  - `ACTIVE`: 凍結、歸檔
  - `FROZEN`: 解凍、歸檔
  - `ARCHIVED`: 恢復
- `ADMIN`
  - `ACTIVE`: 凍結
  - `FROZEN`: 解凍
  - `ARCHIVED`: 無治理按鈕
- `MEMBER`
  - 無治理按鈕

### 7.2 成員管理頁

- `ACTIVE`：允許新增成員、改角色、移除成員
- `FROZEN / ARCHIVED`：列表仍可讀，但操作按鈕禁用
- 頁面頂部展示只讀狀態說明

### 7.3 稽核頁

- `ACTIVE`：正常稽核
- `FROZEN / ARCHIVED`：列表可讀，稽核按鈕禁用
- 頁面頂部展示“當前名稱空間不可處理稽核任務”

### 7.4 名稱空間頭部

[`NamespaceResponse`](/Users/yunzhi/Documents/skillhub/server/skillhub-app/src/main/java/com/iflytek/skillhub/dto/NamespaceResponse.java) 已包含 `status`，前端只需新增狀態 badge 和說明文案，無需調整響應結構。

## 8. 審計與錯誤語義

### 8.1 審計動作

複用 `AuditLogService`，新增以下 action：

- `FREEZE_NAMESPACE`
- `UNFREEZE_NAMESPACE`
- `ARCHIVE_NAMESPACE`
- `RESTORE_NAMESPACE`

審計物件：

- resourceType: `NAMESPACE`
- resourceId: namespace.id

建議 detail 中記錄：

- `slug`
- `fromStatus`
- `toStatus`
- `reason`（可選）

### 8.2 錯誤語義

建議統一以下錯誤類別：

- `error.namespace.system.immutable`
  - 對 `@global` 發起任意寫操作
- `error.namespace.state.transition.invalid`
  - 非法狀態流轉
- `error.namespace.frozen`
  - 凍結態下執行寫操作
- `error.namespace.archived`
  - 歸檔態下執行寫操作或公開訪問受限資源

公開訪問歸檔空間時，對非成員優先按“不可見”處理，而不是顯式暴露“已歸檔”。

## 9. 資料與介面相容性

### 9.1 資料層

- 現有 `namespace.status` 欄位已存在，無需遷移
- 現有 `NamespaceResponse` 已帶 `status` 欄位，無需擴充套件 DTO

### 9.2 介面層

- 保留現有公開 `/namespaces`
- 新增 `/me/namespaces` 供管理臺使用
- 現有前端查詢需要切換，避免繼續把公開目錄誤用為我的空間

### 9.3 行為層

- `ARCHIVED` namespace 下的 skill 公開入口行為會收緊
- 管理臺會首次出現凍結/歸檔空間

## 10. 測試策略

### 10.1 後端單元測試

- `NamespaceGovernanceServiceTest`
  - 凍結/解凍/歸檔/恢復合法流轉
  - `@global` 不可變
  - `OWNER/ADMIN/MEMBER` 許可權矩陣
- `NamespaceServiceTest`
  - 凍結/歸檔狀態下禁止基礎資訊更新
- `NamespaceMemberServiceTest`
  - 凍結/歸檔狀態下禁止成員管理和所有權轉移
- `SkillPublishServiceTest`
  - `FROZEN / ARCHIVED` namespace 下發布失敗
- 稽核/提升相關服務測試
  - 非 `ACTIVE` namespace 下寫操作失敗

### 10.2 控制器測試

- `NamespaceControllerTest`
  - `GET /me/namespaces`
  - `POST /freeze`
  - `POST /unfreeze`
  - `POST /archive`
  - `POST /restore`
- 公開介面測試
  - 歸檔空間對匿名使用者不可見

### 10.3 前端測試

- 我的名稱空間狀態 badge 與治理按鈕可見性
- 成員頁只讀態
- 稽核頁只讀態
- `@global` 無治理入口

## 11. 實施順序建議

1. 後端生命週期服務與許可權矩陣
2. 跨模組狀態攔截（發布、稽核、提升、公開可見性）
3. `GET /me/namespaces` 管理檢視介面
4. 前端管理臺接入與狀態互動
5. 審計與檔案補齊

## 12. 風險與取捨

### 風險

- 若只改 namespace 介面、不改 skill/search/review 約束，會產生狀態語義不一致
- 若繼續複用公開 `/namespaces` 作為管理臺資料來源，凍結/歸檔空間無法被恢復

### 取捨

- 本次不增加刪除能力，避免把“歸檔”和“刪除”混淆
- 恢復統一回到 `ACTIVE`，不保留“恢復到凍結”的複雜分支
- `@global` 完全只讀，避免未來平臺和團隊混用治理規則
