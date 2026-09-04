# skillhub 交付路線

## Phase 0：設計定稿（當前階段）

產出：架構設計檔案、資料庫 DDL、API OpenAPI spec 草案、前端線框圖

已凍結決策：
- 技能座標體系：`@{namespace_slug}/{skill_slug}`，相容層使用 `--` 雙連字元對映（詳見 `00-product-direction.md` 1.1 節）
- 一期同步發布模型，暫不考慮非同步發布
- API Token 一期繼承使用者全部許可權（非最小許可權），後續版本細化
- CLI 主認證切換為 OAuth Device Flow，Bearer Token 統一用於 CLI API 和相容層
- ClawHub CLI 相容層基地址 `/api/v1`，透過 `/.well-known/clawhub.json` 發現

## Phase 1：工程骨架 + 認證打通

### 後端

- Maven 多模組初始化（6 個模組）
- Spring Boot 啟動、配置、Profile 分層
- Flyway + 資料庫初始化
- Redis 整合（Session + 分散式鎖）
- Spring Security OAuth2 Client 配置（GitHub OAuth 登入）
- CustomOAuth2UserService + IdentityBindingService（自動註冊/繫結）
- Spring Session (Redis) 管理、API Token 簽發校驗
- RBAC 基礎（SUPER_ADMIN / SKILL_ADMIN / USER_ADMIN / AUDITOR + 名稱空間角色）
- 全域性異常處理、requestId 透傳、日誌格式
- Springdoc OpenAPI、健康檢查
- CSRF 防護（Cookie-to-Header 模式，CLI API 豁免）
- 本地開發 MockAuthFilter（`local` profile）
- 基礎限流：Nginx Ingress `limit-req` 按 IP 限流（認證/搜尋/下載介面）

### 前端

- Vite + React + TypeScript 初始化
- shadcn/ui + Tailwind 配置
- TanStack Router 路由骨架、TanStack Query 配置
- openapi-fetch 客戶端生成管線
- 佈局元件、OAuth 登入流程（呼叫 `/api/v1/auth/providers` → 跳轉）
- 登入態檢測（`/api/v1/auth/me`）+ 路由守衛
- Makefile 頂層編排

### 驗收

前後端能跑，GitHub OAuth 登入可用，AccessPolicy 准入策略生效，`/api/v1/auth/me` 可用，Token 可用，OpenAPI spec 可訪問，Ingress 基礎限流生效

## Phase 2：名稱空間 + Skill 核心鏈路

### 後端

- 名稱空間 CRUD + 成員管理
- 物件儲存整合（LocalFile + S3 雙實現）
- 技能發布（上傳 → 校驗 → 儲存 → 稽核 / 上線，一期同步處理）
- 技能查詢（詳情、版本、檔案）、下載（打包 + 可見性檢查，PUBLIC 匿名可下載）
- 標籤管理、搜尋（PostgreSQL Full-Text，匿名搜尋限 PUBLIC）
- 非同步事件基礎設施
- Rate Limiting 升級（應用層精細限流：按使用者/端點分類，基於 Redis 滑動視窗）

### 前端

- 首頁、搜尋頁、名稱空間主頁（匿名可訪問）
- 技能詳情頁、版本歷史頁（PUBLIC 匿名可瀏覽/下載）
- 發布頁、我的技能列表
- 名稱空間管理頁

### 驗收

完整發布 → 儲存 → 稽核 → 查詢 → 下載鏈路可用，搜尋可用，名稱空間隔離生效，匿名使用者可瀏覽/下載公共技能

## Phase 3：稽核流程 + 評分收藏 + CLI API / ClawHub 相容層

### 後端

- 稽核流程（提交 → 稽核 → 發布，含樂觀鎖）
- 團隊技能提升到全域性（promotion_request 流程）
- 評分 + 收藏 + 計數器（原子更新）
- OAuth Device Flow（device code、授權確認、輪詢換取 Bearer Token）
- CLI API（whoami、publish、resolve、check）
- ClawHub CLI 協議相容層（`/api/v1` 端點：search、resolve、download、publish、whoami）
- 相容層 canonical slug 對映（`--` 雙連字元規則）
- `/.well-known/clawhub.json` 發現端點
- 協議介面卡與相容性測試（針對 ClawHub CLI 的真實請求/響應樣例）
- 審計日誌（同步落庫）、冪等去重（idempotency_record + Redis）

### 前端

- 稽核中心、名稱空間稽核頁、提升稽核頁
- 評分元件 + 收藏按鈕（匿名使用者點選提示登入）、我的收藏頁
- Token 管理頁
- 管理後臺（使用者管理、角色分配、准入審批、封禁/解封）
- 前端 API 層收口：統一遷移到 OpenAPI 生成型別 + `openapi-fetch` 客戶端，淘汰業務頁面裡的手寫 `fetch`
- 建立 API 變更後的前端同步機制：後端 OpenAPI 更新後執行 `generate-api`，禁止生成型別與真實返回長期漂移

### 驗收

團隊空間自治稽核與全域性空間平臺稽核生效，skillhub CLI Device Flow 可用，ClawHub CLI 透過相容層可完成核心 registry 操作，評分收藏可用

## Phase 4：運維增強 + 打磨 + 開源就緒

### 後端

- 本地認證體系（使用者名稱密碼註冊/登入 + BCrypt + 密碼策略 + 賬號鎖定）
- 多賬號合併流程（發起 → 驗證 → 確認 → 資料遷移）
- 技能治理（隱藏/恢復 + 已發布版本撤回 YANKED）
- 審計日誌查詢 API（多條件篩選 + 分頁）
- Prometheus 指標暴露（Actuator + Micrometer 自定義業務指標）
- 效能最佳化（資料庫索引 + S3 預簽名 URL + 連線池調優）
- 安全加固（Session Cookie 安全 + 安全響應頭 + XSS 防護）

### 前端

- 註冊頁、登入頁擴充套件（使用者名稱密碼 + OAuth 雙模式）
- 密碼修改頁、賬號合併頁
- 審計日誌查詢頁
- 技能隱藏/恢復/已發布版本撤回操作（管理員可見）
- 前端程式碼分割（TanStack Router lazy routes）
- rehype-sanitize XSS 防護
- OpenAPI SDK 工程化：生成檔案納入 CI 校驗，避免新增介面回退到手寫呼叫

### 部署 & 開源

- Docker 一鍵啟動（多階段 Dockerfile + docker-compose + 種子資料）
- K8s 基礎部署清單（Deployment + Service + Ingress）
- README.md、CONTRIBUTING.md、GitHub Issue/PR 模板
- LICENSE（Apache 2.0）、CODE_OF_CONDUCT.md

### 驗收

本地認證可用，多賬號合併可用，技能隱藏/恢復/已發布版本撤回可用，審計日誌可查詢，Prometheus 指標可拉取，`docker compose up` 一鍵啟動，K8s 清單可部署，開源基礎設施齊全

## Phase 5：治理閉環 + 社交

- 評論功能
- 舉報/標記機制（使用者舉報 → 管理員處理 → 隱藏/已發布版本撤回）
- 自動安全預檢（`PrePublishValidator` 從當前 `NoOp` 擴充套件為真實校驗鏈）
- Webhook/事件通知（發布通知、稽核結果通知）
- 後續 OAuth Provider 擴充套件（GitLab、Google 等）
- 向量搜尋第二階段增強（當前第一階段僅做搜尋增強，不做推薦）

## 主要風險與應對

| 風險 | 應對 |
|------|------|
| GitHub OAuth 回撥配置複雜 | 本地用 MockAuthFilter 解耦，OAuth 聯調可並行 |
| 稽核流程需求變更 | 生命週期狀態機已收斂到 `DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / YANKED`，讀模型透過統一 projection 暴露 |
| 搜尋效果不佳 | SPI 架構允許隨時切換實現 |
| 前後端介面頻繁變更 | OpenAPI spec 先行，型別自動生成 |
| 新增 OAuth Provider | Spring Security OAuth2 原生多 Provider 支援，只需配置 + 屬性對映 |
| ClawHub CLI 協議細節與現有模型不完全一致 | 相容層使用 `--` 雙連字元 canonical slug 對映，獨立 Controller 層適配，協議迴歸測試覆蓋 |

## 測試演進策略

- 當前階段（Phase 2 驗證優先）：本地透過 `docker-compose.yml` 啟動 PostgreSQL、Redis、MinIO，後端與整合測試直接連線真實依賴，優先驗證發布、搜尋、下載、限流等基礎設施相關鏈路
- 後續階段（工程化收口）：逐步把後端整合測試遷移到 Testcontainers，由測試程式碼按需拉起 PostgreSQL、Redis、MinIO，減少對手工啟動本地依賴的要求，並納入 CI
- 前端階段性要求：後端 API 契約穩定後，前端必須同步重新整理 OpenAPI 生成型別並校驗關鍵頁面；統一響應結構變更不允許只改後端不改前端
- 原則：單元測試可繼續使用 mock/in-memory 替身，但 Phase 2/3 的核心驗收必須保留一組基於真實中介軟體的整合測試，避免 Redis Lua、物件儲存、Flyway、搜尋 SQL 等問題被假實現掩蓋
