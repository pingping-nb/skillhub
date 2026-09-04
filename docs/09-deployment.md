# skillhub 部署架構與運維

## 1 執行模型

當前倉庫只保留兩種執行方式：

- 開發環境：`make dev-all`
  - 前端和後端執行在宿主機
  - `docker-compose.yml` 只負責 PostgreSQL、Redis、MinIO
- 單機交付環境：`docker compose --env-file .env.release -f compose.release.yml up -d`
  - 前端和後端都執行在容器內
- 使用 GitHub Actions 發布到 GHCR 的映象
- 預設發布多架構映象：`server` / `web` 覆蓋 `linux/amd64`、`linux/arm64` 與
  `linux/riscv64`，`scanner` 暫保持 `linux/amd64` 與 `linux/arm64`
  - PostgreSQL、Redis 與應用容器一起透過 Compose 啟動

不再維護本地構建整套 demo 容器的中間模式，也不再保留 `docker-compose.prod.yml`。

## 2 單機交付拓撲

```
┌──────────────┐
│ Browser / CLI│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Web/Nginx  │  published image
└──────┬───────┘
       │ /api/*
       ▼
┌──────────────┐
│ Spring Boot  │  published image
└───┬────┬─────┘
    │    │
    ▼    ▼
 PostgreSQL  Redis
```

說明：
- Web 容器提供靜態資源，並將 `/api/*`、`/oauth2/*`、`/.well-known/*` 反代到後端
- 後端預設執行 `docker` profile，不再啟用本地 mock 登入
- PostgreSQL / Redis 預設只繫結 `127.0.0.1`
- 物件儲存推薦使用外部 S3 / OSS，透過環境變數注入

## 3 Profile 約定

| Profile | 用途 | 說明 |
|---------|------|------|
| `local` | 本地原始碼開發能力 | 啟用 mock 登入、開發種子賬號、除錯日誌 |
| `docker` | 容器執行時能力 | 啟用容器執行時相關能力，不會自動開啟首登管理員 |

單機交付環境使用 `SPRING_PROFILES_ACTIVE=docker`，原因如下：

- 生產環境不應開啟 `X-Mock-User-Id` 這一類本地開發旁路能力
- 容器環境仍然保留 `docker` profile 的執行時能力，首個管理員賬戶初始化不依賴該 profile，透過環境變數控制
- 資料庫、Redis、OSS、站點公網地址全部改為環境變數優先

如需啟用首登管理員，來源於以下環境變數：

- `BOOTSTRAP_ADMIN_ENABLED=true`（發布模板預設已開啟）
- `BOOTSTRAP_ADMIN_USERNAME`（預設 `admin`）
- `BOOTSTRAP_ADMIN_PASSWORD`（預設 `ChangeMe!2026`）

建議：

- 生產環境務必修改 `BOOTSTRAP_ADMIN_PASSWORD`（`validate-release-config.sh` 會拒絕預設值）
- 完成首次登入後立即修改管理員密碼
- 如果已有外部身份源，通常不需要啟用 bootstrap admin
- `SKILLHUB_PUBLIC_BASE_URL` 應配置為最終 HTTPS 域名，避免 OAuth / Cookie / 裝置碼連結異常

## 4 開發環境

開發入口保持不變：

```bash
make dev-all
```

行為：

- `docker-compose.yml` 啟動 PostgreSQL、Redis、MinIO
- `server` 在宿主機透過 Maven Wrapper 啟動
- `web` 在宿主機透過 Vite 啟動

常用命令：

```bash
make dev
make dev-all
make dev-down
make dev-all-down
make dev-all-reset
```

## 5 單機交付環境

### 5.1 啟動

```bash
cp .env.release.example .env.release
make validate-release-config
docker compose --env-file .env.release -f compose.release.yml up -d
```

預設訪問地址：

- Web UI: `SKILLHUB_PUBLIC_BASE_URL`
- Backend API: `http://localhost:8080`

### 5.2 連線外部 Redis Cluster

發布 Compose 預設仍使用內建單機 Redis。連線外部 Redis Cluster 時，在
`.env.release` 中設定標準 Spring Boot 配置，不需要額外的模式開關：

```dotenv
SPRING_DATA_REDIS_CLUSTER_NODES=redis-0.example.com:6379,redis-1.example.com:6379,redis-2.example.com:6379
SPRING_DATA_REDIS_CLUSTER_MAX_REDIRECTS=5
SPRING_DATA_REDIS_USERNAME=skillhub
SPRING_DATA_REDIS_PASSWORD=replace-with-secret
SPRING_DATA_REDIS_SSL_ENABLED=true
SPRING_DATA_REDIS_CONNECT_TIMEOUT=5s
SPRING_DATA_REDIS_TIMEOUT=3s
```

Cluster 節點返回給客戶端的所有地址必須能從 `server` 容器訪問。Redis Cluster
只支援資料庫 `0`；不要為 Cluster 設定非零的
`SPRING_DATA_REDIS_DATABASE`。配置 Cluster 節點後，Spring Boot 自動忽略單機
`host`/`port`，Compose 中的內建 Redis 容器仍會啟動，但不會被 Server 使用。

對真實 Cluster 執行功能檢查：

```bash
REDIS_CLUSTER_TEST_NODES=redis-0.example.com:6379,redis-1.example.com:6379,redis-2.example.com:6379 \
REDIS_CLUSTER_TEST_USERNAME=skillhub \
REDIS_CLUSTER_TEST_PASSWORD=replace-with-secret \
make test-redis-cluster
```

該檢查覆蓋 Spring Data 讀寫、Spring Session 儲存/讀取/刪除和 Redisson Stream。

### 5.3 連線外部 Redis Sentinel

Sentinel 使用標準 Spring Boot 配置。資料節點和 Sentinel 可以使用不同 ACL：

```dotenv
SPRING_DATA_REDIS_SENTINEL_MASTER=mymaster
SPRING_DATA_REDIS_SENTINEL_NODES=sentinel-0.example.com:26379,sentinel-1.example.com:26379,sentinel-2.example.com:26379
SPRING_DATA_REDIS_USERNAME=skillhub
SPRING_DATA_REDIS_PASSWORD=replace-with-data-node-secret
SPRING_DATA_REDIS_SENTINEL_USERNAME=sentinel-user
SPRING_DATA_REDIS_SENTINEL_PASSWORD=replace-with-sentinel-secret
SKILLHUB_REDIS_SENTINEL_CHECK_SENTINELS_LIST=true
```

Sentinel 配置優先於 Cluster 和單機 `host`/`port`。在 Kubernetes 等 Sentinel
返回地址與客戶端入口不一致的環境中，可以將
`SKILLHUB_REDIS_SENTINEL_CHECK_SENTINELS_LIST` 設為 `false`。

### 5.4 關鍵檔案

- `compose.release.yml`
  - 使用發布映象，不在使用者機器上執行本地構建
  - 負責拉起 PostgreSQL、Redis、server、web
  - PostgreSQL、Redis 預設只繫結到 `127.0.0.1`
  - Web 和後端都支援執行時環境變數注入，不需要為每個環境重建映象
- `.env.release.example`
  - 執行時變數模板
  - 包含映象名、映象版本、埠、資料庫憑證、外部 OSS、站點公網地址和首登管理員引數
- `scripts/validate-release-config.sh`
  - 在啟動前校驗 `.env.release`
  - 可提前攔截佔位值、URL 格式錯誤、缺失的 OSS 憑據、危險的明文預設值

### 5.5 映象標籤約定

- `edge`
  - `main` 分支最新構建
  - 用於內部持續驗證
- `vX.Y.Z`
  - 對應 Git tag
  - 用於穩定版本交付
- `latest`
  - 僅在語義化版本 tag 發布時更新

推薦：

- 預設快速啟動：`SKILLHUB_VERSION=latest`
- 團隊內部試用：`SKILLHUB_VERSION=edge`
- 對外演示或嚴格可復現環境：固定為某個 `vX.Y.Z`

## 6 GitHub Actions 發布流程

發布工作流檔案：`.github/workflows/publish-images.yml`

觸發條件：

- `release.published`
- 手動 `workflow_dispatch`

流程：

1. 檢出程式碼
2. 登入 GHCR
3. 分別構建 `server/Dockerfile` 與 `web/Dockerfile`
4. 推送映象：
   - `ghcr.io/iflytek/skillhub-server`
   - `ghcr.io/iflytek/skillhub-web`
5. 寫入 `edge` / `vX.Y.Z` / `latest` / `sha-*` 標籤
6. 同時發布多架構 manifest：`server` / `web` 覆蓋 `linux/amd64`、`linux/arm64` 與
   `linux/riscv64`，`scanner` 暫保持 `linux/amd64` 與 `linux/arm64`

## 7 配置管理

### 7.1 請求限流配置

限流預設開啟。未配置分類覆蓋時，各介面使用程式碼中 `@RateLimit` 宣告的預設值，現有部署無需調整。

可透過環境變數關閉全部限流，或按分類覆蓋額度和時間視窗：

```bash
SKILLHUB_RATELIMIT_ENABLED=false
SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_ANONYMOUS=100
SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_AUTHENTICATED=300
SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_WINDOW_SECONDS=60
```

支援的配置欄位為 `authenticated`、`anonymous` 和 `window-seconds`。分類名稱來自介面的
`@RateLimit(category = "...")`，例如 `search`、`download`、`publish` 和 `resolve`。只設定其中一個欄位時，
其他欄位仍回退到介面預設值。

Docker Compose 使用者需要顯式傳入變數，宿主機環境變數不會自動注入容器：

```yaml
services:
  server:
    environment:
      SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_ANONYMOUS: "100"
      SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_AUTHENTICATED: "300"
      SKILLHUB_RATELIMIT_CATEGORIES_SEARCH_WINDOW_SECONDS: "60"
```

修改後重啟 server 容器生效。超過額度時介面返回 HTTP `429`；該配置只調整閾值，不改變 Redis 限流演算法或響應格式。

前端執行時配置透過 `web/runtime-config.js.template` 注入。與認證相容層相關的新變數如下：

- `SKILLHUB_WEB_AUTH_DIRECT_ENABLED`
  - 是否在前端開啟賬號密碼相容接入層
  - 預設應為 `false`
- `SKILLHUB_WEB_AUTH_DIRECT_PROVIDER`
  - 前端呼叫 `/api/v1/auth/direct/login` 時使用的 provider，例如 `private-sso`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_ENABLED`
  - 是否在前端開啟企業 SSO 被動會話相容入口
  - 預設應為 `false`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_PROVIDER`
  - 前端呼叫 `/api/v1/auth/session/bootstrap` 時使用的 provider，例如 `private-sso`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_AUTO`
  - 是否在登入頁載入後自動嘗試一次 bootstrap
  - 建議私有版初期保持 `false`

注意：

- 前端密碼相容層開啟之前，後端仍必須同步開啟 `skillhub.auth.direct.enabled=true`
- 前端開關開啟之前，後端仍必須同步開啟 `skillhub.auth.session-bootstrap.enabled=true`
- 前後端任一側未開啟，都不會破壞原有登入方式；只會使該相容入口不可用或不顯示

開發環境：

- 本地命令與 `docker-compose.yml`
- 非敏感預設值可直接落庫或寫入本地配置

單機交付環境：

- 使用 `.env.release` 管理 Compose 變數
- 如果 GHCR 包保持私有，使用者需要先 `docker login ghcr.io`
- 推薦將敏感變數放入 CI/CD Secret 或主機上的受控 `.env.release`
- 外部物件儲存透過 `SKILLHUB_STORAGE_S3_*` 注入
- 前端反代和執行時 API 地址透過 `SKILLHUB_API_UPSTREAM` / `SKILLHUB_WEB_API_BASE_URL` 注入
- `SKILLHUB_TRUST_FORWARDED_PROTO` 預設保持 `false`。只有 Web 容器僅能經由可信
  TLS 終止代理訪問，且該代理會覆蓋客戶端傳入的 `X-Forwarded-Proto` 時才設為
  `true`；否則客戶端可偽造協議並影響 OAuth 回撥、重定向和安全 Cookie 判斷
- 如果透過閘道器部署在 `/skillhub/` 等子路徑，需同時配置：
  - `SKILLHUB_WEB_BASE_PATH=/skillhub/`
  - `SKILLHUB_WEB_API_BASE_URL=/skillhub`
  - `SKILLHUB_PUBLIC_BASE_URL=https://example.com/skillhub`
  閘道器可以在轉發到 Web 容器前將該字首重寫掉，但公網 URL 仍必須保留字首，確保 OAuth、CLI 和 registry 連結正確。
- 如果要開放真實登入，再補充 `OAUTH2_GITHUB_CLIENT_ID` / `OAUTH2_GITHUB_CLIENT_SECRET`
- 如果要啟用密碼重置驗證碼郵件，參見：`docs/19-smtp-password-reset-email-setup.md`

## 8 OIDC 登入配置

SkillHub 複用 Spring Security OAuth2 Client 的 OIDC 支援。前端不需要單獨
配置回撥頁；登入頁會從 `/api/v1/auth/methods` 讀取後端暴露的
`OAUTH_REDIRECT` 方法並跳轉到 `/oauth2/authorization/{registrationId}`。

生產環境接入 OIDC 時，為後端增加一組 OAuth2 client registration 配置即可。
下面以 `oidc` 作為 registration id：

```bash
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_CLIENT_ID=replace-me
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_CLIENT_SECRET=replace-me
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_PROVIDER=oidc
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_AUTHORIZATION_GRANT_TYPE=authorization_code
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_REDIRECT_URI={baseUrl}/login/oauth2/code/{registrationId}
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_SCOPE=openid,profile,email
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_OIDC_CLIENT_NAME=OIDC
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER_URI=https://idp.example.com/realms/skillhub
```

要接入多個 OIDC IdP，使用不同 registration id，例如 `okta`、`keycloak`，
並把上面的環境變數中的 `OIDC` 替換為對應大寫 id。registration id 會作為
`identity_binding.provider_code`，請保持穩定。

> **警告：Registration ID 衝突**
>
> 每個 OIDC 提供商必須使用唯一的 registration ID。Registration ID 作為
> `identity_binding.provider_code` 儲存在資料庫中，用於將外部身份對映到平臺
> 使用者。如果兩個不同的 IdP 使用了相同的 registration ID（例如都使用 `oidc`），
> 會導致不同 IdP 的使用者 `sub` 值空間混用，可能出現身份繫結錯誤或賬戶衝突。
>
> 建議使用有意義的 registration ID，例如 `okta`、`keycloak`、`azure-ad`，
> 而不是通用的 `oidc`。一旦投入使用，不要更改 registration ID，否則現有使用者
> 將無法登入。

Docker Compose 發布模板預設只透傳常用變數。若使用 OIDC，請透過 compose
override 或部署平臺環境變數把上述 `SPRING_SECURITY_*` 變數注入 `server`
容器。Kubernetes 部署同理，將這些變數放入 `backend-deployment.yaml` 的
`server` 容器環境變數或統一的配置管理系統中。

## 9 裸金屬上線清單

推薦順序：

1. 準備伺服器基礎環境
   - 安裝 Docker Engine 與 Docker Compose Plugin
   - 配置公網 HTTPS 入口，確保最終訪問域名已經確定
   - 開啟 `80` / `443`，避免直接暴露 `5432` / `6379`
2. 填寫 `.env.release`
   - `SKILLHUB_PUBLIC_BASE_URL` 填最終 HTTPS 域名，且不要帶尾部 `/`；子路徑部署時必須包含外部路徑字首
   - `SKILLHUB_STORAGE_PROVIDER=s3`
   - 按雲廠商 OSS / S3 相容引數填寫 `SKILLHUB_STORAGE_S3_*`
   - 設定非預設的 `POSTGRES_PASSWORD`
   - 模板預設已開啟首登管理員，務必將 `BOOTSTRAP_ADMIN_PASSWORD` 改為強密碼
3. 啟動前校驗
   - 執行 `make validate-release-config`
   - 確認沒有 `replace-me`、`change-this-*`、`ChangeMe!2026` 之類的佔位值
4. 首次啟動
   - 執行 `docker compose --env-file .env.release -f compose.release.yml up -d`
   - 檢查 `docker compose --env-file .env.release -f compose.release.yml ps`
   - 檢查 `curl -i http://127.0.0.1:8080/actuator/health`
5. 首登收尾
   - 僅在啟用了 `BOOTSTRAP_ADMIN_ENABLED=true` 時，使用 `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` 登入
   - 立即修改管理員密碼
   - 如果後續完全走 OAuth，可將 `BOOTSTRAP_ADMIN_ENABLED=false`

## 10 可觀測性

| 維度 | 方案 |
|------|------|
| 健康檢查 | `web/nginx-health`、`server/actuator/health` |
| 請求關聯 | 響應頭和日誌中的 `X-Request-Id` / `request.id` |
| 日誌 | 文字或 ECS 風格 JSON，均輸出到容器 stdout / stderr |
| Trace | `none`、Micrometer + OTel SDK、或外部 Java Agent 三選一 |
| 指標 | Spring Boot Actuator；Prometheus 是可選後端，不是 Trace 前置條件 |

### 10.1 通用配置

預設配置不要求 Collector、SkyWalking 或 Elasticsearch：

```dotenv
SKILLHUB_TRACING_MODE=none
SKILLHUB_LOG_FORMAT=json
SKILLHUB_SERVICE_VERSION=v0.2.15
SKILLHUB_SERVICE_ENVIRONMENT=production
```

發布 Compose 預設使用 ECS 風格 JSON，由 Filebeat、Fluent Bit 或容器平臺採集 stdout。
本地原始碼開發仍可使用 `SKILLHUB_LOG_FORMAT=text`。SkillHub 不直接連線 Elasticsearch。
JSON 日誌使用以下穩定欄位：

- `request.id`：SkillHub 請求、響應和審計關聯 ID。
- `trace.id`、`span.id`：當前存在有效 Trace 時輸出。
- `service.name`、`service.version`、`service.environment`。

`SKILLHUB_LOG_ASYNC_QUEUE_SIZE` 預設是 `1024`。JSON 日誌佇列是有界且非阻塞的；採集端
阻塞時允許丟棄日誌以保護業務執行緒，資料庫中的 `audit_log` 仍是審計事實來源。

### 10.2 三種 Tracing 模式

三種模式只能選擇一種，切換後需要重啟：

| 模式 | 適用場景 | 必需配置 |
|------|----------|----------|
| `none` | 不部署鏈路追蹤 | `SKILLHUB_TRACING_MODE=none` |
| `otel-sdk` | 廠商中立 OTLP/Collector | 模式、取樣率；需要匯出時再配置 endpoint |
| `external-agent` | 使用 SkyWalking Agent 原生能力 | 模式、唯一的外部 Agent；不得配置 OTLP endpoint |

OTel SDK 模式的最小配置：

```dotenv
SKILLHUB_TRACING_MODE=otel-sdk
SKILLHUB_LOG_FORMAT=json
SKILLHUB_TRACING_SAMPLING_PROBABILITY=0.1
MANAGEMENT_OTLP_TRACING_ENDPOINT=http://otel-collector:4318/v1/traces
SKILLHUB_OTLP_TIMEOUT=5s
SKILLHUB_OTLP_COMPRESSION=gzip
```

未設定 `MANAGEMENT_OTLP_TRACING_ENDPOINT` 時，`otel-sdk` 仍可建立程式內 Trace，但不會
建立 OTLP Exporter，也不會嘗試連線預設地址。`none` 或 `external-agent` 模式配置
endpoint 會啟動失敗。

External Agent 模式的應用側配置：

```dotenv
SKILLHUB_TRACING_MODE=external-agent
SKILLHUB_LOG_FORMAT=json
```

部署平臺還必須透過 JVM 啟動引數掛載且只掛載一個 Agent。SkillHub 無法可靠識別任意
Java Agent，因此上線前應檢查實際 `JAVA_TOOL_OPTIONS` 或容器啟動命令，確認沒有同時啟用
OTel Agent、SkyWalking Agent 和應用內 `otel-sdk`。SkyWalking Agent 模式可以透過官方
Logback Toolkit 輸出 `trace.id`；`span.id` 是否可用取決於 Agent 版本。

### 10.3 OTel Collector 接入 SkyWalking

下面是隻轉發 Trace 的最小 Collector 配置：

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}

exporters:
  otlp/skywalking:
    endpoint: skywalking-oap:11800
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/skywalking]
```

SkyWalking OAP 10.3 還需要啟用 OTLP Trace handler、Zipkin receiver 和 Zipkin query：

```dotenv
SW_OTEL_RECEIVER_ENABLED_HANDLERS=otlp-traces
SW_RECEIVER_ZIPKIN=default
SW_QUERY_ZIPKIN=default
```

應用使用 Collector 的 OTLP/HTTP `4318` 埠，Collector 使用 OAP 的 OTLP/gRPC
`11800` 埠。生產環境應按網路邊界配置 TLS；上例中的 `insecure: true` 只適用於受控的
容器內部網路。

SkyWalking 10.3 會把 OTLP Trace 轉換為 Zipkin Trace，並透過 Zipkin Query/Lens 查詢。
這條路徑不提供 SkyWalking Java Agent 的完整原生拓撲、慢 SQL 和 Profiling 能力。需要
這些能力時使用 `external-agent`，不要同時啟用 `otel-sdk`。

### 10.4 日誌與 Trace 聯查

JSON 日誌由採集器寫入 Elasticsearch 後，在 Kibana 透過 `trace.id` 查詢；同一個
`trace.id` 可在 SkyWalking 的 Zipkin Query/Lens 或 Agent 原生查詢介面中定位呼叫鏈。
`request.id` 始終可以用於 SkillHub 內部日誌和審計關聯。

當取樣率小於 `1.0` 時，日誌仍是全量輸出，因此部分日誌雖有請求關聯資訊，但在
SkyWalking 中沒有被保留的 Trace。這是頭部取樣的預期行為。

### 10.5 回滾

遇到觀測後端異常時：

1. 將 `SKILLHUB_TRACING_MODE` 改為 `none`。
2. 刪除 `MANAGEMENT_OTLP_TRACING_ENDPOINT`。
3. 需要進一步降低日誌開銷時，將 `SKILLHUB_LOG_FORMAT` 改為 `text`。
4. 滾動重啟 Server。

關閉 Trace 和 JSON 日誌不會改變請求、資料庫或非同步任務的業務語義。

開發者接入統一標準的最小步驟、內部/外部 HTTP Client 傳播邊界和擴充套件點見：
[可觀測性開發者接入指南](./observability-developer-guide.md)。

## 11 安全掃描服務

如果要啟用 `skill-scanner` 後端鏈路，當前倉庫建議按下面的方式部署：

- 本地共享目錄場景可以使用 `local` 模式
- Kubernetes 或分離部署場景應使用 `upload` 模式

當前 `deploy/k8s` 已按分離部署建模，因此推薦：

- `SKILLHUB_SECURITY_SCANNER_ENABLED=true`
- `SKILLHUB_SECURITY_SCANNER_URL=http://skillhub-scanner:8000`
- `SKILLHUB_SECURITY_SCANNER_MODE=upload`

相關檔案：

- `deploy/k8s/scanner-deployment.yaml`
- `deploy/k8s/services.yaml`
- `deploy/k8s/backend-deployment.yaml`
- `scripts/verify-scanner.sh`
- `docs/security-scanning.md`

## 12 資料遷移

Flyway 仍是唯一 schema 變更入口：

- 路徑：`server/skillhub-app/src/main/resources/db/migration/`
- 命名：`V{version}__{description}.sql`
- 啟動策略：應用容器啟動時自動執行遷移
