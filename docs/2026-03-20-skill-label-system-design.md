# Skill Label System Design

> Date: 2026-03-20
> Status: Draft
> Scope: Phase 1 — 系統推薦標籤 + 特權標籤

## 1. Overview

為 SkillHub 引入 label 系統，為 skill 提供分類和標記能力。Label 掛在 skill 級別（與版本無關），支援多語言展示和搜尋。

注意：本系統使用 "label" 而非 "tag"，因為 `skill_tag` 已被版本分發通道功能佔用。

### 1.1 一期範圍

**包含：**
- 系統推薦標籤（RECOMMENDED）：管理員 CRUD + 多語言翻譯 + 排序，用於搜尋頁分類篩選
- 特權標籤（PRIVILEGED）：管理員專屬賦予，如"官方推薦"、"官方認證"、"從Clawhub映象"
- Skill 詳情頁 label 展示與管理
- 搜尋頁分類板塊（單選互斥篩選）
- 多語言搜尋命中（所有語言翻譯寫入搜尋檔案）

**不包含（保留相容性）：**
- 使用者自定義標籤
- 使用者自定義標籤稽核流程

### 1.2 關鍵決策

- `label_*` 是全新模型，與現有 `skill_tag` 徹底隔離；`skill_tag` 繼續只承擔“版本分發別名”的職責，不復用表、Service、Controller、DTO、API 路徑
- `skill_search_document.keywords` 是搜尋檔案的共享聚合欄位，不是 label 專屬欄位；一期在搜尋檔案重建時，將“現有業務 keywords 來源”和“label 翻譯文字”作為兩個獨立來源重新組合寫入
- label 搜尋整合只允許“基於權威源全量重建單個 skill 的搜尋檔案”，不允許讀取現有 `skill_search_document.keywords` 後做增量 append
- promotion 在當前系統中會建立新的 target skill，而不是把 source skill 移動到新空間；因此 label 生命週期必須按“source skill / target skill 兩條獨立 skill 記錄”建模

## 2. Data Model

注意：新表統一使用 `TIMESTAMPTZ` 作為時間戳型別標準（現有舊錶使用 `TIMESTAMP`，後續統一遷移）。

### 2.1 label_definition（標籤定義表）

```sql
CREATE TABLE label_definition (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(64) UNIQUE NOT NULL,   -- 英文標識，必填，如 code-generation
    type        VARCHAR(16) NOT NULL CHECK (type IN ('RECOMMENDED', 'PRIVILEGED')),
    visible_in_filter BOOLEAN NOT NULL DEFAULT true, -- 是否在搜尋頁分類板塊展示
    sort_order  INTEGER NOT NULL DEFAULT 0,    -- 分類板塊顯示順序
    created_by  VARCHAR(128) REFERENCES user_account(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- `slug` 即英文名稱，作為語言無關的唯一標識
- `type` 區分系統推薦標籤和特權標籤，決定許可權控制策略。DDL 層透過 CHECK 約束限制合法值；應用層許可權校驗對未知 type 採用 deny-by-default 策略
- `visible_in_filter` 控制是否出現在搜尋頁分類板塊，RECOMMENDED 和 PRIVILEGED 均可配置

### 2.2 label_translation（標籤翻譯表）

```sql
CREATE TABLE label_translation (
    id          BIGSERIAL PRIMARY KEY,
    label_id    BIGINT NOT NULL REFERENCES label_definition(id) ON DELETE CASCADE,
    locale      VARCHAR(16) NOT NULL,          -- 語言程式碼，如 en、zh、ja
    display_name VARCHAR(128) NOT NULL,        -- 該語言的顯示名稱
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(label_id, locale)
);
```

- 支援動態語言：管理員可為任意語言新增翻譯，不限於系統當前支援的語言列表
- 前端展示 fallback 順序：當前語言 → en → slug
- 後端返回 `displayName` 時，“當前語言”以請求 locale 為準；實現上使用 Spring locale 解析結果（等價於基於 `Accept-Language` / request locale），再 fallback 到 `en` 和 `slug`

### 2.3 skill_label（skill 與 label 關聯表）

```sql
CREATE TABLE skill_label (
    id          BIGSERIAL PRIMARY KEY,
    skill_id    BIGINT NOT NULL REFERENCES skill(id) ON DELETE CASCADE,
    label_id    BIGINT NOT NULL REFERENCES label_definition(id) ON DELETE CASCADE,
    created_by  VARCHAR(128) REFERENCES user_account(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, label_id)
);

CREATE INDEX idx_skill_label_label_id ON skill_label(label_id);
```

- Label 掛在 skill 級別，與版本無關
- 級聯刪除：刪除 label_definition 時自動清理關聯
- `(label_id)` 索引用於分類篩選時按 label 查詢關聯 skill 的效能最佳化
- 單個 skill 最多關聯 10 個 label（應用層校驗）

### 2.5 與現有 `skill_tag` 的關係

現有 `skill_tag` 已用於版本分發通道，例如 `latest`、`beta` 等 tag 指向某個發布版本。它具備以下特徵：
- 語義是“版本別名”，不是 skill 分類
- `version_id` 必填，tag 必須解析到某個 skill version
- API 和前端心智都已圍繞“安裝/下載某個版本別名”展開

因此：
- 新 label 系統不得複用 `skill_tag` 表結構
- 新 label 系統不得複用 `/tags` 相關 API 路徑
- 程式碼實現中必須使用獨立的命名：`LabelDefinition` / `SkillLabel` / `LabelTranslation`

### 2.4 相容性設計：使用者自定義標籤

未來使用者自定義標籤可透過以下方式擴充套件，無需新建表：

1. `label_definition.type` 增加 `USER_DEFINED` 列舉值
2. `label_definition` 增加欄位：
   - `status VARCHAR(16)` — `PENDING_REVIEW` / `APPROVED` / `REJECTED`，用於稽核流程
   - `submitted_by VARCHAR(128)` — 提交人
3. `label_translation` 對於使用者自定義標籤只需儲存使用者輸入的原始語言，無需多語言翻譯
4. 搜尋行為：使用者自定義標籤以原始文字寫入搜尋檔案 keywords，只能搜尋使用者輸入的語言

這種設計保證了：
- 現有表結構無需破壞性變更
- 許可權模型自然擴充套件（`USER_DEFINED` 型別有獨立的許可權規則）
- 搜尋整合方式一致（均透過 keywords 欄位）

## 3. Permission Model

| 操作 | 物件 | 超級管理員 | 名稱空間管理員 | Skill Owner | 普通使用者 |
|------|------|:---:|:---:|:---:|:---:|
| CRUD 標籤定義 | label_definition | ✅ | ❌ | ❌ | ❌ |
| 管理翻譯 | label_translation | ✅ | ❌ | ❌ | ❌ |
| 賦予/移除 RECOMMENDED label | skill_label | ✅ | ✅（本空間，僅限搜尋頁可見的 RECOMMENDED 標籤） | ✅（自己的 skill，僅限搜尋頁可見的 RECOMMENDED 標籤） | ❌ |
| 賦予/移除 PRIVILEGED label | skill_label | ✅ | ❌ | ❌ | ❌ |
| 檢視 label | 所有表 | ✅ | ✅ | ✅ | ✅（受 skill 可見性約束） |

- 標籤定義和翻譯的管理是全域性操作，僅超級管理員
- 賦予 label 到 skill 的許可權取決於 label 的 type
- 檢視許可權跟隨 skill 本身的可見性規則，不額外控制
- 實現上必須抽出統一的 `LabelPermissionChecker`；`SUPER_ADMIN` 始終可繞過 namespace membership 直接執行 label 管理操作，避免 controller / service 各自複製許可權邏輯

### 3.1 跨空間許可權邊界

- 名稱空間管理員只能管理其所管理空間內 skill 的 label

### 3.2 Promotion 後的 label 生命週期

當前 promotion 的事實模型是“審批後在目標全域性空間建立一個新的 target skill”，而不是把 source skill 遷移到全域性空間。

一期採用以下規則：
- promotion 不自動複製 source skill 的任何 label 到 target skill
- source skill 和 target skill 各自維護獨立的 `skill_label`
- source 空間管理員對 source skill 的 label 許可權不變
- target skill 的 label 由 target skill 當前許可權模型控制；source 空間管理員不會因 source skill 的管理許可權而自動獲得 target skill 的 label 管理權

這樣做的原因：
- 避免在一期引入“promotion 時 label 複製/回寫/同步”的額外複雜度
- 與當前 promotion “建立新 skill 副本”的領域模型一致
- 後續如需複製策略，可在 promotion approval 流程中顯式擴充套件，而不破壞現有表結構

## 4. Search Integration

採用翻譯文字展開寫入搜尋檔案方案。

### 4.1 搜尋架構現狀

當前搜尋基於 PostgreSQL Full-Text Search：
- `skill_search_document` 表有 `search_vector` 列，型別為 `tsvector GENERATED ALWAYS AS ... STORED`
- 權重體系：title (A) > summary/keywords (B) > search_text (C)
- `search_vector` 在 keywords 等欄位更新時自動重新生成，無需手動維護
- 查詢時透過 `d.search_vector @@ to_tsquery('simple', :tsQuery)` 進行全文匹配

### 4.2 Keywords 欄位寫入

在構建 `SkillSearchDocument` 時，將 skill 關聯的所有 label 的所有語言翻譯文字寫入 `keywords` 欄位。

**重要：** `skill_search_document.keywords` 不是 label 專屬欄位，而是搜尋檔案的共享聚合欄位。當前系統中，該欄位已經承載來自 skill metadata/frontmatter 的 keywords/tag 資訊。label 翻譯文字只是新增來源之一，不能覆蓋或破壞現有來源。

實現要求：
- 搜尋檔案重建時，從權威源重新計算完整的 `keywords`
- 現有業務 keywords 來源與 label 翻譯文字作為兩個獨立來源進行組合
- 不允許讀取舊的 `skill_search_document.keywords` 後做增量 append
- label 刪除、翻譯修改、skill 移除 label 後，舊 label 文字必須透過重建被徹底清理，不得殘留

建議實現上的組合順序：
1. 保留現有搜尋重建邏輯產出的原有 keywords 內容
2. 追加該 skill 關聯 label 的全部翻譯文字
3. 最終統一寫回新的 `SkillSearchDocument.keywords`

示例：
```
[原有 keywords 內容] Code Generation 程式碼生成 Official 官方推薦
```

### 4.3 搜尋檔案重建觸發時機

| 事件 | 影響範圍 | 處理方式 |
|------|---------|---------|
| Skill 被賦予/移除 label | 單個 skill | 同步重建該 skill 搜尋檔案 |
| label_translation 被修改 | 所有關聯該 label 的 skill | 非同步批次重建 |
| label_definition 被刪除 | 所有關聯該 label 的 skill | 非同步批次重建 |

#### 非同步批次重建方案

- 使用 Spring `@Async` 執行非同步任務
- 在 `skillhub-app` 層的 application service 中實現 label 相關的搜尋同步入口（不放在 `skillhub-search` 模組的 `SearchRebuildService` 中，避免搜尋模組對 `skill_label` 表的直接依賴，保持模組邊界清晰）
- 對 `label_translation` 修改、`label_definition` 刪除等“影響多個 skill”的變更，在事務內先收集受影響的 `skill_id` 列表，再在 `AFTER_COMMIT` 階段觸發非同步任務
- `label_definition` 刪除場景嚴禁在刪除後再透過 `skill_label` 反查，因為 `skill_label` 已被級聯刪除；必須在刪除前快照受影響的 `skill_id`
- 非同步任務分批呼叫 `SearchRebuildService.rebuildBySkill(Long)`
- 批次大小：每批 50 個 skill，批次間無需間隔（資料庫寫入壓力可控，系統推薦標籤數量有限）
- 失敗隔離策略：批次重建迴圈中必須對每個 skill 單獨 `try/catch` 並記錄日誌，保證單個 skill 失敗不影響後續 skill
- 錯誤處理：單個 skill 重建失敗記錄錯誤日誌，不自動重試（下次 label 變更或手動 rebuildAll 時會修復）
- 如單次受影響 skill 數過多，應允許後臺人工觸發搜尋全量重建作為兜底手段
- 對“熱門 label 導致大量 skill 批次重建”的場景，一期不單獨引入任務表；優先依賴現有非同步執行緒池執行，小規模批次直接處理，超大批次由後臺人工觸發 `rebuildAll` 兜底

### 4.4 分類篩選

搜尋頁分類板塊的篩選不走全文搜尋，而是透過 `skill_label` JOIN `label_definition` 按 slug 做大小寫不敏感過濾，再與搜尋結果取交集。避免全文搜尋的模糊性問題。

當前搜尋入口為：
```
GET /api/web/skills?q=xxx
```

一期在現有入口上增加可選 query parameter `label`，支援多值以預留未來組合篩選能力（一期前端只做單選）：
```
GET /api/web/skills?q=xxx&label=code-generation
GET /api/web/skills?q=xxx&label=code-generation&label=official  (未來)
```

#### SearchQuery 改動

`SearchQuery` 需要新增 `labelSlugs` 欄位：
```java
public record SearchQuery(
    String keyword,
    Long namespaceId,
    SearchVisibilityScope visibilityScope,
    String sortBy,
    int page,
    int size,
    List<String> labelSlugs
) {}
```

注意：
- 這不是“零成本追加欄位”；當前 controller、application service、query service、測試程式碼都需要同步修改
- 實現時應顯式梳理以下變更點：HTTP 引數解析、`SkillSearchAppService` 引數透傳、`PostgresFullTextQueryService` SQL 條件、相關單元測試/控制器測試
- 若後續搜尋過濾條件繼續增加，應考慮把 `SearchQuery` 從位置引數 record 演進為更可擴充套件的請求物件

`PostgresFullTextQueryService` 的 SQL 拼接邏輯中，當 `labelSlugs` 非空時追加：
```sql
AND d.skill_id IN (
    SELECT sl.skill_id FROM skill_label sl
    JOIN label_definition ld ON ld.id = sl.label_id
    WHERE ld.slug IN (:labelSlugs)
)
```

count 查詢同步追加相同條件。語義重排在 label 過濾後的候選集上執行，無需額外處理。

當前多 label 篩選採用 OR 語義（匹配任一 label 即命中）。未來如需 AND 語義（同時具有所有 label），可透過 `GROUP BY skill_id HAVING COUNT(*) = :labelCount` 擴充套件，API 層增加 `labelMode=any|all` 引數區分。

### 4.5 tsvector 權重

不改變現有權重體系。`search_vector` 是 `GENERATED ALWAYS AS ... STORED` 列，keywords 欄位更新後自動重新生成，無需手動維護：
- A 權重：title (displayName)
- B 權重：summary / keywords（含 label 翻譯文字）
- C 權重：searchText

## 5. API Design

### 5.1 管理後臺 API（超級管理員）

所有響應遵循專案統一響應規範 `{ code, msg, data, timestamp, requestId }`。

#### 列出所有標籤定義
```
GET /api/v1/admin/labels
```
Response `data`:
```json
[
  {
    "slug": "code-generation",
    "type": "RECOMMENDED",
    "visibleInFilter": true,
    "sortOrder": 10,
    "translations": [
      { "locale": "en", "displayName": "Code Generation" },
      { "locale": "zh", "displayName": "程式碼生成" }
    ],
    "createdAt": "2026-03-20T10:00:00Z"
  }
]
```
不分頁，系統標籤數量有限（建議上限 100 個 label_definition）。

#### 建立標籤定義
```
POST /api/v1/admin/labels
```
```json
{
  "slug": "code-generation",
  "type": "RECOMMENDED",
  "visibleInFilter": true,
  "sortOrder": 10,
  "translations": [
    { "locale": "en", "displayName": "Code Generation" },
    { "locale": "zh", "displayName": "程式碼生成" }
  ]
}
```

#### 更新標籤定義
```
PUT /api/v1/admin/labels/{slug}
```
Body 不包含 slug 欄位（slug 不可修改，以 path 引數為準）：
```json
{
  "type": "RECOMMENDED",
  "visibleInFilter": true,
  "sortOrder": 10,
  "translations": [
    { "locale": "en", "displayName": "Code Generation" },
    { "locale": "zh", "displayName": "程式碼生成" }
  ]
}
```
translations 採用全量替換策略：請求中的 translations 列表完全替代現有翻譯。如果刪除了某個語言的翻譯，會觸發關聯 skill 的非同步搜尋檔案重建。

#### 刪除標籤定義
```
DELETE /api/v1/admin/labels/{slug}
```
硬刪除。級聯刪除關聯的 translations 和 skill_label 記錄，觸發非同步搜尋檔案重建。刪除操作會記錄到 audit_log。

#### 批次更新排序
```
PUT /api/v1/admin/labels/sort-order
```
```json
{
  "items": [
    { "slug": "code-generation", "sortOrder": 1 },
    { "slug": "official", "sortOrder": 2 }
  ]
}
```

### 5.2 Skill Label 管理 API

路由約定：
- 為與現有 skill read 介面風格保持一致，skill 詳情讀取類 label API 採用雙路由暴露：`/api/v1/...` 與 `/api/web/...`
- 管理後臺 label definition API 繼續只暴露在 `/api/v1/admin/...`
- 搜尋頁所需的公開 labels 列表 API 一期同時暴露 `/api/v1/labels` 與 `/api/web/labels`，前端預設使用 `/api/web/labels`

#### 獲取 skill 的所有 label
```
GET /api/v1/skills/{namespace}/{slug}/labels
GET /api/web/skills/{namespace}/{slug}/labels
```
Response `data`:
```json
[
  {
    "slug": "code-generation",
    "type": "RECOMMENDED",
    "displayName": "程式碼生成"
  },
  {
    "slug": "official",
    "type": "PRIVILEGED",
    "displayName": "官方推薦"
  }
]
```
`displayName` 根據請求語言返回，fallback 順序：當前語言 → en → slug。

DTO 約定：
- 一期統一返回 `slug`、`type`、`displayName`
- 如後續需要區分視覺樣式，可在前端基於 `type` 判斷

#### 賦予 label
```
PUT /api/v1/skills/{namespace}/{slug}/labels/{labelSlug}
PUT /api/web/skills/{namespace}/{slug}/labels/{labelSlug}
```
許可權校驗：RECOMMENDED → owner / 名稱空間管理員 / 超級管理員；PRIVILEGED → 僅超級管理員。

#### 移除 label
```
DELETE /api/v1/skills/{namespace}/{slug}/labels/{labelSlug}
DELETE /api/web/skills/{namespace}/{slug}/labels/{labelSlug}
```
許可權校驗同賦予。

### 5.3 公開查詢 API

#### 獲取可用標籤列表（搜尋頁分類板塊）
```
GET /api/v1/labels
GET /api/web/labels
```
返回 `visible_in_filter=true` 且 `type='RECOMMENDED'` 的標籤，按 `sort_order` 排序。`PRIVILEGED` 一期不出現在搜尋頁分類篩選中，避免運營/特權標籤與功能分類混淆。Response `data`:
```json
[
  {
    "slug": "code-generation",
    "type": "RECOMMENDED",
    "displayName": "程式碼生成"
  }
]
```
`displayName` 根據請求語言返回，fallback 順序：當前語言 → en → slug。不分頁。

## 6. ClawHub 相容層

ClawHub CLI 相容層的搜尋介面 `GET /api/v1/search` 一期不支援 label 篩選。ClawHub 協議中沒有 label 概念，無需相容。

## 7. Frontend Design

### 7.1 搜尋頁

- 搜尋框下方增加分類板塊，水平排列 label 列表（資料來自 `GET /api/v1/labels`）；標籤過多時應允許換行（`flex-wrap`），避免單行溢位
- 每個 label 顯示當前語言的 display_name，fallback 順序：當前語言 → en → slug
- 點選某個 label 高亮選中，搜尋請求追加 `label` 引數；再次點選取消選中
- Label 之間單選互斥：點選另一個 label 切換選中，不支援組合篩選
- 選中狀態透過 URL query parameter 同步，支援分享連結

### 7.2 Skill 詳情頁

- 在 skill 資訊區域以 chip/badge 形式展示該 skill 的所有 label
- 特權標籤使用不同的視覺樣式區分（不同顏色或圖示）
- 點選 chip 導航到搜尋頁並帶上 `label=<slug>`（與 §7.1 同一篩選語義，便於從詳情發現同標籤技能）；預設清空關鍵詞、`sort=newest`、`page=0`
- 若該 slug 不在搜尋頁可見篩選列表中（例如 `visible_in_filter=false` 的 PRIVILEGED），URL 仍可攜帶 `label` 並生效，但篩選條上可能沒有對應高亮按鈕
- 有許可權的使用者（owner / 名稱空間管理員 / 超級管理員）看到編輯入口
- 編輯互動：彈出面板；超級管理員可從全部 label definition 中勾選/取消勾選，owner / 名稱空間管理員僅可操作搜尋頁可見的 RECOMMENDED 標籤
- 特權標籤區域僅超級管理員可見和可操作

補充說明：
- 這不是僅靠新增獨立 label API 就能完成的能力，skill detail DTO / OpenAPI / 前端型別 / 詳情頁查詢鏈路都需要增加 labels 欄位
- 建議 skill 詳情首屏直接返回 labels，避免詳情頁再額外發起一次 label 查詢導致展示和許可權狀態碎片化
- 一期僅要求 `SkillDetailResponse` 增加 `labels: List<SkillLabelDto>`；`SkillSummaryResponse` 暫不增加 labels，保持搜尋結果與列表卡片改動最小
- `SkillLabelDto` 欄位固定為 `slug`、`type`、`displayName`

### 7.3 管理後臺

- 標籤管理頁面：列表展示所有標籤定義，支援拖拽排序
- 建立/編輯標籤：表單包含 slug（建立時填寫，不可修改）、type 選擇、visible_in_filter 開關，以及動態翻譯條目（可新增任意語言的翻譯）
- 刪除標籤需二次確認，提示會影響已關聯的 skill

## 8. Testing

一期至少補充以下測試：
- `PostgresSearchRebuildService`：驗證原有 keywords 來源與 label translations 的組合結果
- `PostgresSearchRebuildService`：驗證 label 刪除/翻譯修改後，舊 label 詞不會殘留
- `PostgresFullTextQueryService`：驗證 `labelSlugs` 過濾 SQL 生效，且 count 查詢同步生效
- `SkillSearchController` / `SkillSearchAppService`：驗證 `label` 引數透傳
- promotion 相關測試：驗證 source skill 與 target skill 的 labels 獨立，不發生隱式複製

## 9. Audit

以下動作需記錄到 `audit_log`，供後臺追蹤：
- `LABEL_CREATE`
- `LABEL_UPDATE`
- `LABEL_DELETE`
- `LABEL_SORT_ORDER_UPDATE`
- `SKILL_LABEL_ATTACH`
- `SKILL_LABEL_DETACH`
