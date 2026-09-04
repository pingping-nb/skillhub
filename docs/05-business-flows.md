# skillhub 核心業務流

## 1 發布流程

一期採用同步發布模型：上傳、校驗、儲存、持久化在一次請求中同步完成。前端透過非同步上傳（帶進度條）提升使用者體驗，但後端處理是同步的。

> **設計決策**：一期暫不考慮非同步發布（uploadId、publishId、狀態輪詢、非同步轉正等）。一期技能包為文字資源包，體積有限（上限 10MB），同步處理足以滿足需求。如後續引入大檔案或複雜校驗流程，再考慮非同步模型。

### 1.1 當前發布流程基線

```
使用者提交發布
    │
    ▼
① 身份與許可權校驗（使用者是否為該 namespace 的 MEMBER 以上）
    │
    ▼
② 技能包校驗
   - SKILL.md 存在性、frontmatter 格式
   - 檔案型別白名單、單檔案大小限制、總包大小限制
   - 版本號 semver 合法性、不與已有版本衝突
   - [擴充套件點] PrePublishValidator 鏈（一期空實現）
    │
    ▼
③ 同步寫入物件儲存
   - 檔案逐個上傳到正式路徑 `skills/{skillId}/{versionId}/{filePath}`，記錄 SHA-256
   - 生成預打包 zip 到 `packages/{skillId}/{versionId}/bundle.zip`
    │
    ▼
④ 持久化資料
   - 建立或關聯 skill 記錄（首次發布時建立 skill）
   - 建立 skill_version（普通使用者進入 `PENDING_REVIEW`，`SUPER_ADMIN` 直達 `PUBLISHED`）
   - 建立 skill_file 記錄
   - 解析 SKILL.md frontmatter → parsed_metadata_json
   - 生成 manifest_json
   - 直髮場景更新 skill.latest_version_id
    │
    ▼
⑤ 同步寫入審計日誌
    │
    ▼
⑥ 非同步觸發搜尋索引寫入
```

當前版本採用稽核流，不再區分“Phase 2 直髮”與“Phase 3 恢復稽核”兩套現實實現：

- 普通使用者發布請求建立 `skill_version(status=PENDING_REVIEW)`
- 同步建立 `review_task(status=PENDING)`
- 稽核透過後轉為 `PUBLISHED`
- 稽核拒絕後轉為 `REJECTED`
- 撤回稽核時刪除 `PENDING review_task`，並將 `skill_version` 回退到 `DRAFT`
- 例外：提交人持有 `SUPER_ADMIN` 平臺角色時，發布入口直接建立 `skill_version(status=PUBLISHED)`，跳過 `review_task` 建立，同時不再要求其必須是目標 namespace 成員
- 上述例外必須對 Web、`/api/v1/publish`、`/api/v1/publish` 保持一致
- 若重傳新版本時發現舊的 `PENDING_REVIEW` 版本，舊版本會被自動降回 `DRAFT`，再建立新的待審版本

### 1.2 生命週期讀模型

當前程式碼中的 skill 生命週期展示與操作判斷，不再依賴舊的 `latestVersionStatus`、`viewingVersionStatus` 一類拼裝欄位，而統一基於以下 projection：

- `headlineVersion`：當前詳情頁/我的技能列表主展示版本
- `publishedVersion`：當前最新可公開分發的已發布版本
- `ownerPreviewVersion`：詳情 projection 中僅暴露給 owner / namespace 管理者的 `PENDING_REVIEW` 版本
- `resolutionMode`：`PUBLISHED` / `OWNER_PREVIEW` / `NONE`

業務規則：

- 公開入口只認 `publishedVersion`
- owner 進入詳情頁時，如果沒有可用 `publishedVersion`，才允許 `headlineVersion = ownerPreviewVersion`
- 推廣到全域性、安裝命令、公開下載都只能繫結到 `publishedVersion`
- `hidden` 是獨立治理覆蓋層，不屬於 skill 生命週期狀態機

### 1.3 Skill 可見性與角色訪問矩陣

以下矩陣以當前後端實現為準，綜合了 `VisibilityChecker`、`SkillQueryService`、`SkillDownloadService`、`ReviewPermissionChecker` 的實際行為。

#### 1.3.1 Skill 容器讀取

| 角色 | PUBLIC | NAMESPACE_ONLY | PRIVATE | hidden 任意 visibility | 無 `publishedVersion`（`latest_version_id=null`） |
|------|--------|----------------|---------|------------------------|-----------------------------------------------|
| 匿名使用者 | 可讀 | 不可讀 | 不可讀 | 不可讀 | 不可讀 |
| 登入非成員 | 可讀 | 不可讀 | 不可讀 | 不可讀 | 不可讀 |
| namespace MEMBER | 可讀 | 可讀 | 不可讀 | 不可讀 | 僅自己是 owner 時可讀 |
| skill owner | 可讀 | 可讀 | 可讀 | 可讀 | 可讀 |
| namespace ADMIN / OWNER | 可讀 | 可讀 | 可讀 | 可讀 | 不可讀，除非本人也是 skill owner |
| SKILL_ADMIN / SUPER_ADMIN（僅平臺角色） | 與普通登入使用者一致；普通讀路徑不會因為平臺角色自動穿透 private / hidden / unpublished |

補充：
- `hidden=true` 時，可讀許可權會收斂為“skill owner 或 namespace `ADMIN` / `OWNER`”
- `visibility=PUBLIC` 也不意味著未發布 skill 可見；當 `latest_version_id` 為空時，只有 owner 能讀

#### 1.3.2 Version 狀態讀取

| 場景 / 角色 | DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED | YANKED |
|------------|-------|----------------|-----------|----------|--------|
| 普通 skill 詳情頁主版本投影 | 不展示 | owner / namespace 管理者可作為 `ownerPreviewVersion` 展示 | 展示 | 不展示 | 不展示 |
| 普通 `listVersions` 訪客 | 不可見 | 不可見 | 可見 | 不可見 | 不可見 |
| `listVersions` 的 owner / namespace ADMIN / OWNER | 可見 | 可見 | 可見 | 可見 | 可見 |
| 常規 `getVersionDetail` | 不可讀 | 僅 owner 可讀 | 可讀 | 不可讀 | 不可讀 |
| 下載 / resolve / tag / 檔案讀取 | 不可用 | 不可用 | 可用 | 不可用 | 不可用 |
| review 詳情頁 | 可見完整快照 | 可見完整快照 | 可見完整快照 | 可見完整快照 | 可見完整快照 |

補充：
- `YANKED` 版本仍出現在管理視角的版本列表中，但不可下載
- `yank` 當前最新已發布版本時，會重算 `latest_version_id` 指向下一個最新的 `PUBLISHED` 版本；若沒有，則置空

#### 1.3.3 稽核 / 推廣 / 治理動作

| 角色 | 發布新版本 | 提交稽核 | 稽核團隊空間 | 稽核全域性空間 | 提交推廣 | 稽核推廣 | hide / unhide | yank 已發布版本 |
|------|------------|----------|--------------|--------------|----------|----------|---------------|----------------|
| 匿名使用者 | 不可 | 不可 | 不可 | 不可 | 不可 | 不可 | 不可 | 不可 |
| namespace MEMBER | 可發布到所屬 namespace；新版本進入 `PENDING_REVIEW` | 自己作為 owner 時可；不能代別人提審 | 不可 | 不可 | 自己作為 owner 時可 | 不可 | 不可 | 不可 |
| skill owner | 可 | 可 | 不可 | 不可 | 可 | 不可 | 不可 | 不可 |
| namespace ADMIN / OWNER | 可 | 可為本空間 skill 提交稽核 | 可 | 不可 | 可 | 不可 | 不可 | 不可 |
| SKILL_ADMIN | 可提交併可代提審；但普通發布仍非直髮 | 可 | 可 | 可 | 可 | 可，但不能審自己的 promotion | 不可 | 可 |
| SUPER_ADMIN | 可跨 namespace 發布且直接 `PUBLISHED`，跳過 membership 檢查和 review task | 可 | 可 | 可 | 可 | 可；promotion 和 review 場景下還能審自己的提交 | 可 | 可 |

### 物件儲存寫入策略

一期同步寫入正式路徑，不使用臨時區：
- 檔案直接寫入 `skills/{skillId}/{versionId}/{filePath}`
- 如果資料庫事務失敗，物件儲存中的檔案成為孤兒物件
- 定時 GC 任務：每天掃描物件儲存中存在但資料庫中無對應 `skill_file` 記錄的檔案，清理孤兒物件
- 刪除 DRAFT/REJECTED 版本時，同步清理對應的物件儲存檔案

### CLI publish 請求規範

```
POST /api/v1/publish
Content-Type: multipart/form-data
Parts:
  - file: zip 包（必需）
  - namespace: 目標名稱空間 slug（必需）
```

一期同步響應：服務端同步完成上傳、校驗、儲存、持久化，返回 `200 OK` + skill_version 資訊。

當前 CLI 預設行為：上傳 → 進入稽核。
如果呼叫方持有 `SUPER_ADMIN`，則直接發布為 `PUBLISHED`。
Web 端與 CLI 保持同一發布語義，只是在互動上可提供更明確的稽核提示。

`/api/v1/publish` 響應：

```json
{
  "data": {
    "skillId": 456,
    "skillVersionId": 123,
    "version": "1.2.0",
    "status": "PUBLISHED",
    "namespace": "team-name",
    "slug": "my-skill"
  }
}
```

## 2 團隊技能提升到全域性空間（派生髮布）

不直接修改原 skill 的 `namespace_id`，而是在全域性空間建立新的 skill，保留來源追溯。原團隊 skill 繼續存在，安裝座標 `@team/skill` 不受影響。

```
團隊空間技能（已發布）
    │
    ▼
① 技能 owner 或 namespace admin 發起"提升到全域性"申請
    │
    ▼
② 建立 promotion_request (source_skill_id, source_version_id, target_namespace_id, status=PENDING)
    │
    ▼
③ 平臺管理員稽核
   ├── 透過 →
   │   ① 在全域性空間建立新 skill（source_skill_id = 原 skill ID）
   │   ② 複製 source_version_id 對應版本的檔案和後設資料到新 skill（嚴格使用申請時指定的版本，不取最新）
   │   ③ 新 skill.visibility = PUBLIC
   │   ④ promotion_request.target_skill_id = 新 skill ID，status → APPROVED
   │   ⑤ 搜尋索引寫入新 skill，同步寫入審計日誌
   │   （提升關係唯一事實來源是 promotion_request，UI 查詢"是否已提升"透過該表判定）
   │
   └── 拒絕 → 記錄原因，原技能不受影響
```

後續版本更新：
- 全域性空間的新 skill 由其 owner 獨立管理版本
- 原團隊 skill 可繼續獨立迭代
- 兩者版本不自動同步，如需同步由 owner 手動操作

提升流程當前嚴格繫結已發布版本：

- promotion request 的 `source_version_id` 必須指向 `publishedVersion.id`
- 不允許直接提升 `ownerPreviewVersion`

## 3 下載流程

```
下載請求
    │
    ▼
① 校驗技能狀態（ACTIVE）、版本狀態（PUBLISHED）
    │
    ▼
② 可見性檢查
   - PUBLIC: 任何人（包括匿名使用者）
   - NAMESPACE_ONLY: 該 namespace 的成員（需登入）
   - PRIVATE: owner 本人 + 該 namespace 的 ADMIN 以上（需登入）
    │
    ▼
③ 返回預生成包或按檔案清單打包
    │
    ▼
④ 審計與統計
   - audit_log 同步寫入（記錄下載人/IP/版本）
   - download_count 非同步更新（原子 SQL: download_count = download_count + 1）
   - 匿名下載：審計記錄 IP + User-Agent，不關聯使用者
   - 已登入下載：審計記錄使用者 ID
```

### download_count 熱點行最佳化預案

一期使用原子 SQL 直接更新，可接受。如出現熱點行瓶頸，切換為：
1. Redis `INCR` 做實時計數（key: `skill:downloads:{skillId}`）
2. 定時任務每 5 分鐘批次回寫 PostgreSQL
3. 查詢時合併 PostgreSQL 存量 + Redis 增量

## 4 搜尋流程

```
搜尋請求 (keyword, namespaceSlug?, sortBy)
    │
    ▼
① 構建 SearchQuery
   - 匿名使用者：visibility 限定為 PUBLIC
   - 已登入使用者：根據名稱空間成員關係計算可見範圍
    │
    ▼
② SearchQueryService.search(query)
    │
    ▼
③ 返回分頁結果（技能摘要 + 名稱空間資訊 + 評分 + 下載量）
```

## 5 收藏流程

```
收藏/取消收藏（需登入）→ 校驗許可權 → 寫入/刪除 skill_star
→ 非同步更新 skill.star_count（原子 SQL）
```

## 6 評分流程

```
提交評分 (score: 1-5)（需登入）→ 校驗許可權 → 寫入/更新 skill_rating
→ 非同步重算 skill.rating_avg 和 rating_count（SELECT AVG + Redis 分散式鎖防重複重算）
```

文字評價複用同一條 `skill_rating` 記錄：使用者提交 `score + review_text` 時同步更新評分並觸發
`SkillRatedEvent`；刪除評價只清空文字，保留星級評分。公開列表僅返回 `VISIBLE` 評價；
`SKILL_ADMIN` / `SUPER_ADMIN` 可隱藏或恢復評價，管理動作寫入審計日誌且不改變評分聚合。

## 7 非同步事件彙總

| 事件 | 觸發時機 | 消費方 |
|------|---------|--------|
| `SkillPublishedEvent` | 稽核透過 | 搜尋索引寫入 |
| `SkillYankedEvent` | 版本撤回 | 搜尋索引移除 |
| `SkillDownloadedEvent` | 下載完成 | 下載計數 |
| `SkillStarredEvent` | 收藏/取消 | 收藏計數 |
| `SkillRatedEvent` | 評分提交 | 評分重算 |
| `ReviewCompletedEvent` | 稽核完成 | 預留給後續通知能力（當前可不消費） |
| `SkillPromotedEvent` | 提升到全域性 | 搜尋索引寫入（新 skill） |

一期用 Spring ApplicationEvent + `@Async` 實現，後續可替換為訊息佇列。

### 審計日誌寫入策略

審計日誌統一同步落庫，與業務操作在同一請求內同步寫入，不走非同步事件。審計是企業內部平臺的剛性需求，不可容忍丟失。

非同步事件僅用於搜尋索引、計數器等可容忍延遲的場景。如果後續需要更強一致性，引入 outbox 模式，不依賴 ApplicationEvent + @Async 承擔可靠性。

### 非同步事件可靠性保障

Spring ApplicationEvent + @Async 存在 Pod 被殺時事件丟失的風險。補充以下兜底機制：

- 搜尋索引：定時任務每小時檢查 `skill_version.status = PUBLISHED` 但 `skill_search_document` 中無對應記錄的版本，補建索引
- 計數器：可接受少量丟失，定時任務每天凌晨從 `skill_star` / `skill_rating` 表重算修正
- 優雅停機：`@Async` 執行緒池配置 `awaitTerminationSeconds=25`，配合 30s shutdown timeout

## 8 分散式併發安全措施

| 操作 | 併發控制方式 |
|------|-------------|
| 稽核透過/拒絕 | 樂觀鎖：`UPDATE review_task SET status=? WHERE id=? AND version=?` |
| 版本發布 | 唯一約束：`(skill_id, version)` |
| 計數器更新 | 原子 SQL：`SET count = count + 1` |
| 評分重算 | 非同步 + Redis 分散式鎖防重複重算 |
| 寫操作冪等 | Redis 儲存 `X-Request-Id`，TTL 24h |

### 冪等去重規範

基於 `idempotency_record` 表實現完整冪等：

- `X-Request-Id` 由客戶端生成（UUID v4 格式）
- 客戶端不傳時，服務端自動生成但不做冪等去重

去重流程：
1. Redis `SETNX` key=`idempotent:{requestId}`（快速去重快取，TTL=24h）
   - key 已存在：查詢 `idempotency_record` 表返回原始結果
2. key 不存在：插入 `idempotency_record`（status=`PROCESSING`）
3. 執行業務邏輯
4. 成功：更新 record 為 `COMPLETED`，填充 `resource_type` + `resource_id` + `response_status_code`
5. 失敗：更新 record 為 `FAILED`
6. 重複請求時：查 record，COMPLETED 返回原始資源 ID，PROCESSING 返回 `409 Conflict`，FAILED 允許重試

適用範圍：所有 POST/PUT/DELETE 寫操作（發布、提審、建立 Token 等）

異常恢復策略：
- Redis key 存在但 `idempotency_record` 無記錄（程式在兩步之間崩潰）：視為髒狀態，刪除 Redis key，允許請求正常重入
- `idempotency_record.status = FAILED`：刪除對應 Redis key，允許客戶端用相同 `request_id` 重試
- `idempotency_record.status = PROCESSING` 超過 5 分鐘未更新：視為僵死，標記為 FAILED，刪除 Redis key，允許重試
