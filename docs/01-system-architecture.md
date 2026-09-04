# skillhub 系統架構設計

## 1. 技術基線

- JDK: 21
- Framework: Spring Boot 3.x（最新穩定版）
- Security: Spring Security + spring-boot-starter-oauth2-client
- Database: PostgreSQL 16.x
- Cache/Session: Redis 7.x（一期必須依賴，用於 Session 儲存 + 分散式鎖 + 冪等去重）
- Object Storage: `LocalFile` + S3 協議相容物件儲存雙實現
- Search: PostgreSQL Full-Text Search（一期）
- Future Search: Elasticsearch / OpenSearch / Vector Search

## 2. 總體架構

採用單體優先、模組化單體設計。業務域清晰，一期規模不需要拆分微服務。

## 3. 後端模組結構

```
server/
├── skillhub-app                 # 啟動、配置裝配、Controller 聚合
├── skillhub-domain              # 領域模型 + 領域服務 + 應用服務
├── skillhub-auth                # OAuth2 認證 + RBAC + 授權判定
├── skillhub-search              # 搜尋 SPI + PostgreSQL 全文實現
├── skillhub-storage             # 物件儲存抽象 + LocalFile/S3 雙實現
└── skillhub-infra               # JPA、通用工具、配置基礎
```

## 4. 模組依賴方向（依賴倒置，禁止領域層依賴基礎設施）

```
app → domain, auth, search, storage, infra
infra → domain          # infra 實現 domain 定義的 Repository 介面
auth → domain           # auth 引用 UserAccount 等領域實體
search → domain         # search 引用 SkillSearchDocument 等領域模型
storage → (獨立抽象)     # 純 SPI，不依賴 domain
```

核心原則：
- domain 是最內層，不依賴任何其他模組，只定義介面和實體
- infra 實現 domain 中定義的 Repository 介面（Spring Data JPA）
- app 負責裝配所有模組，透過 Spring 依賴注入將 infra 實現注入 domain 介面
- 禁止 domain → infra 方向的依賴，避免領域層與 JPA、事件實現綁死

## 5. 各模組職責

### skillhub-app
- Spring Boot 啟動類
- Controller 聚合：公開查詢、認證後寫介面、CLI API、相容層、管理後臺
- 全域性異常處理、請求日誌、OpenAPI 配置
- 配置檔案與環境 profile
- 應用層 boundary 約定：
  - Controller 只負責 transport：鑑權上下文提取、請求引數繫結、響應包裝
  - App Service 負責 workflow orchestration：跨 domain service 協調、分頁入口、審計欄位傳遞、呼叫 dedicated query repository
  - App Service 不直接承擔複雜 read-model 拼裝；當一個響應需要 join 多個聚合、快照欄位、JSON 解析、展示態投影時，應優先抽成 query repository
  - `skillhub-app/repository` 包中的 query repository 只服務應用層讀模型，不承載領域寫規則

### skillhub-domain
- 核心實體：Skill, SkillVersion, SkillFile, SkillTag, Namespace, NamespaceMember, ReviewTask, PromotionRequest, AuditLog, SkillStar, SkillRating, IdempotencyRecord
- 領域服務：發布流程編排、稽核狀態機、名稱空間管理、標籤管理
- 應用服務：聚焦領域規則與用例編排
- Repository 介面定義（實現在 infra）

### skillhub-auth
- Spring Security OAuth2 Client 配置（一期 GitHub，可擴充套件多 Provider）
- `CustomOAuth2UserService`：OAuth2 使用者 → 平臺使用者對映
- `IdentityBindingService`：外部身份 → 平臺使用者繫結
- Spring Session (Redis) 管理
- CLI Device Flow 授權、輪詢與憑證簽發
- API Token 簽發、校驗、吊銷
- RBAC：角色定義、許可權點、資源級授權判定
- 使用者實體：UserAccount, IdentityBinding, ApiToken, Role, Permission, UserRoleBinding

### skillhub-search
- SPI 介面：`SearchIndexService`, `SearchQueryService`, `SearchRebuildService`
- 一期實現：`PostgresFullTextIndexService`, `PostgresFullTextQueryService`
- 獨立搜尋檔案表 `skill_search_document`
- 未來擴充套件點：ES / 向量檢索實現

### skillhub-storage
- SPI 介面：`ObjectStorageService`
- 一期實現：`LocalFileStorageService`（本地開發/零依賴）+ `S3StorageService`（整合測試/生產）
- 檔案雜湊校驗、打包下載
- 物件 key 規則（使用不可變 ID，避免名稱空間變更導致 key 失效）：
  - 正式路徑：`skills/{skillId}/{versionId}/{filePath}`
  - 打包路徑：`packages/{skillId}/{versionId}/bundle.zip`

### skillhub-infra
- Spring Data JPA Repository 實現
- Repository 實現
- 通用工具（ID 生成、時間、JSON 等）
- Spring Events 非同步事件基礎設施

## 6. 前端工程結構

```
web/
├── src/
│   ├── app/              # 路由、全域性 Provider、佈局
│   ├── pages/            # 頁面入口
│   ├── features/         # 搜尋、上傳、版本管理、稽核等業務功能
│   ├── entities/         # skill、user、namespace 等領域展示邏輯
│   ├── shared/           # 通用元件、hooks、工具
│   └── api/              # openapi-typescript 生成的型別 + openapi-fetch 客戶端
├── package.json
└── vite.config.ts
```

技術棧：React 19 + TypeScript + Vite + shadcn/ui + Tailwind CSS + TanStack Query + TanStack Router + openapi-fetch

## 7. Monorepo 頂層結構

```
skillhub/
├── server/               # Maven 多模組 Java 後端
│   └── Dockerfile        # 後端多階段構建
├── web/                  # React 前端
│   ├── Dockerfile        # 前端多階段構建
│   ├── nginx.conf.template        # Nginx 執行時模板
│   └── runtime-config.js.template # 前端執行時環境變數模板
├── docker-compose.yml    # 本地開發依賴服務（PostgreSQL/Redis/MinIO）
├── compose.release.yml   # 單機執行時編排（發布映象 + PostgreSQL + Redis）
├── .env.release.example  # 單機執行時環境變數模板
├── .github/workflows/    # GitHub Actions 映象發布流程
├── Makefile              # 頂層開發編排（dev / dev-all / build）
├── docs/                 # 設計檔案
└── README.md
```

簡單分目錄，各自獨立構建，Makefile 串聯。

## 8. 部署架構

部署模型收斂為兩條路徑：

- 開發路徑：`make dev-all`。前後端在宿主機執行，`docker-compose.yml` 只負責 PostgreSQL、Redis、MinIO。
- 交付路徑：GitHub Actions 構建併發布 `server` / `web` 映象；使用者透過 `compose.release.yml` 在本地一鍵拉起前後端容器和基礎服務。
- 發布映象為多架構 manifest：`server` / `web` 覆蓋 `linux/amd64`、`linux/arm64` 與
  `linux/riscv64`；`scanner` 暫保持 `linux/amd64` 與 `linux/arm64`。

單機執行時統一入口：
- `http://localhost/` → Web 容器（Nginx）
- `http://localhost/api/*` → Web 容器反向代理到 Spring Boot
- `http://localhost:8080/actuator/health` → 後端健康檢查

單機執行時預設使用 `docker` profile：
- `docker` 負責容器執行時初始化，例如首個管理員賬戶
- 資料庫、Redis、物件儲存、站點公網地址都透過環境變數注入
- 生產環境不啟用 `local` profile，因此不會暴露 mock 登入旁路

## 9. 分散式環境要求

本服務在 K8s 中部署多個 Pod，所有元件必須無狀態設計。

| 元件 | 一期要求 | 職責 |
|------|---------|------|
| PostgreSQL 16.x | 主從 | 主儲存 |
| Redis 7.x | Sentinel 或 Cluster | Session 儲存 + 分散式鎖 + 冪等去重 |
| 物件儲存 | LocalFile（開發）/ MinIO / 雲廠商 S3 | 技能包檔案 + 預打包 zip |
| Ingress | Nginx Ingress Controller | 路由分發 + TLS 終止 |

## 10. 推薦的一期技術決策

- ORM：Spring Data JPA (Hibernate)
- API 檔案：Springdoc OpenAPI
- 物件儲存：開發預設 LocalFile，整合測試/生產使用 MinIO / AWS S3 相容介面
- 非同步任務：Spring Events + 非同步執行緒池，後續視複雜度引入 MQ
- 快取/Session：Spring Session + Redis
- 資料庫遷移：Flyway
- 認證：Spring Security OAuth2 Client（一期 GitHub）
- 映象發布：GitHub Actions 推送至 GHCR，預設維護 `edge` 與語義化版本標籤
- 執行時相容：`server` / `web` 發布映象預設輸出 `linux/amd64` + `linux/arm64` +
  `linux/riscv64` 多架構 manifest，`scanner` 暫保持 `linux/amd64` + `linux/arm64`

## 11. Repository / Query Boundary 約定

為了減少“應用層直接拼讀模型”和“repository 風格混用”帶來的認知成本，後端按下面的規則收斂：

### 11.1 Domain Repository Port

- 放在 `skillhub-domain`
- 服務於聚合讀寫、狀態遷移、規則判斷
- 可以被 domain service 直接依賴
- 返回值以領域物件和領域查詢語義為主；當前程式碼裡允許繼續使用 Spring Data 的 `Page` / `Pageable`，但這是現階段接受的折中，不代表所有新讀模型都應繼續擴大這一模式

適用場景：

- `SkillRepository`、`ReviewTaskRepository`、`PromotionRequestRepository`
- 領域規則需要讀取或持久化聚合本身
- 一個用例的核心價值在“改變狀態”而不是“拼響應”

### 11.2 App Query Repository

- 放在 `skillhub-app/repository`
- 服務於 controller / app service 需要的 read model，而不是領域寫規則
- 輸入通常是領域物件列表、分頁結果內容或穩定 ID 集合
- 輸出通常是 DTO、summary card、inbox item、admin list row 之類的展示態模型

適用場景：

- 需要 join 多個 repository / service 結果
- 需要做展示態投影、相容層對映、舊欄位快照回填、JSON 提取
- 同一類 read-model 組裝邏輯會被多個 app service / controller 複用

當前樣例：

- `GovernanceQueryRepository`
- `MySkillQueryRepository`
- `ProfileReviewQueryRepository`

### 11.3 App Service

- 放在 `skillhub-app/service`
- 負責 workflow owner 語義，而不是底層資料拼接細節
- 可以同時呼叫 domain service、domain repository port、app query repository
- 應優先表達“這個入口做什麼”，而不是“這個入口怎樣拼 DTO”

允許：

- 解析篩選條件、分頁引數、平臺角色
- 選擇呼叫哪條 domain workflow
- 呼叫 query repository 組裝最終 read model

不鼓勵：

- 在 app service 裡重複寫批次 user lookup、namespace join、version projection、JSON 欄位提取
- 讓多個 app service 各自複製同類 summary/inbox/list row 組裝程式碼

### 11.4 直接 Persistence Access

- 僅在少數場景允許，例如高度專用的搜尋 SQL、管理端特殊檢索、相容層過渡適配
- 這類入口應儘量集中，並透過命名或 package docs 明確“它為什麼沒有走 domain repository port 或 app query repository”

### 11.5 選擇規則

面對一個新讀用例時，按下面順序判斷：

1. 如果它主要服務狀態遷移或領域規則判斷，優先放在 domain repository port / domain service。
2. 如果它主要服務頁面、列表、詳情響應組裝，而且需要 join 多個來源，優先建 app query repository。
3. 如果它只是一個很薄的單聚合讀取，不需要額外投影或 join，可以直接由 app service 呼叫現有 domain repository/query service。
4. 如果必須直接寫 SQL 或 `EntityManager`，需要在類註釋裡說明原因和邊界，避免它演變成預設模式。
