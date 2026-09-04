# skillhub 搜尋架構

## 1 SPI 介面

```java
public interface SearchIndexService {
    void index(SkillSearchDocument doc);
    void batchIndex(List<SkillSearchDocument> docs);
    void remove(Long skillId);
}

public interface SearchQueryService {
    SearchResult search(SearchQuery query);
}

public interface SearchRebuildService {
    void rebuildAll();
    void rebuildByNamespace(Long namespaceId);
    void rebuildBySkill(Long skillId);
}
```

## 2 SearchQuery 模型

```java
public record SearchQuery(
    String keyword,
    Long namespaceId,           // 可選，指定空間搜尋
    String namespaceSlug,       // 可選
    SearchVisibilityScope scope, // ACL 投影，由應用服務層計算注入
    SortField sortBy,           // RELEVANCE / DOWNLOADS / RATING / NEWEST
    int page,
    int size
) {}

// 搜尋可見範圍投影，由應用服務層根據當前使用者計算
public record SearchVisibilityScope(
    boolean includeAllPublic,        // 是否包含所有 PUBLIC 技能
    Set<Long> memberNamespaceIds,    // 使用者是 MEMBER 的 namespace（可見 NAMESPACE_ONLY）
    Set<Long> adminNamespaceIds,     // 使用者是 ADMIN 的 namespace（可見 PRIVATE）
    String userId                    // 當前使用者 ID（可見自己的 PRIVATE skill），匿名為 null
) {}
```

ACL 投影計算規則：
- 匿名使用者：`includeAllPublic=true`，其餘為空集，`userId=null`
- 已登入使用者：`includeAllPublic=true`，`memberNamespaceIds` = 使用者所屬空間，`adminNamespaceIds` = 使用者是 ADMIN 以上的空間，`userId` = 當前使用者 ID

一期 PostgreSQL 實現中，`SearchVisibilityScope` 轉換為 WHERE 條件：
```sql
WHERE (visibility = 'PUBLIC')
   OR (visibility = 'NAMESPACE_ONLY' AND namespace_id IN (:memberNamespaceIds))
   OR (visibility = 'PRIVATE' AND (namespace_id IN (:adminNamespaceIds) OR owner_id = :userId))
```

遷移到 ES 時，`SearchVisibilityScope` 可直接對映為 bool query 的 should/filter 子句。

## 3 搜尋檔案表 skill_search_document

一個 skill 對應一條搜尋檔案，但檔案內容的來源語義應嚴格收斂為“當前最新已發布版本”。實現上仍可由 `latest_version_id` 作為快取指標承載，但它只允許指向 `PUBLISHED` 版本；搜尋層不能再把它當作泛化的“當前版本”。

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | bigint | |
| skill_id | bigint | 唯一，一 skill 一條 |
| namespace_id | bigint | 用於空間過濾 |
| owner_id | VARCHAR(128) | 用於 PRIVATE 可見性判定 |
| title | varchar(256) | |
| summary | varchar(512) | |
| keywords | varchar(512) | |
| search_text | text | `displayName`、`slug`、`summary`，以及 frontmatter 中除 `name` / `description` / `version` 外的欄位展開結果 |
| visibility | enum | 冗餘，避免搜尋時 join |
| status | enum | |
| updated_at | datetime | |

唯一約束：`(skill_id)`

PostgreSQL 全文搜尋索引：表增加 `search_vector tsvector` 生成列，基於 `title`、`summary`、`keywords`、`search_text` 自動維護，建立 GIN 索引。詳見第 7 節。

## 4 索引寫入時機

以下場景觸發搜尋檔案更新（upsert by skill_id）：
- 稽核透過（`PENDING_REVIEW → PUBLISHED`）：重算“最新已發布版本”指標，並用該發布版本內容更新搜尋檔案
- 已發布版本被撤回（`PUBLISHED → YANKED`）：重算“最新已發布版本”指標；若不存在任何已發布版本，則移除搜尋檔案
- 技能狀態變更（隱藏/歸檔/恢復）：更新搜尋檔案的 status 欄位

## 5 搜尋演進路線

### 5.1 一期資料建模約束

一期“每個 skill 一條搜尋檔案、內容永遠取最新已發布版本”是有意的簡化。當前實現仍使用 `latest_version_id` 作為持久化指標，但這裡的語義已經收斂為 latest published pointer。這個模型在以下場景下會不夠用：

- 版本級檢索（搜尋某個舊版本的內容）
- 自定義標籤/通道檢索（搜尋 `@beta` 標籤指向的版本內容）
- 向量 chunk 索引（一個 skill 的 SKILL.md 拆成多個 embedding chunk）

這些場景不是簡單換 provider 能解決的，需要改表結構和索引寫入邏輯。

**一期搜尋能力邊界（產品限制）：**
- 搜尋只基於“最新已發布版本”的內容
- 不支援按 version 或 tag 搜尋內容
- 搜尋結果不區分 channel（`beta`、`stable` 等標籤通道）
- 使用者透過 tag 安裝的技能內容可能與搜尋結果展示的內容不一致（搜尋展示 latest，安裝的是 tag 指向的版本）
- 若要支援 channel-aware 搜尋，必須升級到 version 級索引（二期 ES 實現）

### 5.2 演進階段

| 階段 | 實現 | 索引粒度 | 切換方式 |
|------|------|---------|---------|
| 一期 | PostgreSQL Full-Text (tsvector + GIN) | 每 skill 一條（latest published） | 預設 |
| 一點五期 | PostgreSQL Full-Text + 語義向量重排 | 每 skill 一條（latest published） | 配置 `skillhub.search.semantic.enabled=true` |
| 二期 | ES / OpenSearch | 每 skill_version 一條 + skill 聚合檔案 | 配置 `search.provider=elasticsearch` |
| 三期 | 向量檢索 | 每 skill_version 多條（chunk 級） | 配置 `search.provider=vector` |
| 四期 | 混合排序 | 關鍵詞 + 向量混合 | 配置 `search.provider=hybrid` |

當前程式碼實現已落在“一點五期”：
- 仍然使用 PostgreSQL 全文搜尋作為主召回
- 搜尋檔案表新增 `semantic_vector` 快取欄位
- relevance 排序下，對全文候選集追加語義向量重排
- 語義向量不可用時自動降級為現有全文相關度排序

### 5.3 SPI 演進策略

一期 SPI 介面（`SearchIndexService` / `SearchQueryService`）的入參是 `SkillSearchDocument`（skill 粒度）。二期切換到 ES 時：

1. 新增 `SkillVersionSearchDocument` 模型（version 粒度）
2. `SearchIndexService` 新增 `indexVersion()` 方法（向下相容，一期實現空方法）
3. ES 實現同時寫入 skill 聚合檔案 + version 檔案
4. `SearchQueryService.search()` 的返回結果不變（仍返回 skill 級摘要），內部實現切換為 ES 查詢

這意味著二期切換不是零成本的——需要新增模型、擴充套件 SPI、重建索引。但一期不為此過度設計，SPI 抽象保證了切換時不需要改業務層程式碼。

透過 `@ConditionalOnProperty` 或自定義 SPI 載入機制切換。

## 6 分散式安全

`rebuildAll()` / `rebuildByNamespace()` 執行前獲取 Redis 分散式鎖（key: `search:rebuild:{scope}`，TTL: 10min），獲取失敗則跳過。

## 7 PostgreSQL 全文搜尋中文支援

PostgreSQL 全文搜尋使用 `tsvector` + `tsquery` + GIN 索引：

```sql
-- 增加 tsvector 生成列
ALTER TABLE skill_search_document
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(keywords, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(search_text, '')), 'C')
) STORED;

-- 建立 GIN 索引
CREATE INDEX idx_search_vector ON skill_search_document USING GIN (search_vector);
```

中文支援方案：
- 一期使用 `simple` 分詞配置（按空格和標點分詞），對中文支援有限但零依賴
- 如需更好的中文分詞，可安裝 `zhparser` 或 `pg_jieba` 擴充套件，替換為對應的 text search configuration
- PostgreSQL 的 `tsvector` 支援權重（A/B/C/D），可對 title 賦予更高權重，提升搜尋相關性

已知侷限：`simple` 分詞對中文的精度不如專業搜尋引擎。建議 Phase 2 完成後評估搜尋效果，如不滿足需求則在 Phase 3 提前引入 ES。
