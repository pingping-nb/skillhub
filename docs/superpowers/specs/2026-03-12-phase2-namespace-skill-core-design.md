# Phase 2: 名稱空間 + Skill 核心鏈路 設計檔案

> **Goal:** 在 Phase 1 工程骨架和認證體系基礎上，實現名稱空間管理、物件儲存、技能發布/查詢/下載完整鏈路、標籤管理、PostgreSQL 全文搜尋、非同步事件基礎設施和應用層精細限流。

> **前置條件:** Phase 1 全部 3 個 Chunk 完成（後端骨架 + 認證授權 + 前端骨架）

> **重要修訂：身份主鍵約束**
> 使用者身份主鍵全鏈路統一使用 `string`。本文中涉及 `user_id`、`owner_id`、`created_by`、`updated_by`、`submitted_by`、`reviewed_by` 等使用者關聯欄位時，均應按字串型別實現，任何整型使用者主鍵描述都不再有效。

## 關鍵設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 發布流程 | 直接到 PUBLISHED，跳過稽核 | Phase 3 再加稽核攔截，Phase 2 先跑通完整鏈路 |
| 物件儲存 | LocalFile + S3 雙實現，Profile 可配置 | 本地開發零依賴，整合測試/生產用 MinIO/S3 |
| 架構模式 | 領域服務集中式（方案 A） | 與 Phase 1 一致，domain 模組包含領域服務 + 應用服務 |
| Chunk 策略 | 後端先行（Chunk 1 後端，Chunk 2 前端） | API 穩定後再做前端，減少聯調返工 |
| 前端風格 | 現代產品風（Vercel/Linear 風格） | 使用 frontend-design 技能最佳化設計質量 |
| CLI publish 介面 | Phase 2 去掉 `auto_submit` 引數，直接返回 PUBLISHED | 與 `05-business-flows.md` 有意偏差，Phase 3 回補 `auto_submit` 並調整預設 status |
| Web publish 介面 | `POST /api/v1/skills/{namespace}/publish` | 與 CLI 分開路徑但共用 service，`06-api-design.md` 未定義此路徑，Phase 2 新增 |

## Tech Stack（沿用 Phase 1 + 新增）

- 沿用: Spring Boot 3.x + JDK 21 + PostgreSQL 16 + Redis 7 + Spring Security + Spring Data JPA + Flyway
- 新增後端: AWS SDK for Java v2 (S3 Client) + SnakeYAML (frontmatter 解析)
- 沿用前端: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + shadcn/ui + Tailwind CSS
- 新增前端: react-markdown + rehype-highlight (Markdown 渲染) + react-dropzone (檔案上傳)

---

## 1. 資料庫遷移（V2__phase2_skill_tables.sql）

Phase 1 已有表：`user_account`, `identity_binding`, `api_token`, `role`, `permission`, `role_permission`, `user_role_binding`, `namespace`, `namespace_member`, `audit_log`

### 1.1 新增表

#### skill

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| namespace_id | BIGINT NOT NULL FK → namespace | 所屬名稱空間 |
| slug | VARCHAR(128) NOT NULL | URL 友好標識，來自 SKILL.md name |
| display_name | VARCHAR(256) | |
| summary | VARCHAR(512) | |
| owner_id | VARCHAR(128) NOT NULL FK → user_account | 主要維護人 |
| source_skill_id | BIGINT | 派生來源（團隊提升到全域性時記錄） |
| visibility | VARCHAR(32) NOT NULL DEFAULT 'PUBLIC' | PUBLIC / NAMESPACE_ONLY / PRIVATE |
| status | VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' | ACTIVE / HIDDEN / ARCHIVED |
| latest_version_id | BIGINT | 最新已發布版本 |
| download_count | BIGINT NOT NULL DEFAULT 0 | |
| star_count | INT NOT NULL DEFAULT 0 | |
| rating_avg | DECIMAL(3,2) NOT NULL DEFAULT 0.00 | |
| rating_count | INT NOT NULL DEFAULT 0 | |
| created_by | VARCHAR(128) FK → user_account | |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_by | VARCHAR(128) FK → user_account | |
| updated_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `UNIQUE(namespace_id, slug)`
- `(namespace_id, status)` — 名稱空間內技能列表

#### skill_version

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_id | BIGINT NOT NULL FK → skill | |
| version | VARCHAR(64) NOT NULL | semver 版本號 |
| status | VARCHAR(32) NOT NULL DEFAULT 'DRAFT' | DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED |
| changelog | TEXT | 變更說明 |
| parsed_metadata_json | JSONB | SKILL.md frontmatter 完整解析 |
| manifest_json | JSONB | 檔案清單摘要 |
| file_count | INT NOT NULL DEFAULT 0 | |
| total_size | BIGINT NOT NULL DEFAULT 0 | 總位元組數 |
| published_at | TIMESTAMP | 發布時間 |
| created_by | VARCHAR(128) FK → user_account | |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `UNIQUE(skill_id, version)`
- `(skill_id, status)` — 版本列表

#### skill_file

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| version_id | BIGINT NOT NULL FK → skill_version | |
| file_path | VARCHAR(512) NOT NULL | 包內相對路徑 |
| file_size | BIGINT NOT NULL | 位元組數 |
| content_type | VARCHAR(128) | MIME 型別 |
| sha256 | VARCHAR(64) NOT NULL | 檔案雜湊 |
| storage_key | VARCHAR(512) NOT NULL | 物件儲存 key |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `UNIQUE(version_id, file_path)`

#### skill_tag

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_id | BIGINT NOT NULL FK → skill | |
| tag_name | VARCHAR(64) NOT NULL | 標籤名 |
| version_id | BIGINT NOT NULL FK → skill_version | 指向的版本 |
| created_by | VARCHAR(128) FK → user_account | |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `UNIQUE(skill_id, tag_name)`

#### skill_search_document

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_id | BIGINT NOT NULL UNIQUE FK → skill | 一 skill 一條 |
| namespace_id | BIGINT NOT NULL | 用於空間過濾 |
| namespace_slug | VARCHAR(64) NOT NULL | 冗餘，搜尋結果直接返回無需 join |
| owner_id | VARCHAR(128) NOT NULL | 用於 PRIVATE 可見性判定 |
| title | VARCHAR(256) | |
| summary | VARCHAR(512) | |
| keywords | VARCHAR(512) | |
| search_text | TEXT | SKILL.md 正文 + frontmatter 拼接 |
| visibility | VARCHAR(32) NOT NULL | 冗餘，避免搜尋時 join |
| status | VARCHAR(32) NOT NULL | |
| search_vector | TSVECTOR GENERATED ALWAYS AS (...) STORED | 全文搜尋向量 |
| updated_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `UNIQUE(skill_id)`
- GIN 索引 on `search_vector`
- `(namespace_id)` — 空間過濾
- `(visibility)` — 可見性過濾

### 1.2 search_vector 生成列定義

```sql
ALTER TABLE skill_search_document
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(keywords, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(search_text, '')), 'C')
) STORED;

CREATE INDEX idx_search_vector ON skill_search_document USING GIN (search_vector);
```

權重分配：title(A 最高) > summary+keywords(B) > search_text(C)。使用 `simple` 分詞配置，零依賴，對中文支援有限但滿足一期需求。

---

## 2. 物件儲存模組（skillhub-storage）

### 2.1 SPI 介面

```java
package com.iflytek.skillhub.storage;

public interface ObjectStorageService {
    void putObject(String key, InputStream data, long size, String contentType);
    InputStream getObject(String key);
    void deleteObject(String key);
    void deleteObjects(List<String> keys);
    boolean exists(String key);
    ObjectMetadata getMetadata(String key);
}

public record ObjectMetadata(long size, String contentType, Instant lastModified) {}
```

### 2.2 雙實現

| 實現類 | 啟用條件 | 儲存位置 |
|--------|---------|---------|
| `LocalFileStorageService` | `skillhub.storage.provider=local` | 本地檔案系統 `${skillhub.storage.local.base-path}` |
| `S3StorageService` | `skillhub.storage.provider=s3` | MinIO / AWS S3 |

透過 `@ConditionalOnProperty(name = "skillhub.storage.provider")` 切換。

### 2.3 LocalFileStorageService 實現要點

- 基於 `java.nio.file.Path` 操作
- key 對映為檔案路徑：`basePath/key`（key 中的 `/` 對映為目錄層級）
- `putObject`：建立父目錄 + 寫入檔案（原子寫入：先寫 `.tmp` 再 rename）
- `deleteObjects`：逐個刪除 + 清理空目錄
- 執行緒安全：檔案操作本身是原子的，無需額外鎖

### 2.4 S3StorageService 實現要點

- 使用 AWS SDK for Java v2 的 `S3Client`（同步客戶端，一期同步發布足夠）
- 配置類 `S3StorageProperties`：endpoint, bucket, accessKey, secretKey, region
- `putObject`：`PutObjectRequest` + `RequestBody.fromInputStream()`
- `getObject`：`GetObjectRequest` → `ResponseInputStream`
- bucket 不存在時自動建立（啟動時檢查）

### 2.5 配置示例

```yaml
# application.yml（預設 local）
skillhub:
  storage:
    provider: local
    local:
      base-path: ./data/storage

# application-s3.yml
skillhub:
  storage:
    provider: s3
    s3:
      endpoint: http://localhost:9000
      bucket: skillhub
      access-key: minioadmin
      secret-key: minioadmin
      region: us-east-1
```

### 2.6 物件 Key 規則

- 檔案：`skills/{skillId}/{versionId}/{filePath}`
- 打包 zip：`packages/{skillId}/{versionId}/bundle.zip`
- 使用不可變 ID（skillId/versionId），避免 slug 變更導致 key 失效

---

## 3. 名稱空間管理

### 3.1 領域服務

Phase 1 已建立 `Namespace` 和 `NamespaceMember` 實體及 JPA Repository。Phase 2 新增領域服務。

> **注意：Phase 1 實體補齊** — 現有 `Namespace.java` 缺少 `type`（NamespaceType 列舉：GLOBAL/TEAM）和 `avatar_url` 欄位，`NamespaceMember.java` 缺少 `updatedAt` 欄位，但 V1 資料庫表已包含這些列。Phase 2 實現時需先補齊這些欄位，確保 JPA 實體與資料庫 schema 完全對齊。新增 `NamespaceType` 列舉。

#### NamespaceService（`skillhub-domain`）

```
createNamespace(slug, displayName, description, creatorUserId) → Namespace
  - slug 格式校驗 + 保留詞校驗 + 唯一性校驗
  - type 固定為 TEAM（使用者不可建立 GLOBAL 型別，GLOBAL 由 Flyway 預置）
  - 建立 namespace 記錄
  - 建立者自動成為 OWNER（插入 namespace_member）

updateNamespace(namespaceId, displayName, description, avatarUrl) → Namespace

getNamespaceBySlug(slug) → Namespace

listPublicNamespaces(page, size) → Page<Namespace>
  - 只返回 ACTIVE 狀態的名稱空間

changeNamespaceStatus(namespaceId, newStatus)
  - ACTIVE ↔ FROZEN ↔ ARCHIVED 狀態流轉
  - FROZEN：只讀不可發布新版本
  - ARCHIVED：對外不可見
```

#### NamespaceMemberService（`skillhub-domain`）

```
addMember(namespaceId, userId, role) → NamespaceMember
  - 唯一約束：一個使用者在一個空間只有一個角色
  - 不可直接新增為 OWNER

removeMember(namespaceId, userId)
  - OWNER 不可被移除

updateMemberRole(namespaceId, userId, newRole)
  - 不可透過此方法設定 OWNER（需用 transferOwnership）

transferOwnership(namespaceId, currentOwnerId, newOwnerId)
  - 原 OWNER → ADMIN
  - 目標使用者 → OWNER
  - 事務內完成

listMembers(namespaceId, page, size) → Page<NamespaceMember>

getMemberRole(namespaceId, userId) → Optional<NamespaceRole>
```

> **Repository 補充** — Phase 1 的 `NamespaceRepository` 需新增 `Page<Namespace> findByStatus(NamespaceStatus status, Pageable pageable)` 方法。`NamespaceMemberRepository` 需新增 `Page<NamespaceMember> findByNamespaceId(Long namespaceId, Pageable pageable)` 和 `void deleteByNamespaceIdAndUserId(Long namespaceId, String userId)` 方法。

### 3.2 Slug 校驗規則

```java
public class SlugValidator {
    private static final Pattern SLUG_PATTERN =
        Pattern.compile("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$");
    private static final Set<String> RESERVED_SLUGS = Set.of(
        "admin", "api", "dashboard", "search", "auth",
        "me", "global", "system", "static", "assets", "health"
    );

    public static void validate(String slug) {
        // 長度 2-64
        // 匹配 SLUG_PATTERN
        // 不含連續雙連字元 --
        // 不在保留詞列表中
    }
}
```

### 3.3 Controller 層

| 方法 | 路徑 | 許可權 |
|------|------|------|
| GET | `/api/v1/namespaces` | 公開 |
| GET | `/api/v1/namespaces/{slug}` | 公開 |
| POST | `/api/v1/namespaces` | 已登入 |
| PUT | `/api/v1/namespaces/{slug}` | namespace ADMIN+ |
| POST | `/api/v1/namespaces/{slug}/members` | namespace ADMIN+ |
| DELETE | `/api/v1/namespaces/{slug}/members/{userId}` | namespace ADMIN+ |
| PUT | `/api/v1/namespaces/{slug}/members/{userId}/role` | namespace OWNER |
| GET | `/api/v1/namespaces/{slug}/members` | namespace MEMBER+ |

許可權判定複用 Phase 1 的 `RbacService`，新增 namespace 級別檢查方法。

> **SecurityConfig 更新** — Phase 1 的 `SecurityConfig` 中 `.requestMatchers("/api/v1/skills/**", "/api/v1/namespaces/**").permitAll()` 放行了所有 skills/namespaces 路徑。Phase 2 新增了需要認證的寫操作（publish、tag 管理等），需要細化安全配置：GET 請求 permitAll，POST/PUT/DELETE 請求 authenticated。具體做法：按 HTTP method + path 組合配置，或在 Controller 層透過 `@PreAuthorize` 註解做許可權校驗（推薦後者，更靈活）。

---

## 4. 技能發布核心鏈路

### 4.1 領域實體（`domain.skill` 包）

新增實體：

| 實體 | 說明 |
|------|------|
| `Skill` | 技能主表，含 namespace 關聯、可見性、統計計數 |
| `SkillVersion` | 版本記錄，含 status 狀態機、後設資料 JSON |
| `SkillFile` | 檔案清單，含 storage_key 和 sha256 |
| `SkillTag` | 自定義標籤，指向某個 version |

新增列舉：

| 列舉 | 值 |
|------|------|
| `SkillVersionStatus` | `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`（Phase 2 只用 DRAFT/PUBLISHED） |
| `SkillVisibility` | `PUBLIC`, `NAMESPACE_ONLY`, `PRIVATE` |
| `SkillStatus` | `ACTIVE`, `HIDDEN`, `ARCHIVED` |

新增 Repository 介面（`domain.skill` 包）：

```java
public interface SkillRepository {
    Optional<Skill> findById(Long id);
    Optional<Skill> findByNamespaceIdAndSlug(Long namespaceId, String slug);
    Page<Skill> findByNamespaceIdAndStatus(Long namespaceId, SkillStatus status, Pageable pageable);
    Skill save(Skill skill);
    List<Skill> findByOwnerId(Long ownerId);
    void incrementDownloadCount(Long skillId);  // UPDATE skill SET download_count = download_count + 1 WHERE id = ?
}

public interface SkillVersionRepository {
    Optional<SkillVersion> findById(Long id);
    Optional<SkillVersion> findBySkillIdAndVersion(Long skillId, String version);
    Page<SkillVersion> findBySkillIdAndStatus(Long skillId, SkillVersionStatus status, Pageable pageable);
    SkillVersion save(SkillVersion version);
}

public interface SkillFileRepository {
    List<SkillFile> findByVersionId(Long versionId);
    SkillFile save(SkillFile file);
    void saveAll(List<SkillFile> files);
    void deleteByVersionId(Long versionId);
}

public interface SkillTagRepository {
    Optional<SkillTag> findBySkillIdAndTagName(Long skillId, String tagName);
    List<SkillTag> findBySkillId(Long skillId);
    SkillTag save(SkillTag tag);
    void delete(SkillTag tag);
}
```

### 4.2 技能包校驗器（`domain.skill.validation` 包）

#### SkillPackageValidator

負責解壓 zip 後的完整校驗：

```
validate(List<PackageEntry> entries) → ValidationResult

校驗項：
1. SKILL.md 存在性 — 根目錄必須包含 SKILL.md
2. frontmatter 格式 — name 和 description 必需
3. name 欄位格式 — 符合 slug 校驗規則
4. version 欄位 — 必需，semver 格式
5. 檔案型別白名單 — .md/.txt/.json/.yaml/.yml/.js/.ts/.py/.sh/.png/.jpg/.svg
6. 單檔案大小 ≤ 1MB（可配置）
7. 總包大小 ≤ 10MB（可配置）
8. 檔案數量 ≤ 100（可配置）
9. 版本號不與已有版本衝突
```

配置化限制：

```yaml
skillhub:
  publish:
    max-file-size: 1MB
    max-package-size: 10MB
    max-file-count: 100
    allowed-extensions:
      - .md
      - .txt
      - .json
      - .yaml
      - .yml
      - .js
      - .ts
      - .py
      - .sh
      - .png
      - .jpg
      - .svg
```

#### PrePublishValidator 擴充套件點

```java
public interface PrePublishValidator {
    ValidationResult validate(SkillPackageContext context);
}

public record SkillPackageContext(
    List<PackageEntry> entries,
    SkillMetadata metadata,
    String publisherId,
    Long namespaceId
) {}

public record ValidationResult(boolean passed, List<String> errors) {
    public static ValidationResult pass() { return new ValidationResult(true, List.of()); }
    public static ValidationResult fail(List<String> errors) { return new ValidationResult(false, errors); }
}

// Phase 2 預設實現
@Component
@ConditionalOnMissingBean(PrePublishValidator.class)
public class NoOpPrePublishValidator implements PrePublishValidator {
    public ValidationResult validate(SkillPackageContext context) {
        return ValidationResult.pass();
    }
}
```

### 4.3 SKILL.md 解析器（`domain.skill.metadata` 包）

```java
public class SkillMetadataParser {
    /**
     * 解析 SKILL.md 內容，提取 frontmatter 和正文
     */
    public SkillMetadata parse(String skillMdContent) { ... }
}

public record SkillMetadata(
    String name,           // → skill.slug（首次發布後不可變更）
    String description,    // → skill.summary
    String version,        // semver 版本號
    String body,           // Markdown 正文
    Map<String, Object> frontmatter  // 完整 frontmatter → parsed_metadata_json
) {}
```

解析規則：
- 使用 SnakeYAML 解析 `---` 之間的 frontmatter
- `name` 和 `description` 為必需欄位
- `version` 為必需欄位，semver 格式校驗
- `x-astron-*` 字首的擴充套件欄位保留在 frontmatter map 中
- 正文部分（frontmatter 之後的內容）作為 `body` 返回

### 4.4 發布服務（`domain.skill.service` 包）

#### SkillPublishService

```
publishSkill(namespaceSlug, zipInputStream, publisherId, visibility) → SkillVersion

完整流程：
① 解析 namespace — 透過 slug 查詢，校驗 ACTIVE 狀態
② 許可權校驗 — 使用者是該 namespace 的 MEMBER 以上
③ 解壓 zip — 記憶體中解壓為 List<PackageEntry>
④ 技能包校驗 — SkillPackageValidator.validate()
⑤ PrePublishValidator 鏈 — 擴充套件點校驗
⑥ 解析 SKILL.md — SkillMetadataParser.parse()
⑦ 建立/關聯 skill 記錄
   - 首次發布：建立 skill（slug = metadata.name）
   - 後續發布：校驗 slug 一致性（不可變更）
⑧ 寫入物件儲存
   - 逐檔案上傳到 skills/{skillId}/{versionId}/{filePath}
   - 計算每個檔案的 SHA-256
   - 生成 bundle.zip：在服務端記憶體中重新打包（僅包含透過校驗的檔案），而非直接使用使用者上傳的原始 zip
   - bundle.zip 寫入 packages/{skillId}/{versionId}/bundle.zip
⑨ 持久化
   - 建立 skill_version（status=PUBLISHED）
   - 批次建立 skill_file 記錄
   - 更新 skill.latest_version_id
   - 更新 skill.display_name 和 skill.summary（取最新版本）
⑩ 發布事件
   - 發布 SkillPublishedEvent（觸發搜尋索引更新）
```

#### PackageEntry 模型

```java
public record PackageEntry(
    String path,          // 包內相對路徑
    byte[] content,       // 檔案內容
    long size,            // 位元組數
    String contentType    // MIME 型別
) {}
```

### 4.5 Controller 層

#### CLI 發布介面

```
POST /api/v1/cli/publish
Content-Type: multipart/form-data
Parts:
  - file: zip 包（必需）
  - namespace: 目標名稱空間 slug（必需）
  - visibility: PUBLIC / NAMESPACE_ONLY / PRIVATE（可選，預設 PUBLIC）

Response 200:
{
  "code": 0,
  "data": {
    "skillId": 1,
    "namespace": "global",
    "slug": "my-skill",
    "version": "1.0.0",
    "status": "PUBLISHED",
    "fileCount": 5,
    "totalSize": 12345
  }
}
```

#### Web 端發布介面

```
POST /api/v1/skills/{namespace}/publish
Content-Type: multipart/form-data
Parts:
  - file: zip 包（必需）
  - visibility: PUBLIC / NAMESPACE_ONLY / PRIVATE（可選，預設 PUBLIC）

Response: 同 CLI 發布介面
```

Web 端和 CLI 共用 `SkillPublishService`，Controller 層分開。

---

## 5. 技能查詢 + 下載 + 標籤管理

### 5.1 技能查詢服務（`domain.skill.service.SkillQueryService`）

```
getSkillDetail(namespaceSlug, skillSlug, currentUser) → SkillDetailDTO
  - 查詢 skill + latest_version 資訊
  - 可見性檢查
  - 返回：skill 基本資訊 + latest version 後設資料 + 統計資料

listSkillsByNamespace(namespaceSlug, status, page, size, currentUser) → Page<SkillSummaryDTO>
  - 可見性過濾
  - 預設只返回 ACTIVE 狀態

getVersionDetail(namespaceSlug, skillSlug, version) → SkillVersionDetailDTO
  - 返回：版本後設資料 + parsed_metadata_json + manifest_json

listVersions(namespaceSlug, skillSlug, page, size) → Page<SkillVersionSummaryDTO>
  - 只返回 PUBLISHED 版本（Phase 2）

listFiles(namespaceSlug, skillSlug, version) → List<SkillFileDTO>
  - 返回檔案清單（路徑、大小、contentType、sha256）

getFileContent(namespaceSlug, skillSlug, version, filePath) → FileContentDTO
  - 從物件儲存讀取檔案內容
  - 文字檔案返回內容字串，二進位制檔案返回 base64 或下載連結
```

### 5.2 可見性檢查器（`domain.skill.visibility.VisibilityChecker`）

```java
public class VisibilityChecker {
    /**
     * 檢查當前使用者是否有權訪問指定 skill
     * @param skill 目標技能
     * @param currentUser 當前使用者（null 表示匿名）
     * @param userNamespaceRoles 使用者在各 namespace 的角色（預載入）
     */
    public boolean canAccess(Skill skill, String currentUserId,
                             Map<Long, NamespaceRole> userNamespaceRoles) {
        return switch (skill.getVisibility()) {
            case PUBLIC -> true;
            case NAMESPACE_ONLY -> userNamespaceRoles.containsKey(skill.getNamespaceId());
            case PRIVATE -> skill.getOwnerId().equals(currentUserId)
                || isAdminOrAbove(userNamespaceRoles.get(skill.getNamespaceId()));
        };
    }
}
```

查詢服務和搜尋服務共用此檢查器。

### 5.3 下載服務（`domain.skill.service.SkillDownloadService`）

```
downloadLatest(namespaceSlug, skillSlug, currentUser) → DownloadResult
  - 可見性檢查
  - 讀取 skill.latest_version_id 對應的 bundle.zip
  - 發布 SkillDownloadedEvent（非同步更新下載計數）

downloadVersion(namespaceSlug, skillSlug, version, currentUser) → DownloadResult
  - 可見性檢查
  - 讀取指定版本的 bundle.zip

downloadByTag(namespaceSlug, skillSlug, tagName, currentUser) → DownloadResult
  - 解析 tag → version_id
  - 委託給 downloadVersion
```

```java
public record DownloadResult(
    InputStream content,
    String filename,       // {slug}-{version}.zip
    long contentLength,
    String contentType     // application/zip
) {}
```

### 5.4 標籤管理服務（`domain.skill.service.SkillTagService`）

```
listTags(namespaceSlug, skillSlug) → List<SkillTagDTO>
  - 返回所有自定義標籤 + 虛擬 latest 標籤（指向 skill.latest_version_id）

createOrMoveTag(namespaceSlug, skillSlug, tagName, targetVersion, operatorId) → SkillTag
  - tagName 不可為 "latest"（系統保留）
  - targetVersion 必須是 PUBLISHED 狀態
  - 標籤已存在則移動（更新 version_id），不存在則建立
  - 許可權：skill owner 或 namespace ADMIN+

deleteTag(namespaceSlug, skillSlug, tagName, operatorId)
  - tagName 不可為 "latest"
  - 許可權：skill owner 或 namespace ADMIN+
```

### 5.5 Controller 層

#### Public API（`controller.portal.SkillController`）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/skills/{namespace}/{slug}` | 技能詳情 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions` | 版本列表 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}` | 版本詳情 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/files` | 檔案清單 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/file?path=...` | 讀取單個檔案 |
| GET | `/api/v1/skills/{namespace}/{slug}/download` | 下載最新版本 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/download` | 下載指定版本 |
| GET | `/api/v1/skills/{namespace}/{slug}/tags` | 標籤列表 |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/download` | 按標籤下載 |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/files` | 按標籤檢視檔案 |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/file?path=...` | 按標籤讀取檔案 |
| GET | `/api/v1/skills/{namespace}/{slug}/resolve` | 解析版本（query: version/tag/hash） |

#### Authenticated API（`controller.portal.SkillManageController`）

| 方法 | 路徑 | 許可權 |
|------|------|------|
| PUT | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}` | owner / ADMIN+ |
| DELETE | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}` | owner / ADMIN+ |
| GET | `/api/v1/me/skills` | 已登入 |

---

## 6. 搜尋實現（PostgreSQL Full-Text）

### 6.1 SPI 實現（`skillhub-search`）

#### PostgresFullTextIndexService

```java
@Service
@ConditionalOnProperty(name = "skillhub.search.provider", havingValue = "postgres", matchIfMissing = true)
public class PostgresFullTextIndexService implements SearchIndexService {

    // upsert by skill_id
    // INSERT INTO skill_search_document (...) VALUES (...)
    // ON CONFLICT (skill_id) DO UPDATE SET title=..., summary=..., ...
    void index(SkillSearchDocument doc);

    // 批次 upsert，使用 batch insert
    void batchIndex(List<SkillSearchDocument> docs);

    // DELETE FROM skill_search_document WHERE skill_id = ?
    void remove(Long skillId);
}
```

#### PostgresFullTextQueryService

```java
@Service
@ConditionalOnProperty(name = "skillhub.search.provider", havingValue = "postgres", matchIfMissing = true)
public class PostgresFullTextQueryService implements SearchQueryService {

    SearchResult search(SearchQuery query) {
        // 1. 構建 tsquery
        //    - 關鍵詞按空格分詞，每個詞用 & 連線
        //    - 使用 plainto_tsquery('simple', ?) 簡化處理
        //
        // 2. 構建 WHERE 條件
        //    - search_vector @@ tsquery（關鍵詞匹配）
        //    - status = 'ACTIVE'（只搜尋活躍技能）
        //    - 可見性條件（由 SearchVisibilityScope 轉換）：
        //      WHERE (visibility = 'PUBLIC')
        //         OR (visibility = 'NAMESPACE_ONLY' AND namespace_id IN (:memberNsIds))
        //         OR (visibility = 'PRIVATE' AND (namespace_id IN (:adminNsIds) OR owner_id = :userId))
        //    - 可選 namespace_id 過濾
        //
        // 3. 排序
        //    - RELEVANCE: ts_rank_cd(search_vector, tsquery) DESC
        //    - DOWNLOADS: download_count DESC
        //    - RATING: rating_avg DESC
        //    - NEWEST: updated_at DESC
        //
        // 4. 分頁
        //    - LIMIT :size OFFSET :page * :size
        //    - COUNT(*) 獲取總數
        //
        // 5. 空關鍵詞時退化為列表查詢（跳過 tsquery 條件）
    }
}
```

#### PostgresSearchRebuildService

```java
@Service
public class PostgresSearchRebuildService implements SearchRebuildService {

    void rebuildAll() {
        // 獲取 Redis 分散式鎖 search:rebuild:all（TTL 10min）
        // 分批載入所有 ACTIVE skill（batch 100）
        // 對每個 skill 取 latest_version_id 對應版本內容
        // 批次 upsert 搜尋檔案
    }

    void rebuildByNamespace(Long namespaceId) {
        // 鎖 key: search:rebuild:ns:{namespaceId}
    }

    void rebuildBySkill(Long skillId) {
        // 無需鎖，單條 upsert
    }
}
```

### 6.2 搜尋應用服務（`skillhub-app` 中的 `service.SkillSearchAppService`）

位於 `skillhub-app` 模組（非 domain），因為它依賴 `SearchQueryService`（定義在 skillhub-search），按依賴方向 domain 不應依賴 search：

```
searchSkills(keyword, namespaceSlug, sortBy, page, size, currentUser) → SearchResultDTO

內部流程：
1. 計算 SearchVisibilityScope（根據 currentUser 的 namespace 成員關係）
2. 構建 SearchQuery
3. 呼叫 SearchQueryService.search() → 返回匹配的 skillId 列表 + 總數
4. 批次查詢 skill 表獲取統計欄位（downloadCount, starCount, ratingAvg, ratingCount, latestVersion）
5. 組裝為 DTO 返回
```

> **搜尋統計欄位策略** — 搜尋檔案表只負責全文匹配和可見性過濾，不冗餘統計欄位。排序和統計資料透過 JOIN `skill` 表獲取。具體實現：搜尋查詢使用子查詢先匹配 + 過濾，外層 JOIN skill 表做排序和欄位補充。這避免了計數器更新時同步重新整理搜尋檔案的複雜度。`latestVersion` 透過 JOIN `skill_version` 表（`skill.latest_version_id`）獲取。

### 6.3 搜尋檔案更新時機

| 觸發場景 | 事件 | 處理 |
|---------|------|------|
| 技能發布 | `SkillPublishedEvent` | 用最新版本內容 upsert 搜尋檔案 |
| 技能狀態變更 | `SkillStatusChangedEvent` | 更新搜尋檔案 status |
| 技能歸檔 | `SkillStatusChangedEvent(ARCHIVED)` | 刪除搜尋檔案 |

### 6.4 搜尋 Controller

```
GET /api/v1/skills?q=keyword&namespace=slug&sort=relevance&page=0&size=20

q 引數為空時退化為列表查詢（按 sort 欄位排序，返回所有可見技能）。

首頁精選/熱門/最新列表複用搜尋介面：
- 精選：GET /api/v1/skills?sort=relevance&size=6（無 q 引數，按綜合排序）
- 熱門下載：GET /api/v1/skills?sort=downloads&size=6
- 最新發布：GET /api/v1/skills?sort=newest&size=6

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "namespace": "global",
        "slug": "code-review",
        "displayName": "Code Review",
        "summary": "...",
        "downloadCount": 1234,
        "starCount": 56,
        "ratingAvg": 4.5,
        "ratingCount": 10,
        "latestVersion": "1.2.0",
        "updatedAt": "2026-03-12T10:00:00Z"
      }
    ],
    "total": 42,
    "page": 0,
    "size": 20
  }
}
```

---

## 7. 非同步事件基礎設施

### 7.1 事件定義（`domain.event` 包）

```java
public record SkillPublishedEvent(Long skillId, Long versionId, String publisherId) {}
public record SkillDownloadedEvent(Long skillId, Long versionId) {}
public record SkillStatusChangedEvent(Long skillId, SkillStatus oldStatus, SkillStatus newStatus) {}
```

### 7.2 事件發布

業務服務透過 Spring `ApplicationEventPublisher` 發布：

```java
@Service
public class SkillPublishService {
    private final ApplicationEventPublisher eventPublisher;

    public SkillVersion publishSkill(...) {
        // ... 業務邏輯 ...
        eventPublisher.publishEvent(new SkillPublishedEvent(skill.getId(), version.getId(), publisherId));
        return version;
    }
}
```

### 7.3 事件監聽器

#### SearchIndexEventListener

```java
@Component
public class SearchIndexEventListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("skillhubEventExecutor")
    public void onSkillPublished(SkillPublishedEvent event) {
        // 載入 skill + latest version 內容
        // 構建 SkillSearchDocument
        // 呼叫 SearchIndexService.index()
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("skillhubEventExecutor")
    public void onSkillStatusChanged(SkillStatusChangedEvent event) {
        if (event.newStatus() == SkillStatus.ARCHIVED) {
            searchIndexService.remove(event.skillId());
        } else {
            // 更新搜尋檔案 status
            searchRebuildService.rebuildBySkill(event.skillId());
        }
    }
}
```

#### DownloadCountEventListener

```java
@Component
public class DownloadCountEventListener {

    @EventListener
    @Async("skillhubEventExecutor")
    public void onSkillDownloaded(SkillDownloadedEvent event) {
        // UPDATE skill SET download_count = download_count + 1 WHERE id = ?
        // 原子 SQL，無需樂觀鎖
        skillRepository.incrementDownloadCount(event.skillId());
    }
}
```

注意：`DownloadCountEventListener` 使用 `@EventListener` 而非 `@TransactionalEventListener`，因為下載操作本身不在事務中。

### 7.4 非同步執行緒池配置

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("skillhubEventExecutor")
    public TaskExecutor skillhubEventExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("event-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(25);  // 配合 30s shutdown timeout 優雅停機
        executor.initialize();
        return executor;
    }
}
```

- `CallerRunsPolicy`：佇列滿時由呼叫執行緒執行，保證事件不丟失
- 單體應用規模，core=2 max=4 足夠

---

## 8. 應用層精細限流

### 8.1 自定義註解

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    String category();
    int authenticated() default 60;
    int anonymous() default 20;
    int windowSeconds() default 60;
}
```

### 8.2 Redis 滑動視窗實現

使用 ZSET + Lua 指令碼實現原子操作：

```
Key: ratelimit:{category}:{userId 或 IP}
Score: 請求時間戳（毫秒）
```

Lua 指令碼流程：
1. `ZREMRANGEBYSCORE` 清理視窗外的過期記錄
2. `ZCARD` 獲取當前視窗內請求數
3. 如果未超限，`ZADD` 記錄當前請求 + 設定 key TTL
4. 返回剩餘配額

### 8.3 攔截器

```java
@Component
public class RateLimitInterceptor implements HandlerInterceptor {
    // 1. 從 HandlerMethod 獲取 @RateLimit 註解
    // 2. 判斷已登入/匿名，選擇對應限額
    // 3. 構建 Redis key（已登入用 userId，匿名用 IP）
    // 4. 執行 Lua 指令碼判定
    // 5. 超限：返回 429 + Retry-After header
    // 6. 未超限：放行 + 設定 X-RateLimit-Remaining header
}
```

### 8.4 限流配置

| 端點類別 | 已登入 | 匿名（按 IP） | 視窗 |
|---------|--------|-------------|------|
| search | 60 次 | 20 次 | 60s |
| download | 120 次 | 30 次 | 60s |
| publish | 10 次 | N/A | 3600s |
| auth | N/A | 30 次 | 60s |

### 8.5 容錯

Redis 不可用時 fail-open（放行請求），記錄 WARN 日誌。不因限流元件故障阻塞業務。

---

## 9. 前端 Chunk 2

### 9.1 路由結構

```
/                                      → 首頁
/search                                → 搜尋頁
/@{namespace}                          → 名稱空間主頁
/@{namespace}/{slug}                   → 技能詳情頁
/@{namespace}/{slug}/versions          → 版本歷史頁
/dashboard/skills                      → 我的技能
/dashboard/publish                     → 發布技能
/dashboard/namespaces                  → 我的名稱空間
/dashboard/namespaces/{slug}/members   → 成員管理
```

門戶區（`/`, `/search`, `/@*`）匿名可訪問。
Dashboard 區需登入（複用 Phase 1 路由守衛）。

### 9.2 新增依賴

| 包 | 用途 |
|----|------|
| `react-markdown` | SKILL.md Markdown 渲染 |
| `rehype-highlight` | 程式碼塊語法高亮 |
| `react-dropzone` | 拖拽上傳 |
| `zustand` | 客戶端狀態（UI 偏好、過濾器） |

### 9.3 共享元件（`shared/`）

| 元件 | 說明 |
|------|------|
| `SkillCard` | 技能卡片：名稱、摘要、namespace 標籤、下載量、版本號 |
| `SearchBar` | 搜尋輸入框，debounce 300ms |
| `MarkdownRenderer` | react-markdown + rehype-highlight 渲染 SKILL.md |
| `FileTree` | 檔案樹元件，展示技能包目錄結構 |
| `CopyButton` | 一鍵複製安裝命令 |
| `Pagination` | 分頁元件 |
| `EmptyState` | 空狀態佔點陣圖 |
| `SkeletonLoader` | 骨架屏載入態 |
| `NamespaceBadge` | 名稱空間標籤（@global 綠色，@team 藍色） |

### 9.4 頁面設計

#### 首頁（`/`）

- Hero 區域：居中大標題 + 副標題 + 搜尋框
- 三欄卡片區：精選 / 熱門下載 / 最新發布（各 top 6）
- 底部：名稱空間快速入口卡片
- 現代產品風：大留白、漸變背景、卡片懸浮陰影

#### 搜尋頁（`/search`）

- 頂部搜尋欄 + 過濾器行（名稱空間下拉、排序選擇器）
- 網格佈局 SkillCard 列表（響應式 1-3 列）
- URL query params 驅動：`?q=xxx&namespace=xxx&sort=relevance&page=1`
- 空結果狀態 + 搜尋建議
- TanStack Query `keepPreviousData: true` 避免翻頁閃爍

#### 名稱空間主頁（`/@{namespace}`）

- 頂部：namespace 頭像 + 名稱 + 描述 + 成員數
- 技能列表：該空間下的技能卡片網格
- 分頁 + 排序

#### 技能詳情頁（`/@{namespace}/{slug}`）

- 左側主區域（70%）：
  - Tab 切換：README / 檔案列表 / 版本歷史
  - README tab：MarkdownRenderer 渲染 SKILL.md 正文
  - 檔案列表 tab：FileTree + 檔案內容預覽
  - 版本歷史 tab：版本列表 + changelog
- 右側資訊欄（30%）：
  - 版本號 + 發布時間
  - 下載量統計
  - 名稱空間標籤（NamespaceBadge）
  - 標籤列表（latest + 自定義標籤）
  - 安裝命令（雙格式：skillhub CLI + ClawHub CLI）+ CopyButton
  - 下載按鈕
- 匿名使用者可瀏覽和下載 PUBLIC 技能

#### 版本歷史頁（`/@{namespace}/{slug}/versions`）

- 版本列表：版本號、發布時間、檔案數、總大小
- 每個版本可展開檢視 changelog
- 下載指定版本按鈕

#### 發布頁（`/dashboard/publish`）

- Step 1：選擇名稱空間（下拉，使用者所屬的 namespace 列表）
- Step 2：拖拽上傳區域（react-dropzone）+ 進度條
- Step 3：上傳後預覽
  - SKILL.md Markdown 渲染
  - 檔案樹
  - 後設資料摘要（name、version、description）
- Step 4：選擇可見性（PUBLIC / NAMESPACE_ONLY / PRIVATE）
- Step 5：確認發布按鈕
- 發布成功後跳轉到技能詳情頁

#### 我的技能（`/dashboard/skills`）

- 表格列表：技能名、名稱空間、最新版本、狀態、下載量、發布時間
- 點選跳轉到技能詳情頁
- 空狀態引導發布

#### 我的名稱空間（`/dashboard/namespaces`）

- 卡片列表：namespace 名稱、角色、成員數、技能數
- 建立名稱空間按鈕 + 對話方塊表單
- 點選進入成員管理

#### 成員管理（`/dashboard/namespaces/{slug}/members`）

- 成員表格：使用者名稱、角色、加入時間
- 新增成員按鈕 + 對話方塊（使用者搜尋 + 角色選擇）
- 角色變更下拉
- 移除成員按鈕（帶確認）
- OWNER 轉讓操作（獨立按鈕，二次確認）

### 9.5 資料獲取模式（TanStack Query）

每個 API 端點封裝為自定義 hook：

| Hook | Query Key | 說明 |
|------|-----------|------|
| `useSkillDetail(ns, slug)` | `['skills', ns, slug]` | 技能詳情 |
| `useSkillVersions(ns, slug)` | `['skills', ns, slug, 'versions']` | 版本列表 |
| `useSkillFiles(ns, slug, ver)` | `['skills', ns, slug, 'versions', ver, 'files']` | 檔案清單 |
| `useSearchSkills(params)` | `['skills', 'search', params]` | 搜尋 |
| `useNamespaceDetail(slug)` | `['namespaces', slug]` | 名稱空間詳情 |
| `useNamespaceSkills(slug)` | `['namespaces', slug, 'skills']` | 空間技能列表 |
| `useNamespaceMembers(slug)` | `['namespaces', slug, 'members']` | 成員列表 |
| `useMySkills()` | `['me', 'skills']` | 我的技能 |
| `useMyNamespaces()` | `['me', 'namespaces']` | 我的名稱空間 |
| `useFeaturedSkills()` | `['skills', 'featured']` | 首頁精選 |
| `usePopularSkills()` | `['skills', 'popular']` | 首頁熱門 |
| `useRecentSkills()` | `['skills', 'recent']` | 首頁最新 |

Mutation hooks：

| Hook | 成功後 invalidate |
|------|-------------------|
| `usePublishSkill()` | `['me', 'skills']`, `['namespaces', ns, 'skills']` |
| `useCreateNamespace()` | `['me', 'namespaces']`, `['namespaces']` |
| `useAddMember()` | `['namespaces', slug, 'members']` |
| `useRemoveMember()` | `['namespaces', slug, 'members']` |
| `useCreateTag()` | `['skills', ns, slug, 'tags']` |
| `useDeleteTag()` | `['skills', ns, slug, 'tags']` |

### 9.6 前端檔案結構（Phase 2 新增）

```
web/src/
├── pages/
│   ├── search.tsx
│   ├── namespace.tsx
│   ├── skill-detail.tsx
│   ├── skill-versions.tsx
│   ├── dashboard/
│   │   ├── skills.tsx
│   │   ├── publish.tsx
│   │   ├── namespaces.tsx
│   │   └── namespace-members.tsx
├── features/
│   ├── skill/
│   │   ├── skill-card.tsx
│   │   ├── skill-detail-view.tsx
│   │   ├── skill-version-list.tsx
│   │   ├── file-tree.tsx
│   │   ├── markdown-renderer.tsx
│   │   ├── install-command.tsx
│   │   ├── use-skill-detail.ts
│   │   ├── use-skill-versions.ts
│   │   ├── use-skill-files.ts
│   │   └── use-search-skills.ts
│   ├── publish/
│   │   ├── publish-form.tsx
│   │   ├── upload-zone.tsx
│   │   ├── publish-preview.tsx
│   │   └── use-publish-skill.ts
│   ├── namespace/
│   │   ├── namespace-card.tsx
│   │   ├── namespace-header.tsx
│   │   ├── member-table.tsx
│   │   ├── add-member-dialog.tsx
│   │   ├── create-namespace-dialog.tsx
│   │   ├── use-namespace-detail.ts
│   │   ├── use-namespace-members.ts
│   │   └── use-my-namespaces.ts
│   └── search/
│       ├── search-bar.tsx
│       ├── search-filters.tsx
│       ├── search-results.tsx
│       └── use-search.ts
├── shared/
│   ├── ui/                    # shadcn/ui 元件（已有）
│   ├── components/
│   │   ├── pagination.tsx
│   │   ├── empty-state.tsx
│   │   ├── skeleton-loader.tsx
│   │   ├── copy-button.tsx
│   │   └── namespace-badge.tsx
│   └── hooks/
│       └── use-debounce.ts
└── api/
    └── client.ts              # 已有，Phase 2 自動生成新型別
```

---

## 10. 測試策略

### 10.1 後端測試分層

| 層級 | 範圍 | 工具 | 覆蓋重點 |
|------|------|------|---------|
| 單元測試 | 領域服務、校驗器、解析器 | JUnit 5 + Mockito | SkillPackageValidator、SkillMetadataParser、VisibilityChecker、SlugValidator |
| 整合測試 | Repository + DB | @DataJpaTest + Testcontainers PostgreSQL | JPA 對映、唯一約束、全文搜尋查詢 |
| 整合測試 | 物件儲存 | @SpringBootTest + LocalFileStorage | 上傳/下載/刪除流程 |
| API 測試 | Controller | @WebMvcTest + MockMvc | 請求/響應格式、許可權校驗、引數校驗 |
| 端到端測試 | 發布全鏈路 | @SpringBootTest + Testcontainers | 上傳 → 校驗 → 儲存 → 持久化 → 搜尋 |

### 10.2 關鍵測試用例

#### SkillPackageValidator 測試

- 有效技能包 → 透過
- 缺少 SKILL.md → 失敗
- frontmatter 缺少 name → 失敗
- frontmatter 缺少 version → 失敗
- 非法檔案型別（.exe） → 失敗
- 單檔案超 1MB → 失敗
- 總包超 10MB → 失敗
- 檔案數超 100 → 失敗
- 版本號非 semver → 失敗
- 版本號與已有衝突 → 失敗

#### SkillMetadataParser 測試

- 標準 frontmatter + body → 正確解析
- 含 x-astron- 擴充套件欄位 → 保留在 frontmatter map
- 無 frontmatter → 失敗
- frontmatter 格式錯誤 → 失敗

#### VisibilityChecker 測試

- PUBLIC skill + 匿名使用者 → 可訪問
- NAMESPACE_ONLY skill + 非成員 → 不可訪問
- NAMESPACE_ONLY skill + 成員 → 可訪問
- PRIVATE skill + owner → 可訪問
- PRIVATE skill + namespace ADMIN → 可訪問
- PRIVATE skill + 其他使用者 → 不可訪問

#### 名稱空間管理測試

- 建立 namespace → 建立者成為 OWNER
- slug 保留詞 → 拒絕
- slug 含 -- → 拒絕
- 移除 OWNER → 拒絕
- 轉讓 ownership → 原 OWNER 降為 ADMIN

#### 搜尋測試

- 關鍵詞匹配 title → 返回結果
- 關鍵詞匹配 summary → 返回結果
- 匿名搜尋 → 只返回 PUBLIC
- namespace 過濾 → 只返回指定空間
- 排序：RELEVANCE / DOWNLOADS / NEWEST → 正確排序

#### 限流測試

- 未超限 → 放行 + 返回 X-RateLimit-Remaining
- 超限 → 429 + Retry-After
- Redis 不可用 → fail-open 放行

### 10.3 前端測試

| 型別 | 工具 | 覆蓋重點 |
|------|------|---------|
| 元件測試 | Vitest + React Testing Library | SkillCard、SearchBar、FileTree、MarkdownRenderer |
| Hook 測試 | renderHook | useSearchSkills、useSkillDetail、usePublishSkill |
| 頁面測試 | Vitest + MSW (Mock Service Worker) | 搜尋頁互動、發布流程、路由守衛 |

---

## 11. Chunk 劃分與驗收標準

### Chunk 1：後端全部

**範圍：** 資料庫遷移 + 物件儲存 + 名稱空間管理 + 技能發布/查詢/下載 + 標籤管理 + 搜尋 + 非同步事件 + 限流

**驗收標準：**

1. `V2__phase2_skill_tables.sql` 遷移成功，所有新表和索引建立
2. Phase 1 實體補齊：`Namespace.java` 補 type/avatarUrl，`NamespaceMember.java` 補 updatedAt，新增 `NamespaceType` 列舉
3. 物件儲存 LocalFile 實現可用，S3 實現可用（Docker Compose MinIO）
4. 名稱空間 CRUD + 成員管理 API 全部可用
5. CLI 發布介面：上傳 zip → 校驗 → 儲存 → PUBLISHED，返回版本資訊
6. 技能詳情、版本列表、檔案清單、檔案內容 API 可用
7. 下載 API：latest / 指定版本 / 按標籤，返回 zip
8. 標籤 CRUD API 可用，latest 標籤不可操作
9. 搜尋 API：關鍵詞搜尋 + 可見性過濾 + 排序 + 分頁
10. 非同步事件：發布後搜尋索引自動更新，下載後計數自動遞增
11. 限流：超限返回 429，Redis 不可用時 fail-open
12. 所有後端測試透過

### Chunk 2：前端全部

**範圍：** 首頁 + 搜尋頁 + 名稱空間主頁 + 技能詳情頁 + 版本歷史頁 + 發布頁 + 我的技能 + 我的名稱空間 + 成員管理

**前置：** Chunk 1 後端 API 全部就緒

**驗收標準：**

1. 首頁展示精選/熱門/最新技能，搜尋框可跳轉搜尋頁
2. 搜尋頁：關鍵詞搜尋 + 名稱空間過濾 + 排序 + 分頁，URL 驅動
3. 名稱空間主頁：展示空間資訊 + 技能列表
4. 技能詳情頁：Markdown 渲染 + 檔案樹 + 版本歷史 + 安裝命令 + 下載
5. 發布頁：拖拽上傳 + 預覽 + 選擇名稱空間/可見性 + 確認發布
6. 我的技能：列表展示 + 跳轉詳情
7. 名稱空間管理：建立 + 成員管理（新增/移除/角色變更/轉讓）
8. 匿名使用者可瀏覽/搜尋/下載 PUBLIC 技能
9. 現代產品風視覺設計（使用 frontend-design 技能最佳化）
10. 前端測試透過
