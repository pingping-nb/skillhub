# skillhub 前端架構設計

## 1 技術棧

| 類別 | 選型 | 說明 |
|------|------|------|
| 框架 | React 19 + TypeScript | |
| 構建 | Vite | |
| 路由 | TanStack Router | |
| 資料獲取 | TanStack Query | 管理所有服務端資料（API 響應快取、載入/錯誤狀態） |
| UI 元件 | shadcn/ui + Radix UI | |
| 樣式 | Tailwind CSS | |
| 本地狀態 | Zustand | 僅管理純客戶端狀態 |
| API 客戶端 | openapi-fetch + openapi-typescript | |
| 圖示 | Lucide React | |

### 1.1 Zustand 與 TanStack Query 職責邊界

- **TanStack Query**：管理所有服務端資料（API 響應快取、載入/錯誤狀態）
- **Zustand**：僅管理純客戶端狀態（UI 偏好、側邊欄展開、主題、當前選中的名稱空間過濾等）
- 禁止在 Zustand 中快取服務端資料

## 2 頁面結構

### 2.1 門戶區（公開，匿名可訪問）

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 首頁 | `/` | 精選/熱門/最新、搜尋入口 |
| 搜尋頁 | `/search` | 關鍵詞搜尋 + 過濾 + 排序 |
| 名稱空間主頁 | `/@{namespace}` | 空間介紹 + 技能列表 |
| 技能詳情頁 | `/@{namespace}/{slug}` | README 渲染、版本、評分、收藏、下載 |
| 版本歷史 | `/@{namespace}/{slug}/versions` | 版本列表 + changelog |

門戶區所有 PUBLIC 技能匿名可瀏覽和下載，無需登入。

### 2.2 個人中心（需登入）

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 我的技能 | `/dashboard/skills` | 我發布的技能 + 統一生命週期狀態 |
| 發布技能 | `/dashboard/publish` | zip 上傳 + 預覽 + 提交稽核 |
| 我的收藏 | `/dashboard/stars` | 收藏列表 |
| Token 管理 | `/dashboard/tokens` | 建立/檢視/吊銷 |
| 我的名稱空間 | `/dashboard/namespaces` | 參與的名稱空間 |

### 2.3 名稱空間管理（需空間 ADMIN）

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 成員管理 | `/dashboard/namespaces/{slug}/members` | 成員管理 |
| 空間稽核 | `/dashboard/namespaces/{slug}/reviews` | 待稽核列表 |

### 2.4 平臺管理（需對應平臺角色）

| 頁面 | 路徑 | 所需角色 | 說明 |
|------|------|---------|------|
| 稽核中心 | `/admin/reviews` | SKILL_ADMIN | 全域性待稽核列表 |
| 提升稽核 | `/admin/promotions` | SKILL_ADMIN | 提升到全域性的申請列表 |
| 技能管理 | `/admin/skills` | SKILL_ADMIN | 隱藏/恢復技能、撤回已發布版本 |
| 使用者管理 | `/admin/users` | USER_ADMIN | 使用者列表、角色分配、准入審批、封禁/解封 |
| 審計日誌 | `/admin/audit-logs` | AUDITOR | 操作日誌查詢 |
| 名稱空間管理 | `/admin/namespaces` | SUPER_ADMIN | 建立/歸檔/凍結 |

SUPER_ADMIN 可訪問所有管理頁面。路由守衛檢查使用者是否持有對應角色。

## 3 佈局結構

- 門戶區：頂部導航 + 內容區，無側邊欄，突出瀏覽體驗
- Dashboard / Admin：頂部導航 + 左側邊欄，管理效率優先
- 響應式：移動端側邊欄收起為抽屜

## 3.1 生命週期展示模型

前端不再從 `status + hidden + latestVersionStatus + viewingVersionStatus` 拼裝 skill 生命週期，而統一消費後端返回的 projection：

- `headlineVersion`：當前頁面主展示版本
- `publishedVersion`：當前最新已發布版本
- `ownerPreviewVersion`：owner / namespace 管理者可見的待稽核版本
- `resolutionMode`：`PUBLISHED` / `OWNER_PREVIEW` / `NONE`

約束：

- 詳情頁和“我的技能”列表統一以 `headlineVersion` 作為主展示版本
- 安裝、下載、promotion 等公開分發相關操作只允許繫結 `publishedVersion`
- `hidden` 是獨立治理覆蓋層，不屬於版本生命週期狀態機

## 4 登入與鑑權

### 4.1 OAuth2 登入流程（前端視角）

```
使用者點選"登入"按鈕
    │
    ▼
前端呼叫 GET /api/v1/auth/providers
    │
    ▼
渲染可用的 OAuth Provider 按鈕（一期只有 GitHub）
    │
    ▼
使用者點選 "Sign in with GitHub"
    │
    ▼
window.location.href = "/oauth2/authorization/github"
    │
    ▼
（瀏覽器跳轉到 GitHub → 授權 → 回撥後端 → 後端建立 Session）
    │
    ▼
後端重定向回前端頁面（如 / 或使用者之前訪問的頁面）
    │
    ▼
前端檢測到 Session Cookie，呼叫 GET /api/v1/auth/me
    │
    ▼
獲取使用者資訊，渲染登入態 UI
```

前端不需要任何 OAuth 庫，登入完全由後端 Spring Security 處理。前端只負責：
1. 呼叫 `/api/v1/auth/providers` 獲取可用 Provider 列表
2. 跳轉到對應的 `authorizationUrl`
3. 回撥後透過 `/api/v1/auth/me` 檢測登入態

### 4.2 預留的被動會話引導

為未來私有部署下的企業 SSO 相容，前端可在登入頁或應用初始化階段顯式呼叫：

- `POST /api/v1/auth/session/bootstrap`

該介面在開源版預設關閉；私有版啟用後，前端可在檢測到使用者未登入時主動呼叫一次，以嘗試將外部 SSO Cookie 換成 skillhub Session。該流程必須保持顯式觸發，不預設依賴全域性透明攔截器。

前端相容接入層約束如下：

- 預設不啟用，執行時配置不開啟時，登入頁和全域性行為與開源版完全一致
- 賬號密碼登入相容層與被動會話相容層相互獨立，可單獨啟用
- 啟用後，登入頁會出現一個“企業 SSO”相容入口
- 啟用密碼相容層後，登入頁賬號密碼錶單會改為呼叫通用直連認證介面
- 前端應優先消費 `/api/v1/auth/methods` 作為統一登入方式目錄；`/api/v1/auth/providers` 僅保留相容
- 可選自動嘗試，但仍限定在登入頁內執行，不在全站每次匿名訪問時自動探測
- bootstrap 失敗時應靜默回退到現有本地登入和 OAuth 登入，不打斷正常流程

前端執行時配置項：

- `SKILLHUB_WEB_AUTH_DIRECT_ENABLED`
- `SKILLHUB_WEB_AUTH_DIRECT_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_ENABLED`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_AUTO`

推薦策略：

- 私有版密碼直連：`auth_direct_enabled=true`，`auth_direct_provider=private-sso`
- 私有版初期：`enabled=true`，`provider=private-sso`，`auto=false`
- 驗證穩定後：再評估是否切到 `auto=true`

### 4.3 登入態檢測

```
頁面載入 → GET /api/v1/auth/me
              │
    ┌─────────┴──────────┐
    │ 200: 已登入          │ 401: 未登入
    │ 存入全域性狀態          │ 門戶頁正常展示（匿名瀏覽）
    │ 渲染登入態 UI         │ Dashboard/Admin 重定向到登入
    └────────────────────┘
```

- TanStack Router `beforeLoad` 做路由守衛
- Admin 路由額外檢查角色
- 前端許可權控制粒度詳見 [03-authentication-design.md](./03-authentication-design.md) 前端許可權控制粒度章節

## 5 API 整合工作流

```
後端 Springdoc → openapi.json
    → openapi-typescript 生成型別
    → openapi-fetch 建立客戶端
    → TanStack Query 封裝為 hooks
```

## 6 檔案上傳

一期 Web 端：zip 上傳 → 後端解壓校驗 → 返回預覽 → 使用者確認 → 提交稽核。
支援 drag-and-drop + 進度條。

## 7 關鍵互動

**技能詳情頁**：SKILL.md Markdown 渲染、右側資訊欄（版本/下載量/評分/收藏/標籤/空間）、版本切換、安裝命令一鍵複製（同時展示 skillhub CLI 格式 `install @namespace/slug` 和 ClawHub CLI 格式 `install canonical-slug`）。匿名使用者可瀏覽和下載，收藏/評分按鈕提示登入。

**搜尋頁**：實時搜尋（debounce 300ms）、技能卡片、排序（相關度/下載量/評分/最新）、名稱空間過濾。匿名使用者可搜尋 PUBLIC 技能。注意：一期搜尋僅基於 latest 版本內容，不支援按 tag/version 搜尋（詳見 `04-search-architecture.md` 5.1 節）。

**稽核頁面**：左側列表 + 右側內容預覽（Markdown + 檔案樹）、透過/拒絕 + 意見輸入。
