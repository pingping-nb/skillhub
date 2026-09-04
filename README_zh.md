<div align="center">
  <img src="./skillhub-logo.svg" alt="SkillHub Logo" width="120" height="120" />
  <h1>SkillHub</h1>
  <p>企業級開源智慧體技能註冊中心 — 在組織內發布、發現和管理可複用的技能包</p>
</div>

<div align="center">

[![檔案](https://img.shields.io/badge/docs-zread.ai-4A90E2?logo=gitbook&logoColor=white)](https://zread.ai/iflytek/skillhub)
[![Discord](https://img.shields.io/badge/discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/qHYvtDNPHS)
[![許可證](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![構建](https://github.com/iflytek/skillhub/actions/workflows/publish-images.yml/badge.svg)](https://github.com/iflytek/skillhub/actions/workflows/publish-images.yml)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://ghcr.io/iflytek/skillhub)
[![Java](https://img.shields.io/badge/java-21-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)](https://react.dev)

[![GitHub Stars](https://img.shields.io/github/stars/iflytek/skillhub?style=social)](https://github.com/iflytek/skillhub/stargazers)
[![GitHub Watchers](https://img.shields.io/github/watchers/iflytek/skillhub?style=social)](https://github.com/iflytek/skillhub/watchers)

</div>

<div align="center">

<a href="https://trendshift.io/repositories/24384?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-24384" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/24384" alt="iflytek%2Fskillhub | Trendshift" width="250" height="55"/></a>&nbsp;&nbsp;<a href="https://aaif.io/" target="_blank" rel="noopener noreferrer"><img src="https://cdn.sanity.io/images/4o10fa7h/production/16dd7d8270b673d376cadca831ab3d5ea003bb89-838x203.svg" alt="AAIF Associate Member" height="55"/></a>

</div>

---

<div align="center">
  <img src="https://xfyun-doc.xfyun.cn/lc-sp-skillhub-demo-1775551643410.gif" alt="SkillHub Demo" width="800" />
</div>

SkillHub 是一個自託管平臺，為團隊提供私有的、受治理的智慧體技能共享空間。發布技能包，推送到名稱空間，讓其他人透過搜尋發現或透過 CLI 安裝。專為防火牆後的本地部署而構建，提供與公共註冊中心相同的精緻體驗。

> ⭐ 如果 SkillHub 適合你的團隊，歡迎 **Star** 本倉庫幫助更多團隊發現它；點 **Watch → Custom → Releases** 可在新版本發布時收到通知。

## 分享優秀 Skill

優秀的 Skill 在分享中產生更大價值。如果你有一個在真實工作或生活場景中反覆打磨、確實好用的
Skill，歡迎分享給 SkillHub 社群，與大家一起豐富開放、實用的 Skill 生態。無論是日常生活、
辦公協作、學習研究、旅行活動、內容創作、資料分析還是軟體開發，都可以成為有價值的分享。

經過驗證的社群貢獻還有機會進入精選 Skill 集合，讓每個新部署的 SkillHub 開箱即用。不必完成
全部適配後才能參與：你可以先[建立 issue](https://github.com/iflytek/skillhub/issues/new/choose)，
說明 Skill 的來源和它解決的問題；也可以按照[Skill 分享指南](./builtin-skills/README.md)
直接提交 PR。

## 檔案

- 📖 **[使用者指南](https://iflytek.github.io/skillhub/)** — 技能發布、搜尋、CLI 使用等使用者操作指南
- 🛠️ **[開發者檔案](https://zread.ai/iflytek/skillhub)** — 架構設計、API 參考、本地開發、部署運維等技術檔案
- 🐍 **[Python 示例](./examples/python)** — 使用 REST API 在 Python 中搜尋、下載和發布技能

## 核心特性

- **自託管與私有化** — 部署在您自己的基礎設施上。將專有技能保留在防火牆後，完全掌控資料主權。一條 `make dev-all` 命令即可在本地執行。
- **發布與版本管理** — 上傳智慧體技能包，支援語義化版本控制、自定義標籤（`beta`、`stable`）和自動 `latest` 跟蹤。
- **發現** — 全文搜尋，支援按名稱空間、下載量、評分和時間篩選。可見性規則確保使用者只能看到其有權訪問的內容。
- **團隊名稱空間** — 在團隊或全域性範圍下組織技能。每個名稱空間擁有自己的成員、角色（Owner / Admin / Member）和發布策略。
- **稽核與治理** — 團隊管理員在其名稱空間內稽核；平臺管理員控制向全域性範圍的推廣。治理操作記錄審計日誌以滿足合規要求。
- **社交功能** — 收藏技能、評分並跟蹤下載量。圍繞組織的最佳實踐構建社群。
- **賬戶合併** — 將多個 OAuth 身份和 API 令牌整合到單個使用者賬戶下。
- **API 令牌管理** — 為 CLI 和程式化訪問生成作用域令牌，採用基於字首的安全雜湊。
- **CLI 優先** — 原生 REST API，加上對現有 ClawHub 風格註冊中心客戶端的相容層。原生 CLI API 是主要支援路徑，協議相容性持續擴充套件中。
- **可插拔儲存** — 開發環境使用本地檔案系統，生產環境使用 S3 / MinIO。透過配置切換。
- **國際化** — 使用 i18next 支援多語言。

## 快速開始

使用以下命令啟動完整的本地環境：

```bash
rm -rf /tmp/skillhub-runtime
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up
```

預設命令會拉取 `latest` 穩定版映象；如果你想跟隨 `main` 的最新構建，請顯式傳 `--version edge`。

**配置公網訪問地址（生產環境推薦）：**

```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --public-url https://skillhub.your-company.com
```

`--public-url` 引數用於設定 SkillHub 例項的公網訪問地址。配置後：
- CLI 安裝命令會顯示正確的註冊中心地址
- Agent 設定指引會顯示正確的 skill.md URL
- OAuth 回撥和裝置認證連結能正常工作

**國內使用者（阿里雲映象）：**

```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --aliyun --public-url https://skillhub.your-company.com --version latest
```

如果部署遇到問題，請清除現有的執行時目錄並重試。

### 前置要求

- Docker & Docker Compose

### 訪問應用

- Web UI: http://localhost:3000
- 後端 API: http://localhost:8080

### 預設賬戶

預設執行 `make dev-all` 時，後端以 `local` profile 啟動。
在這個模式下，本地開發會保留下面兩個模擬使用者，同時預設建立一個可賬號密碼登入的 bootstrap 管理員：

- `local-user` — 普通使用者，用於發布和名稱空間操作
- `local-admin` — 超級管理員，用於稽核和管理流程

在本地開發中使用 `X-Mock-User-Id` 請求頭切換使用者。
本地 bootstrap 管理員預設已在 `application-local.yml` 中開啟：

- 使用者名稱：`admin`
- 密碼：`ChangeMe!2026`
- 如需關閉，請在啟動後端前設定環境變數 `BOOTSTRAP_ADMIN_ENABLED=false`

透過 `runtime.sh` 或 `compose.release.yml` 部署時，發布模板同樣預設開啟管理員，
使用相同的預設賬號密碼（`admin` / `ChangeMe!2026`），零配置即可登入。
**生產環境請務必修改密碼**——`validate-release-config.sh` 會拒絕預設值

### 停止服務

```bash
/tmp/skillhub-runtime/runtime.sh down
```

## SkillHub CLI

透過命令列安裝和管理 Agent 技能：

```bash
# 安裝 CLI
npm install -g @astron-team/skillhub

# 或直接執行
npx @astron-team/skillhub@latest version

# 登入
skillhub login --token sk_xxx --registry https://skill.xfyun.cn

# 搜尋和安裝技能
skillhub search pdf
skillhub install pdf-parser --agent codex

# 檢視已安裝技能
skillhub list
```

📖 完整指南：[docs/skillhub/guide/cli.md](docs/skillhub/guide/cli.md)

## 開發

### 前置要求

- Java 21+
- Node.js 20+
- Docker & Docker Compose
- Make

### 啟動開發環境

```bash
# 克隆倉庫
git clone https://github.com/iflytek/skillhub.git
cd skillhub

# 啟動完整的本地開發棧（後端 + 前端 + 依賴）
make dev-all

# 或者分別啟動
make dev-backend    # 僅後端
make dev-web        # 僅前端
```

> **國內開發者**：如果 Maven 依賴下載超時，需配置阿里雲映象。詳見 [本地開發指南](https://iflytek.github.io/skillhub/quickstart.html#本地開發)。

### 常用命令

```bash
make help                    # 顯示所有可用命令
make test                    # 執行後端測試
make test-backend-app        # 執行 skillhub-app 及其依賴模組測試
make build-backend-app       # 構建 skillhub-app 及其依賴模組
make typecheck-web          # TypeScript 型別檢查
make build-web              # 構建前端
make generate-api           # 重新生成 OpenAPI 型別
./scripts/check-openapi-generated.sh  # 驗證 API 契約同步
./scripts/smoke-test.sh http://localhost:8080  # 執行冒煙測試
```

管理員標籤管理冒煙測試只會在顯式提供當前管理員憑證時執行：

```bash
SMOKE_ADMIN_USERNAME=admin SMOKE_ADMIN_PASSWORD='current-password' \
  ./scripts/smoke-test.sh http://localhost:8080
```

持久化環境只跑非管理員冒煙檢查時，可設定 `SMOKE_ADMIN_CHECKS=false`。
指令碼不再回退使用 bootstrap 管理員預設密碼。

說明：不要在 `server/` 下直接執行 `./mvnw -pl skillhub-app clean test`。`skillhub-app` 依賴同倉庫的 sibling modules，單獨 clean 構建時會回退到本地 Maven 倉庫裡的舊產物並出現大量 `cannot find symbol` / 簽名不匹配錯誤。需要使用 `-am`，或者直接使用上面的 `make test-backend-app` / `make build-backend-app`。

### 專案結構

```
skillhub/
├── server/                 # 後端（Java/Spring Boot）
│   ├── skillhub-app/      # 主應用程式
│   ├── skillhub-domain/   # 核心業務邏輯
│   ├── skillhub-auth/     # 認證授權
│   ├── skillhub-search/   # 搜尋功能
│   ├── skillhub-storage/  # 儲存層
│   └── skillhub-infra/    # 基礎設施
├── web/                   # 前端（React/TypeScript）
├── docs/                  # 檔案
├── scripts/               # 實用指令碼
├── deploy/                # 部署配置
├── monitoring/            # Prometheus + Grafana
├── Makefile              # 常用任務
└── docker-compose.yml    # 本地開發棧
```

## 部署

### 使用 Docker Compose

```bash
# 預設（GHCR 映象）
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --public-url https://skillhub.your-company.com

# 阿里雲映象（國內推薦）
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --aliyun --public-url https://skillhub.your-company.com --version latest

```

### 配置引數說明

| 引數 | 說明 | 示例 |
|------|------|------|
| `--public-url <url>` | 公網訪問地址（推薦配置） | `--public-url https://skill.example.com` |
| `--version <tag>` | 指定映象版本 | `--version v0.2.0` |
| `--aliyun` | 使用阿里雲映象（國內推薦） | `--aliyun` |
| `--home <dir>` | 指定執行時目錄 | `--home /opt/skillhub` |
| `--no-scanner` | 禁用安全掃描服務 | `--no-scanner` |

> **重要**：生產環境請務必配置 `--public-url`，確保 CLI 安裝命令和 Agent 設定指引顯示正確的地址。

如果透過 `/skillhub/` 這類子路徑對外發布，需要讓公網地址和前端基礎路徑保持一致。
請在 `.env.release` 中設定 `SKILLHUB_PUBLIC_BASE_URL=https://skill.example.com/skillhub`、
`SKILLHUB_WEB_BASE_PATH=/skillhub/` 和 `SKILLHUB_WEB_API_BASE_URL=/skillhub`。

### 使用 Kubernetes

```bash
# 應用 Kubernetes 清單
kubectl apply -f deploy/k8s/

# 或使用 Helm Chart
helm dependency build ./charts/skillhub
helm upgrade --install skillhub ./charts/skillhub -n skillhub --create-namespace \
  -f values-production.yaml
```

### 環境變數

關鍵配置選項：

```bash
# 資料庫
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/skillhub
SPRING_DATASOURCE_USERNAME=skillhub
SPRING_DATASOURCE_PASSWORD=skillhub

# Redis
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379

# 儲存（S3/MinIO）
STORAGE_TYPE=s3
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_ACCESS_KEY=minioadmin
STORAGE_S3_SECRET_KEY=minioadmin
STORAGE_S3_BUCKET=skillhub

# 認證
AUTH_JWT_SECRET=your-secret-key
AUTH_SESSION_TIMEOUT=30m
```

完整配置參考請檢視 [`application.yml`](./server/skillhub-app/src/main/resources/application.yml)。

### 上傳白名單覆蓋

技能包上傳校驗預設使用
[`SkillPackagePolicy.java`](./server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/validation/SkillPackagePolicy.java)
中的副檔名白名單。`SkillPublishProperties` 預設也會把這份列表作為
`skillhub.publish.allowed-file-extensions` 的值。

如果需要在執行時整體替換預設白名單，可以設定：

```bash
SKILLHUB_PUBLISH_ALLOWED_FILE_EXTENSIONS=.md,.json,.xsd,.xsl,.dtd,.docx,.xlsx,.pptx
```

Spring Boot 會把這個環境變數繫結到
`skillhub.publish.allowed-file-extensions`。一旦設定，該配置會替換預設白名單，
而不是在預設列表後追加。

## 架構

SkillHub 採用清晰的分層架構：

- **表現層**：REST API（Spring Boot）+ React 前端
- **應用層**：用例編排和 DTO 轉換
- **領域層**：核心業務邏輯和實體
- **基礎設施層**：資料庫、儲存、搜尋

關鍵設計決策：

- **多模組 Maven 專案**：清晰的模組邊界和依賴管理
- **領域驅動設計**：豐富的領域模型和業務規則
- **CQRS 模式**：讀寫分離以最佳化效能
- **事件溯源**：審計日誌和治理操作
- **可插拔儲存**：透過配置在本地/S3/MinIO 之間切換

詳細架構檔案請參閱 [`docs/`](./docs/) 目錄。

## 技術棧

### 後端
- **語言**：Java 21
- **框架**：Spring Boot 3.2.3
- **資料庫**：PostgreSQL 16 + Flyway 遷移
- **快取**：Redis 7
- **儲存**：S3/MinIO
- **搜尋**：PostgreSQL 全文搜尋

### 前端
- **語言**：TypeScript
- **框架**：React 19
- **構建工具**：Vite
- **路由**：TanStack Router
- **資料獲取**：TanStack Query
- **樣式**：Tailwind CSS + Radix UI
- **API 客戶端**：OpenAPI TypeScript（型別安全）
- **國際化**：i18next

### 基礎設施
- **容器化**：Docker & Docker Compose
- **監控**：Prometheus + Grafana
- **部署**：Kubernetes 清單與 Helm Chart
- **CI/CD**：GitHub Actions

## 路線圖

- [x] 核心技能註冊功能
- [x] 名稱空間和團隊管理
- [x] 稽核和治理工作流
- [x] 全文搜尋和篩選
- [x] 社交功能（收藏、評分、下載）
- [x] API 令牌管理
- [x] 賬戶合併
- [x] 國際化支援
- [x] Helm Chart 部署
- [ ] 高階搜尋過濾器
- [ ] 技能依賴管理
- [ ] Webhook 整合
- [ ] 審計日誌匯出
- [ ] LDAP/SAML 整合

完整路線圖請參閱 [`docs/10-delivery-roadmap.md`](./docs/10-delivery-roadmap.md)。

## SkillHub 與 Agent Skills 生態

SkillHub 是一個**註冊與治理平臺**，而不是一個技能集合。它與
[`anthropics/skills`](https://github.com/anthropics/skills) 這類開放技能倉庫是
**互補關係**：那個倉庫推廣了 **Agent Skill 格式**（帶 `name` / `description`
frontmatter 的 `SKILL.md` 加上配套檔案），並提供了一批精選的示例技能；而 SkillHub
則是你的組織**私有地託管、版本化、治理和分發**這些技能的地方。

|  | [`anthropics/skills`](https://github.com/anthropics/skills) | **SkillHub** |
|---|---|---|
| 定位 | 精選的示例 Agent Skills 集合 + 格式規範 | 自託管的技能註冊與治理平臺 |
| 層次 | 內容層 —— 技能本身 | 基礎設施層 —— 託管、版本、發現、訪問控制 |
| 託管 | 公開的 GitHub 倉庫 | 你自己的基礎設施，部署在防火牆之內 |
| 版本 | Git 提交歷史 | 語義化版本、標籤（`beta` / `stable`）、`latest` 追蹤 |
| 訪問控制 | 公開 | 名稱空間、RBAC、稽核與審計日誌 |
| 分發 | 克隆 / 複製檔案 | 全文搜尋 + CLI 安裝 |

由於 SkillHub 使用同一套 `SKILL.md` 格式，`anthropics/skills` 中的技能——或任何
Agent Skill 目錄——都可以直接發布到你的註冊中心：

```bash
# 從開放集合中獲取一個技能……
git clone https://github.com/anthropics/skills

# ……並將其發布到你的私有 SkillHub 註冊中心
export SKILLHUB_REGISTRY=https://skillhub.your-company.com
export SKILLHUB_TOKEN=YOUR_API_TOKEN
npx @astron-team/skillhub@latest publish ./skills/<分類>/<技能名>
```

> ⚖️ **許可提示**：轉發布時請遵守每個技能各自的許可證。`anthropics/skills` 中大多數技能
> 採用 Apache 2.0，但檔案類技能（DOCX/PDF/PPTX/XLSX）是 source-available 而非開源，
> 再分發前請先檢視該技能的 `LICENSE`。

**一句話總結：用 `anthropics/skills` 這類集合提供內容，用 SkillHub 在組織內進行受治理的分發。**

## 與智慧體平臺整合

SkillHub 設計為與各種智慧體平臺和框架無縫整合。

### [OpenClaw](https://github.com/openclaw/openclaw)

[OpenClaw](https://github.com/openclaw/openclaw) 是開源的智慧體技能 CLI 工具。配置它使用您的 SkillHub 端點作為註冊中心：

```bash
# 配置註冊中心地址
export CLAWHUB_REGISTRY=https://skillhub.your-company.com

# 如需認證，先登入一次
clawhub login --token YOUR_API_TOKEN

# 搜尋和安裝技能
npx clawhub search email
npx clawhub install my-skill
npx clawhub install my-namespace--my-skill

# 發布請使用第一方 SkillHub CLI
export SKILLHUB_REGISTRY=https://skillhub.your-company.com
export SKILLHUB_TOKEN=YOUR_API_TOKEN
npx @astron-team/skillhub@latest publish ./my-skill --namespace my-space
```

其中 `my-space--my-skill` 是相容層使用的 canonical slug，SkillHub 會將其解析為
namespace `my-space` 和 skill slug `my-skill`。

ClawHub 相容範圍包含搜尋、檢視和安裝；其發布協議與 SkillHub 不相容。
發布請使用上面的第一方 CLI。

> 💡 **提示**：上述命令不僅適用於 OpenClaw，透過指定安裝目錄（`--dir`），也可適用於其他的 CLI Coding Agent 或 Agent 助手。例如：`npx clawhub --dir ~/.claude/skills install my-skill`

📖 **[完整 OpenClaw 整合指南 →](./docs/openclaw-integration.md)**

### [Hermes Agent](https://github.com/NousResearch/hermes-agent)

[Hermes Agent](https://github.com/NousResearch/hermes-agent) 使用標準 `SKILL.md` 格式，並會遞迴發現 `$HERMES_HOME/skills/` 中的技能。透過 SkillHub CLI 的 `--dir` 引數即可把完整技能包安裝到 Hermes，無需新增 registry 介面卡；安裝後可使用 `hermes skills list` 驗證。

📖 **[完整 Hermes Agent 整合指南 →](./docs/hermes-integration.md)**

### [HarnessClaw Engine](https://github.com/harnessclaw/harnessclaw-engine)

[HarnessClaw Engine](https://github.com/harnessclaw/harnessclaw-engine) 是基於 Go 的 LLM 程式設計助手引擎，透過 WebSocket 協議對外提供能力。它從 `SKILL.md` 檔案載入技能，支援 YAML frontmatter 與引數替換，並按配置順序掃描各目錄下的 `skill-name/SKILL.md`（預設 `~/.harnessclaw/workspace/skills/`，靠前的目錄在重名時優先）。透過 SkillHub CLI 的 `--dir` 引數即可把技能包直接安裝到該目錄，無需新增 registry 介面卡：

```bash
npx clawhub --dir ~/.harnessclaw/workspace/skills install my-skill
```
### [AstronClaw](https://agent.xfyun.cn/astron-claw)

[AstronClaw](https://agent.xfyun.cn/astron-claw) 是基於 OpenClaw 核心能力打造的雲端 AI 助手，提供全天候線上服務，隨時隨地透過企業微信、釘釘、飛書等渠道提供服務。它內建了豐富的技能系統，您可以將其連線到自託管的 SkillHub 註冊中心，支援技能市場一鍵安裝、倉庫搜尋、對話自動安裝，甚至管理和分發組織內部的自定義私有技能。

### [Loomy](https://loomy.xunfei.cn/)

[Loomy](https://loomy.xunfei.cn/) 是聚焦真實辦公場景的桌面端 AI 工作搭子。它深入打通本地檔案和系統工具，為個人及小團隊構建高效的自動化工作流。透過將 Loomy 連線到您的 SkillHub 註冊中心，您可以輕鬆發現並安裝組織內部的專屬技能，從而增強本地桌面端的自動化與協同辦公能力。

### [astron-agent](https://github.com/iflytek/astron-agent)

[astron-agent](https://github.com/iflytek/astron-agent) 是科大訊飛星火智慧體框架。儲存在 SkillHub 中的技能可以被 astron-agent 引用和載入，實現從開發到生產的受治理、版本化的技能生命週期。

## 相關專案

SkillHub 是 **[訊飛 Astron](https://github.com/iflytek)** 開源生態的一部分。如果 SkillHub 對你有幫助，這些同生態的姊妹專案你可能也會用到：

- **[astron-agent](https://github.com/iflytek/astron-agent)** — 企業級、商業友好的智慧體工作流平臺，用於構建新一代 SuperAgent；發布到 SkillHub 的技能可被 astron-agent 載入和執行。
- **[astron-rpa](https://github.com/iflytek/astron-rpa)** — 開箱即用、面向 Agent 的 RPA 套件，為個人與企業提供自動化工具。

---

> 🌟 **展示與分享** — 您使用 SkillHub 構建了什麼？我們很想聽聽！
> 在 [**Discussions → Show and Tell**](https://github.com/iflytek/skillhub/discussions/categories/show-and-tell) 分類中分享您的用例、整合或部署故事。

## 貢獻

歡迎貢獻。請先開啟 issue 討論您想要更改的內容。

- 貢獻指南：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 行為準則：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

## 📞 支援

- 💬 **社群討論**：[GitHub Discussions](https://github.com/iflytek/skillhub/discussions)
- 🐛 **Bug 報告**：[Issues](https://github.com/iflytek/skillhub/issues)
- 👾 **Discord**：[加入我們的伺服器](https://discord.gg/qHYvtDNPHS)
- 👥 **企業微信群**：

  ![企業微信群](https://github.com/iflytek/astron-agent/raw/main/docs/imgs/WeCom_Group.png)

## 許可證

Apache License 2.0
