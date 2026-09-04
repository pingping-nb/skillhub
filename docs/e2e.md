# SkillHub Web E2E 測試說明（真實請求版）

本檔案描述當前 `web/e2e` 的真實請求（non-mock）測試體系、執行方式與維護規範。

## 1. 當前狀態

`web/e2e` 已完成 API mock 遷移，現狀如下：

- 不再使用 `helpers/route-mocks.ts`、`helpers/api-fixtures.ts`、`helpers/assertions.ts`
- 不在 spec 內使用 `page.route('**/api/...')` 攔截 API
- 透過 Playwright `request`（`page.context().request`）與後端進行真實認證與資料互動
- 關鍵會話 helper：`web/e2e/helpers/session.ts`

當前 Playwright 配置（`web/playwright.config.ts`）：

- `baseURL`: `http://localhost:3000`
- 瀏覽器：`chromium`
- `workers`: `1`（真實請求模式下優先穩定性）
- `fullyParallel`: `false`
- `reporter`: `html`
- `trace: 'on-first-retry'`
- `screenshot: 'on'`
- `webServer.command`: `pnpm exec vite --host 127.0.0.1 --port 3000 --strictPort`

## 2. 目錄結構

```text
web/
├── e2e/
│   ├── auth-entry.spec.ts
│   ├── dashboard-shell.spec.ts
│   ├── landing-navigation.spec.ts
│   ├── public-pages.spec.ts
│   ├── route-guard.spec.ts
│   ├── settings-pages.spec.ts
│   ├── tokens.spec.ts
│   └── helpers/
│       ├── auth-fixtures.ts
│       ├── session.ts
│       └── test-data-builder.ts
├── playwright.config.ts
└── playwright.smoke.config.ts
```

職責約定：

- `web/e2e/*.spec.ts`：按使用者業務流組織測試
- `web/e2e/helpers/auth-fixtures.ts`：locale 等非網路輔助
- `web/e2e/helpers/session.ts`：真實認證會話建立（登入/註冊 + worker 級隔離）
- `web/e2e/helpers/test-data-builder.ts`：通用測試資料構建與清理（namespace/skill/review）

## 3. 當前覆蓋範圍

當前真實請求 E2E 覆蓋 23 個 spec：

- `auth-entry.spec.ts`：登入入口、註冊入口、`returnTo` 保留
- `landing-navigation.spec.ts`：首頁導航與匿名受限跳轉
- `public-pages.spec.ts`：公開法律頁面可達
- `search-flow.spec.ts`：搜尋查詢狀態與匿名收藏篩選跳轉登入
- `route-guard.spec.ts`：匿名攔截與登入後訪問受保護路由
- `skill-detail-browse.spec.ts`：登入後名稱空間/技能詳情不存在場景
- `dashboard-shell.spec.ts`：Dashboard 基礎殼層與快捷入口
- `dashboard-routes.spec.ts`：Dashboard 主要子路由可達與名稱空間治理頁面可達
- `workspace-pages.spec.ts`：我的技能/我的名稱空間工作臺頁面可達
- `my-namespaces-data.spec.ts`：透過 request 建立 namespace 並在工作臺驗證可見
- `my-skills-data.spec.ts`：透過 request 發布 skill 並在工作臺驗證可見
- `my-skills-navigation.spec.ts`：從我的技能列表進入技能詳情並返回
- `namespace-members-data.spec.ts`：透過 request 準備 namespace 後驗證成員管理頁可達
- `namespace-page-data.spec.ts`：透過 request 準備 namespace/skill 後驗證名稱空間公開頁可達
- `namespace-reviews-data.spec.ts`：透過 request 造 review 資料並驗證名稱空間稽核頁可達
- `publish-flow-ui.spec.ts`：在發布頁上傳真實 zip 並驗證發布後回到我的技能
- `dashboard-personal-modules.spec.ts`：`/dashboard/stars` 與 `/dashboard/notifications` 個人模組可達
- `settings-pages.spec.ts`：Profile/Security/Notifications 頁面基礎行為
- `settings-routing.spec.ts`：`/settings/accounts` 重定向到 `/settings/security`
- `tokens.spec.ts`：Token 管理入口可達
- `protected-routes.spec.ts`：匿名訪問 dashboard/admin 受保護路由跳轉登入
- `cli-auth.spec.ts`：CLI Auth 缺失引數錯誤路徑
- `role-access-control.spec.ts`：登入普通使用者訪問治理/管理臺受限路由會被回退

## 4. 執行命令

推薦優先使用根目錄命令：

```bash
make test-e2e-frontend
make test-e2e-smoke-frontend
```

在 `web` 目錄也可直接執行：

```bash
cd web && pnpm test:e2e
cd web && pnpm test:e2e:smoke
cd web && pnpm exec playwright test e2e/<feature>.spec.ts
cd web && pnpm test:e2e:ui
```

說明：

- 在你已手動啟動服務時，可直接執行 `cd web && pnpm test:e2e`
- 在 CI 或獨立環境中，可讓 Playwright 根據配置自動拉起前端服務

## 5. 編寫規範（真實請求）

### 5.1 嚴禁 API mock

新增或修改 E2E 時，禁止：

- 引入 `page.route('**/api/...')`
- 引入頁面級 API mock helper
- 在用例中偽造關鍵業務響應

### 5.2 認證統一走 `session.ts`

- 需要登入態的用例統一複用 `registerSession(page, testInfo)`
- 透過 worker 級賬號隔離避免併發衝突
- 不在 spec 內重複手寫登入/註冊流程

### 5.3 選擇器優先順序

- `getByRole`
- `getByLabel`
- `getByTestId`

避免結構耦合高的 CSS 深層選擇器。

### 5.4 禁止盲等

不要新增 `waitForTimeout`。優先：

- `await expect(locator).toBeVisible()`
- `await expect(page).toHaveURL(...)`
- `await expect(locator).toContainText(...)`

## 6. Smoke 規則

Smoke 只保留關鍵路徑，目標是快且穩，不追求覆蓋面最大。

當前 smoke 套件建議包含：

- `auth-entry.spec.ts`
- `landing-navigation.spec.ts`
- `route-guard.spec.ts`
- `dashboard-shell.spec.ts`

## 7. 常見問題排查

- 認證失敗：先確認後端可達（`http://localhost:8080`）且註冊/登入介面正常
- 用例偶發失敗：優先檢查選擇器歧義和斷言時機，不要用固定等待掩蓋
- 併發衝突：確認用例是否複用統一 helper，並避免共享可變測試資料

## 8. 驗收口徑

滿足以下條件視為遷移完成：

- `web/e2e/**/*.spec.ts` 不含 API mock
- 真實請求路徑可達並穩定
- `cd web && pnpm test:e2e` 全量透過
- `cd web && pnpm test:e2e:smoke` 透過
