# skillhub 領域模型與資料模型

## 0. 使用者標識約束

- 使用者身份主鍵全鏈路統一為 `string`。
- 本約束覆蓋 `user_id`、`owner_id`、`created_by`、`updated_by`、`published_by`、`reviewed_by`、`actor_user_id` 及所有等價語義欄位。
- 歷史檔案裡寫成 `bigint` / `BIGINT` 的使用者關聯欄位均應按字串重新解釋；這些舊型別描述不再作為實現依據。
- 若未來資料庫為了索引或儲存效率引入內部 surrogate key，也只能作為內部實現細節，不能替代字串 `userId` 成為認證、授權、審計和 API 契約的主鍵。

## 3.1 核心實體

### namespace

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | 主鍵 |
| slug | varchar(64) | URL 友好標識 |
| display_name | varchar(128) | 展示名 |
| type | enum | `GLOBAL` / `TEAM` |
| description | text | 描述 |
| avatar_url | varchar(512) | 頭像 |
| status | enum | `ACTIVE` / `FROZEN` / `ARCHIVED` |
| created_by | varchar(128) | 建立人 |
| created_at | datetime | |
| updated_at | datetime | |

- `GLOBAL` 型別全域性唯一（只有一個 `@global`），由平臺管理員管理
- `TEAM` 型別對應部門/團隊，可建立多個
- 技能完整定址：`@{namespace_slug}/{skill_slug}`
- slug 唯一約束：`slug`
- slug 格式校驗：`[a-z0-9]([a-z0-9-]*[a-z0-9])?`，長度 2-64，且不得包含連續兩個以上的連字元 `--`（為相容層座標對映保留）
- slug 保留詞列表（使用者建立 namespace 時不可使用）：`admin`, `api`, `dashboard`, `search`, `auth`, `me`, `global`, `system`, `static`, `assets`, `health`
- 系統內建 namespace（`@global`）在資料庫初始化時由 Flyway 指令碼預置，繞過 slug 校驗規則。保留詞校驗僅作用於使用者建立 namespace 的介面
- 狀態語義：
  - `ACTIVE`：正常使用
  - `FROZEN`：凍結，只讀不可發布新版本，已有技能仍可瀏覽/下載
  - `ARCHIVED`：歸檔，對外不可見

### namespace_member

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| namespace_id | bigint | |
| user_id | varchar(128) | |
| role | enum | `OWNER` / `ADMIN` / `MEMBER` |
| created_at | datetime | |
| updated_at | datetime | |

- `OWNER`：名稱空間建立者，可轉讓
- `ADMIN`：可稽核該空間內的技能發布、管理成員
- `MEMBER`：可在該空間內發布技能（提交稽核）
- 唯一約束：`(namespace_id, user_id)`，一個使用者在一個空間只有一個角色

### skill

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| namespace_id | bigint | 所屬名稱空間 |
| slug | varchar(128) | URL 友好標識 |
| display_name | varchar(256) | |
| summary | varchar(512) | |
| owner_id | varchar(128) | 主要維護人（可轉讓） |
| source_skill_id | bigint | 派生來源（團隊技能提升到全域性時記錄原 skill ID），nullable |
| visibility | enum | `PUBLIC` / `NAMESPACE_ONLY` / `PRIVATE` |
| status | enum | `ACTIVE` / `ARCHIVED` |
| latest_version_id | bigint | latest published pointer，僅指向最新 `PUBLISHED` 版本；若不存在已發布版本則可為 `null` |
| download_count | bigint | |
| star_count | int | |
| rating_avg | decimal(3,2) | 平均評分 |
| rating_count | int | 評分人數 |
| created_by | varchar(128) | |
| created_at | datetime | |
| updated_by | varchar(128) | |
| updated_at | datetime | |

- 唯一約束：`(namespace_id, slug)`
- `status` 表示 skill 容器生命週期，不再承載“隱藏”語義。隱藏是獨立的治理覆蓋層，由 `hidden` / `hidden_at` / `hidden_by` 表達
- 當前程式碼下的實際可見性判定以 `VisibilityChecker` 為準，規則如下：
  - 若 `hidden=true`：僅 skill owner 或該 namespace 的 `ADMIN` / `OWNER` 可讀
  - 若 `latest_version_id is null`：僅 skill owner 可讀；即使 `visibility=PUBLIC` 也不會對外公開
  - `PUBLIC`：任意人可讀 skill 容器與已發布版本
  - `NAMESPACE_ONLY`：該 namespace 任意成員可讀（`MEMBER` / `ADMIN` / `OWNER`）
  - `PRIVATE`：僅 skill owner 或該 namespace 的 `ADMIN` / `OWNER` 可讀，普通 `MEMBER` 不可讀
- `owner_id` 語義為"主要維護人"，可轉讓。許可權主軸是 namespace role，不是 owner：
  - namespace ADMIN 對空間內所有 skill 有完整管理權（歸檔、版本管理、提升到全域性），不受 owner 限制
  - owner 作為 MEMBER 時可管理自己建立的 skill（提交稽核、編輯草稿）
  - owner 離職/換組後，namespace ADMIN 仍能完整管理所有技能
- `rating_avg` / `rating_count` 冗餘欄位，避免每次查詢聚合
- `slug`：面向使用者的 URL 標識，來自 SKILL.md 的 `name` 欄位，首次發布後不可變更。slug 格式校驗規則與 namespace slug 相同：`[a-z0-9]([a-z0-9-]*[a-z0-9])?`，同樣適用保留詞限制，且不得包含連續兩個以上的連字元 `--`（為相容層座標對映保留）。全域性空間（`@global`）下的 skill slug 額外禁止包含 `--`，以避免與相容層 canonical slug 產生歧義
- `source_skill_id`：僅在"團隊技能提升到全域性"場景下填充，記錄原始團隊空間的 skill ID，用於追溯來源
- 提升關係的唯一事實來源是 `promotion_request` 表，UI 查詢"是否已提升"透過 `SELECT ... FROM promotion_request WHERE source_skill_id=? AND status='APPROVED'` 判定

### skill_version

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | |
| version | varchar(32) | semver |
| version_sort | bigint | 排序用數值 |
| changelog | text | |
| manifest_json | json | 檔案清單 |
| parsed_metadata_json | json | SKILL.md frontmatter 解析結果 |
| status | enum | `DRAFT` / `PENDING_REVIEW` / `PUBLISHED` / `REJECTED` / `YANKED` |
| reject_reason | varchar(512) | 拒絕原因 |
| published_by | varchar(128) | |
| published_at | datetime | |
| created_at | datetime | |

- `status` 表示 version 發布生命週期，和 skill 容器狀態、review task 狀態分離
- 當前程式碼下的實際遷移約束：
  - 普通使用者首次上傳/重傳新版本後，版本直接進入 `PENDING_REVIEW`
  - `SUPER_ADMIN` 直髮時可直接進入 `PUBLISHED`
  - 稽核透過：`PENDING_REVIEW → PUBLISHED`
  - 稽核拒絕：`PENDING_REVIEW → REJECTED`
  - 撤回稽核：`PENDING_REVIEW → DRAFT`
  - 已發布撤回：`PUBLISHED → YANKED`
- 唯一約束：`(skill_id, version)` 防止重複發布
- `YANKED` 狀態：已發布後撤回
- 當前程式碼下的實際讀許可權補充：
  - 普通詳情 / 下載 / resolve / tag / 檔案讀取，只接受 `PUBLISHED`
  - owner 可透過常規版本詳情預覽自己的 `PENDING_REVIEW` 版本
  - owner / namespace `ADMIN` / `OWNER` 在版本列表中可看到全部五種狀態：`PUBLISHED / PENDING_REVIEW / DRAFT / REJECTED / YANKED`
  - 但常規版本詳情介面並不會放行 `DRAFT / REJECTED / YANKED`
  - 稽核詳情頁走獨立 review 讀路徑，可檢視待審版本及完整版本快照

版本號不可變性規則：

| 版本狀態 | 版本號處理 |
|---------|-----------|
| DRAFT | 可刪除該版本記錄，重新使用同版本號 |
| PENDING_REVIEW | 可撤回到 DRAFT |
| REJECTED | 可刪除該版本記錄，重新使用同版本號 |
| PUBLISHED | 版本號永久佔用，不可複用 |
| YANKED | 版本號永久佔用，不可複用，版本列表中顯示但標記為不可下載 |

### skill_file

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_version_id | bigint | |
| file_path | varchar(512) | |
| content_type | varchar(128) | |
| size_bytes | bigint | |
| sha256 | varchar(64) | |
| object_key | varchar(512) | |
| is_entry_file | boolean | |
| created_at | datetime | |

### skill_tag

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | |
| tag_name | varchar(64) | |
| target_version_id | bigint | |
| created_by | varchar(128) | |
| created_at | datetime | |
| updated_by | varchar(128) | |
| updated_at | datetime | |

- `latest` 是系統保留標籤，只讀，自動跟隨 `skill.latest_version_id`；其語義嚴格等價於“最新已發布版本”，不允許 API 手動移動
- 自定義標籤（如 `beta`、`stable-2026q1`）允許人工建立和移動
- 唯一約束：`(skill_id, tag_name)`
- `target_version_id` 必須指向 `status = PUBLISHED` 的版本，應用層校驗

### review_task

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_version_id | bigint | 關聯的版本 |
| namespace_id | bigint | 所屬空間（決定誰能稽核） |
| status | enum | `PENDING` / `APPROVED` / `REJECTED` |
| version | int | 樂觀鎖版本號，預設 1 |
| submitted_by | varchar(128) | 提交人 |
| reviewed_by | varchar(128) | 稽核人 |
| review_comment | text | 稽核意見 |
| submitted_at | datetime | |
| reviewed_at | datetime | |

- 僅用於普通發布稽核，"提升到全域性"使用獨立的 `promotion_request` 表
- `version` 欄位用於樂觀鎖，防止多 Pod 併發稽核
- 業務約束：同一 `skill_version_id` 在 `status=PENDING` 時只能存在一條記錄，重複提交返回 409 Conflict。撤回時刪除 `PENDING` review_task，並將 `skill_version` 回退到 `DRAFT`
- PostgreSQL 併發約束落地：透過唯一索引 `(skill_version_id)` + 軟刪除標記實現。`review_task` 表增加 `deleted` 欄位（bigint, 預設 0），唯一索引改為 `(skill_version_id, deleted)`。撤回時將 `deleted` 設為 `id`（非零值），新提交時 `deleted=0`，利用唯一索引防止併發重複提交。或者採用更簡單的方案：撤回時物理刪除 review_task 記錄，依賴 `INSERT` 的唯一約束 `(skill_version_id)` 防併發。PostgreSQL 還支援 partial unique index 方案：`CREATE UNIQUE INDEX ON review_task (skill_version_id) WHERE status = 'PENDING'`，更優雅地實現"PENDING 狀態唯一"約束

### promotion_request

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| source_skill_id | bigint | 來源團隊 skill |
| source_version_id | bigint | 申請提升的版本 |
| target_namespace_id | bigint | 目標全域性 namespace |
| target_skill_id | bigint | 審批透過後生成的全域性 skill ID，nullable |
| status | enum | `PENDING` / `APPROVED` / `REJECTED` |
| version | int | 樂觀鎖版本號，預設 1 |
| submitted_by | varchar(128) | 提交人 |
| reviewed_by | varchar(128) | 稽核人 |
| review_comment | text | 稽核意見 |
| submitted_at | datetime | |
| reviewed_at | datetime | |

- 完整表達"哪個團隊 skill 的哪一版被申請提升到哪個全域性空間"
- 審批透過後填充 `target_skill_id`，指向全域性空間新建立的 skill
- `promotion_request` 是提升關係的唯一事實來源，skill 表不再冗餘 `promoted_to_skill_id`
- 業務約束：同一 `source_version_id` 在 `status=PENDING` 時只能存在一條記錄，重複提交返回 409 Conflict
- PostgreSQL 併發約束落地：與 `review_task` 類似，透過唯一索引防止併發重複提交。推薦使用 partial unique index：`CREATE UNIQUE INDEX ON promotion_request (source_version_id) WHERE status = 'PENDING'`，或增加 `deleted` 欄位 + `(source_version_id, deleted)` 唯一約束，或採用物理刪除 + `(source_version_id)` 唯一約束方案

### skill_star

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | |
| user_id | varchar(128) | |
| created_at | datetime | |

唯一約束：`(skill_id, user_id)`

### skill_rating

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | |
| user_id | varchar(128) | |
| score | tinyint | 1-5 |
| review_text | varchar(2000) | 可選文字評價；空值表示僅評分 |
| review_status | enum | `VISIBLE` / `HIDDEN`，隱藏不影響評分聚合 |
| moderated_by | varchar(128) | 最近一次管理操作人，nullable |
| moderated_at | datetime | 最近一次管理時間，nullable |
| moderation_reason | varchar(500) | 隱藏原因，nullable |
| lock_version | bigint | 樂觀鎖版本；併發編輯或治理衝突返回 409 |
| created_at | datetime | |
| updated_at | datetime | |

唯一約束：`(skill_id, user_id)`，每人每技能一條，可修改。刪除文字評價只清空
`review_text`，保留評分和既有治理狀態；管理員隱藏評價時也保留評分，避免作者透過
清空後重新提交繞過治理，或治理動作改變聚合分數。

### user_account

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| display_name | varchar(128) | |
| email | varchar(256) | |
| avatar_url | varchar(512) | |
| status | enum | `ACTIVE` / `PENDING` / `DISABLED` / `MERGED` |
| merged_to_user_id | varchar(128) | 合併目標使用者 ID，僅 MERGED 狀態有值 |
| system_account | boolean | 系統服務賬號，禁止互動式 Web/OAuth 登入 |
| created_at | datetime | |
| updated_at | datetime | |

- 狀態語義：
  - `ACTIVE`：正常使用
  - `PENDING`：等待管理員審批（AccessPolicy 返回 PENDING_APPROVAL 時建立）
  - `DISABLED`：管理員封禁，登入後拒絕所有操作，返回 403
  - `MERGED`：已合併到其他賬號，保留記錄不物理刪除；登入直接拒絕，不向呼叫方洩露合併目標
- 授權層在每次請求時檢查使用者狀態，非 `ACTIVE` 使用者拒絕所有寫操作
- system account 可按獨立 Token Policy 使用非互動憑證，但不能透過本地密碼或外部 OAuth
  建立普通使用者 Session

### identity_binding

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| user_id | varchar(128) | |
| provider_code | varchar(64) | 如 `github` |
| subject | varchar(256) | OAuth Provider 返回的唯一使用者標識 |
| login_name | varchar(128) | 如 GitHub login |
| extra_json | json | 原始擴充套件欄位 |
| created_at | datetime | |
| updated_at | datetime | |

- 唯一約束：`(provider_code, subject)`
- 一期只接入 GitHub OAuth，但表結構支援後續擴充套件多個 OAuth Provider

### api_token

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| subject_type | varchar(32) | `USER`（一期）/ `SERVICE_ACCOUNT`（預留） |
| subject_id | varchar(128) | 關聯主體 ID（一期等同於 user_id） |
| user_id | varchar(128) | 相容欄位，一期與 subject_id 相同 |
| name | varchar(128) | Token 名稱（必填），如"CI/CD"、"本地開發" |
| token_prefix | varchar(16) | |
| token_hash | varchar(64) | |
| scope_json | json | |
| expires_at | datetime | |
| last_used_at | datetime | |
| revoked_at | datetime | |
| created_at | datetime | |

### audit_log

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| actor_user_id | varchar(128) | |
| action | varchar(64) | |
| target_type | varchar(64) | |
| target_id | bigint | |
| request_id | varchar(64) | |
| client_ip | varchar(64) | |
| user_agent | varchar(512) | |
| detail_json | json | |
| created_at | datetime | |

## 3.2 RBAC 實體

一期即上線完整 RBAC，平臺角色按最小許可權拆分，避免所有治理能力壓在單一超管角色上。

平臺角色（一期內建，Flyway 預置）：

| 角色 code | 說明 | 典型許可權 |
|-----------|------|---------|
| `SUPER_ADMIN` | 平臺超管，擁有所有許可權 | 全部 |
| `SKILL_ADMIN` | 技能治理：全域性空間稽核、提升稽核、隱藏/恢復、撤回已發布版本 | `review:approve`, `skill:manage`, `promotion:approve` |
| `USER_ADMIN` | 使用者治理：准入審批、封禁/解封、角色分配（不可分配 SUPER_ADMIN） | `user:manage`, `user:approve` |
| `AUDITOR` | 審計只讀：檢視審計日誌 | `audit:read` |

- 名稱空間許可權仍由 `namespace_member.role`（OWNER / ADMIN / MEMBER）決定，不走 RBAC 表
- 一個使用者可持有多個平臺角色（多條 `user_role_binding`）
- `SUPER_ADMIN` 隱含所有許可權，程式碼中硬判定短路

### role

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| code | varchar(64) | `SUPER_ADMIN` / `SKILL_ADMIN` / `USER_ADMIN` / `AUDITOR` |
| name | varchar(128) | 展示名 |
| description | varchar(512) | |
| is_system | boolean | 系統內建角色不可刪除 |
| created_at | datetime | |

### permission

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| code | varchar(128) | 如 `skill:publish`, `review:approve`, `user:manage` |
| name | varchar(128) | |
| group_code | varchar(64) | 許可權分組 |

### role_permission

| 欄位 | 型別 | 說明 |
|------|------|------|
| role_id | bigint | |
| permission_id | bigint | |

### user_role_binding

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| user_id | varchar(128) | |
| role_id | bigint | |
| created_at | datetime | |

## 3.3 搜尋檔案表

### skill_search_document

一個 skill 對應一條搜尋檔案，內容取“最新已發布版本”。實現上可由 `latest_version_id` 作為快取指標承載，但其語義只能是 latest published pointer。

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | 唯一，一 skill 一條 |
| namespace_id | bigint | 用於空間過濾 |
| owner_id | varchar(128) | 用於 PRIVATE 可見性判定 |
| title | varchar(256) | |
| summary | varchar(512) | |
| keywords | varchar(512) | |
| search_text | text | `displayName`、`slug`、`summary`，以及 frontmatter 中除 `name` / `description` / `version` 外的欄位展開結果 |
| visibility | enum | 冗餘，避免搜尋時 join |
| status | enum | |
| updated_at | datetime | |

PostgreSQL Full-Text Index：在 `skill_search_document` 表增加 `search_vector tsvector` 列，透過觸發器或 `GENERATED ALWAYS AS` 自動維護，建立 GIN 索引。

## 3.4 冪等記錄表

### idempotency_record

| 欄位 | 型別 | 說明 |
|------|------|------|
| request_id | varchar(64) | 主鍵，客戶端傳入的 UUID v4 |
| resource_type | varchar(64) | 如 `skill_version`, `api_token` |
| resource_id | bigint | 業務操作產生的資源 ID |
| status | enum | `PROCESSING` / `COMPLETED` / `FAILED` |
| response_status_code | int | 原始響應狀態碼 |
| created_at | datetime | |
| expires_at | datetime | 過期時間（預設 24h） |

- 流程：收到請求 → 插入 record（PROCESSING）→ 業務處理 → 更新為 COMPLETED + resource_id → 重複請求時查 record 返回已有結果
- Redis 做快速去重快取（SETNX），PostgreSQL 做持久化兜底
- 定時任務清理過期記錄

## 3.5 關鍵索引設計

| 表 | 索引 | 用途 |
|------|------|------|
| namespace | `(slug)` UNIQUE | 唯一約束 |
| skill | `(namespace_id, status)` | 名稱空間內技能列表 |
| skill | `(namespace_id, slug)` UNIQUE | 唯一約束 |
| skill_version | `(skill_id, status)` | 版本列表 |
| skill_version | `(skill_id, version)` UNIQUE | 唯一約束 |
| skill_tag | `(skill_id, tag_name)` UNIQUE | 標籤唯一約束 |
| review_task | `(namespace_id, status)` | 稽核列表 |
| review_task | `(submitted_by, status)` | 我的提交 |
| promotion_request | `(source_skill_id)` | 按來源 skill 查詢 |
| promotion_request | `(status)` | 待稽核列表 |
| idempotency_record | `(expires_at)` | 過期清理 |
| audit_log | `(created_at)` | 審計查詢 |
| audit_log | `(actor_user_id, created_at)` | 使用者操作歷史 |
| skill_star | `(user_id)` | 我的收藏 |
| skill_star | `(skill_id)` | 技能收藏數 |
| skill_rating | `(skill_id)` | 評分聚合 |
| namespace_member | `(namespace_id, user_id)` UNIQUE | 成員唯一約束 |
| namespace_member | `(user_id)` | 使用者所屬空間 |
| identity_binding | `(provider_code, subject)` UNIQUE | 身份查詢 |
| api_token | `(token_hash)` | Token 校驗 |
