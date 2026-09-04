# skillhub 產品定位與 MVP 範圍

## 1. 定位

單例項共享技能註冊中心（Skills Hub / Registry），不是多租戶平臺。

- 平臺只有一個共享註冊中心例項
- 隔離邊界是 namespace，不是租戶
- `@global` 是平臺級公共空間，由平臺管理員管理
- `@team-*` 是協作與治理邊界（部門/團隊），不是租戶邊界
- 公共技能（visibility=PUBLIC）匿名可瀏覽和下載

以 ClawHub 為產品藍本（繼承產品模型，不照搬技術實現），以 OpenSkills 借鑑 SKILL.md 格式和目錄結構約定（不相容其客戶端執行時行為）。

同時，一期必須提供 ClawHub CLI 協議相容層：服務端需要暴露一組與 ClawHub CLI 相容的 registry API，使現有 ClawHub CLI 在不修改或僅最小配置修改的前提下可完成 registry 側查詢、解析、下載、發布、校驗等核心操作。

## 1.2 身份主鍵約束（已凍結）

- 使用者身份主鍵全鏈路統一使用 `string`，不得使用 `int` / `long` / `bigint` 作為平臺使用者標識的正式契約型別。
- 該約束覆蓋認證主體、API 入參/出參、許可權判定、審計、資源 owner、creator、updater、reviewer、actor、submittedBy 等全部使用者關聯欄位。
- 原因：平臺需要相容外部 SSO / OAuth / OIDC / SCIM 等身份源，外部 UID 通常是穩定字串，不應先壓縮為本地自增整數再作為系統主契約繼續傳播。
- 舊版草案中任何“整型使用者標識”寫法都已失效，當前唯一有效約束是“平臺使用者標識全鏈路使用字串主鍵”。

### 1.1 技能座標體系（已凍結）

skillhub 內部使用 namespace 座標模型：`@{namespace_slug}/{skill_slug}`。

ClawHub CLI 使用單一 slug 模型，slug 校驗規則為 `[a-z0-9]([a-z0-9-]*[a-z0-9])?`，不允許 `/` 出現。

為同時滿足兩套模型，定義以下雙向對映規則：

**對映規則：**

| skillhub 座標 | 相容層 canonical slug | 說明 |
|---|---|---|
| `@global/my-skill` | `my-skill` | 全域性空間省略字首，直接使用 skill slug |
| `@team-name/my-skill` | `team-name--my-skill` | 團隊空間使用 `{namespace_slug}--{skill_slug}` 格式 |

**約束規則：**
- 分隔符為雙連字元 `--`
- skill slug 和 namespace slug 均禁止包含 `--`（在校驗規則中追加此限制）
- slug 格式校驗更新為：`[a-z0-9]([a-z0-9-]*[a-z0-9])?`，且不得包含連續兩個以上的連字元 `--`
- 相容層解析 canonical slug 時：包含 `--` 則拆分為 `namespace_slug` + `skill_slug`，不包含則視為 `@global/{slug}`
- 衝突規則：如果 `@global/team-name--my-skill` 與 `@team-name/my-skill` 產生衝突，以 `--` 拆分優先（即優先解析為團隊空間技能）。全域性空間的 skill slug 禁止包含 `--` 以避免歧義
- 保留字規則：namespace slug 保留詞列表同樣適用於 canonical slug 的 namespace 部分

**顯示規則：**
- Web 端始終顯示完整座標：`@global/my-skill`、`@team-name/my-skill`
- ClawHub CLI 相容層返回 canonical slug：`my-skill`、`team-name--my-skill`
- skillhub 自有 CLI 支援兩種格式輸入，內部統一轉換為 namespace 座標

**Well-known 發現：**
- skillhub 服務端提供 `/.well-known/clawhub.json`，返回 `{ "apiBase": "/api/v1" }`
- ClawHub CLI 透過此機制自動發現相容層 API 基地址

## 2. 參考專案取捨

### 2.1 繼承 ClawHub 的部分

- Skill Registry 的整體產品邊界
- 技能版本、標籤、下載的業務模型
- 發布後治理機制（報告、標記、隱藏、撤回）
- Web 瀏覽、詳情頁、上傳發布、管理後臺的功能切分
- 公共查詢 API 與 CLI API 的雙通道設計
- ClawHub CLI 所依賴的 registry API 協議面
- Skill 後設資料提取與服務端校驗思路
- 審計、收藏、評分、統計、運營標籤等擴充套件位

不直接繼承：
- Convex 資料模型與執行時
- 向量檢索的一期實現方式

### 2.2 借鑑 OpenSkills 的部分

- `SKILL.md` 格式相容（frontmatter + markdown body）
- 技能包目錄結構約定（SKILL.md + references/ + scripts/ + assets/）
- 四級目錄優先順序（`.agents/skills` → `~/.agents/skills` → `.claude/skills` → `~/.claude/skills`）
- 目錄名作為 lookup key（安裝後目錄名 = skill slug）
- AGENTS.md `<skill>` 描述塊格式相容
- 目標：skillhub CLI 安裝的技能可被 OpenSkills/Claude 相容客戶端發現和使用

不直接繼承：
- 以 CLI 為中心的產品定位
- "無服務端"的前提

## 3. 產品原則

- Hub 優先：服務端是核心，CLI 和 Agent 整合是入口能力
- 相容優先：相容 `SKILL.md` 及常見目錄約定
- CLI 相容優先：除 skillhub CLI 外，一期明確要求實現 ClawHub CLI 協議相容層
- 分層優先：搜尋、物件儲存都必須有可替換邊界
- 開放認證：基於標準 OAuth2 協議，一期 GitHub 登入，架構支援後續擴充套件多 Provider
- 審計優先：企業內部分發平臺必須保留髮布、下載、刪除、授權等審計鏈路

## 4. 一期 MVP 功能

核心能力：
- 技能發布（當前版本採用“提交 → 稽核 → 上線”；`SUPER_ADMIN` 保留直髮能力）
- 技能版本管理（semver + 標籤）
- 技能瀏覽、詳情、下載（公共技能匿名可訪問）
- 標籤管理（`latest` 系統保留只讀 + 自定義標籤人工維護）
- 技能包檔案校驗與 SKILL.md 後設資料抽取
- 基於 PostgreSQL 全文索引的搜尋

名稱空間與組織：
- 單一全域性名稱空間（`@global/skill-name`），由平臺管理員管理，不支援多個平臺級 namespace
- 團隊/部門名稱空間（`@team-slug/skill-name`）
- 名稱空間成員管理
- 建立技能時選擇歸屬空間

稽核流程：
- 當前版本：普通使用者發布後進入稽核，稽核透過後上線
- `SUPER_ADMIN` 發布可直達 `PUBLISHED`
- 分級稽核：團隊空間由團隊管理員稽核，全域性空間由平臺管理員稽核
- 團隊技能提升到全域性需平臺管理員二次稽核
- 平臺管理員只負責全域性空間稽核與提升稽核，不介入團隊空間稽核
- 當前不引入自動稽核；`PrePublishValidator` 僅作為未來擴充套件點保留，預設實現為 `NoOp`
- 撤回稽核語義統一為 `PENDING_REVIEW → DRAFT`，不再走刪除版本記錄
- skill 生命週期管理讀模型統一為 `headlineVersion / publishedVersion / ownerPreviewVersion / resolutionMode`
- `hidden` 是獨立治理覆蓋層，不屬於 skill 容器狀態機

認證與許可權：
- OAuth2 標準登入（一期 GitHub OAuth）
- CLI 認證採用 OAuth Device Flow，由 Web 授權後簽發 CLI 可用憑證
- API Token 保留為平臺通用憑證能力，用於自動化、相容層和後續擴充套件
- ClawHub CLI 協議相容層（一期聚焦 search、resolve、download、publish、whoami 等核心介面）
- RBAC 角色許可權體系（平臺角色：SUPER_ADMIN / SKILL_ADMIN / USER_ADMIN / AUDITOR + 名稱空間角色）
- 管理後臺：使用者角色管理、發布稽核

社交功能：
- 收藏（star）
- 評分（1-5 分）

審計：
- 發布、稽核、下載、刪除等關鍵操作審計

## 5. 一期明確不做（含後續規劃）

- 評論 → Phase 5 上線，含舉報機制
- 自動安全掃描 → Phase 5 上線，接入 `PrePublishValidator` 擴充套件點
- 舉報/標記機制 → Phase 5 上線，配合評論和治理閉環
- 向量搜尋 → 當前進入第一階段規劃，僅做搜尋增強，不引入推薦系統
- 線上編輯器 → 暫不規劃
- Webhook/事件通知 → Phase 5（預留擴充套件點）
- 技能依賴/相容性宣告 → 暫不規劃（預留 `parsed_metadata_json` 欄位）

### latest 語義說明

這是有意的產品決策，不是繼承 ClawHub 的回滾模型：

- `latest` 自動跟隨最新已發布版本，只讀，不可手動移動
- 回滾/穩定通道管理透過自定義標籤實現（如 `stable`、`beta`、`stable-2026q1`）
- ClawHub 的"透過移動 latest 做回滾"能力被替換為"透過自定義標籤做通道管理"

## 6. 一期核心約束

- Skill 包視為"文字資源包"，不接受二進位制大檔案
- 技能包主入口檔案固定為 `SKILL.md`
- 後設資料以 `SKILL.md` frontmatter 為主，資料庫持久化解析結果
- 檔案內容原文存物件儲存，檢索麵向資料庫中的派生欄位與可索引文字
- Web 認證、CLI Device Flow 與 API Token 憑證統一匯聚到平臺使用者體系
- 公共技能（visibility=PUBLIC）匿名可瀏覽和下載，無需登入
