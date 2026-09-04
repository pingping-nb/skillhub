# Phase 3: 稽核流程 + CLI API + 評分收藏 + 相容層 設計檔案

> **Goal:** 在 Phase 2 名稱空間和技能核心鏈路基礎上，建立完整的治理體系、CLI 生態和社交功能。實現稽核流程、團隊技能提升、評分收藏、CLI API、ClawHub 相容層、冪等去重和管理後臺。

> **前置條件:** Phase 1 完成（工程骨架 + 認證授權）+ Phase 2 完成（名稱空間 + 技能核心鏈路）

> **重要修訂：身份主鍵約束**
> 使用者身份主鍵全鏈路統一使用 `string`。本文中出現的 `submitted_by`、`reviewed_by`、`user_id`、`owner_id`、`actor_user_id` 等使用者關聯欄位都應按字串設計，任何整型使用者主鍵描述都不再有效。

## 關鍵設計決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 稽核模式 | 嚴格稽核（所有版本都需稽核） | 企業內部平臺治理需求，確保技能質量 |
| 稽核許可權 | 嚴格分級（團隊自治，平臺不越權） | 保持團隊自治性，平臺管理員只管全域性空間和提升稽核 |
| 稽核併發控制 | 樂觀鎖（version 欄位） + partial unique index | 防止多 Pod 併發稽核同一任務 |
| CLI 認證 | OAuth Device Flow（Web 授權） | 現代 CLI 標準做法，使用者體驗最佳 |
| 相容層範圍 | 核心操作（search、resolve、download、publish、whoami） | 平衡相容性和實現複雜度 |
| 評分收藏 | 僅登入使用者可用 | 確保資料可信度，避免刷分/刷收藏 |
| 冪等去重 | Redis SETNX + PostgreSQL idempotency_record | 雙層防護，Redis 快速去重，PostgreSQL 持久化兜底 |
| 實施策略 | 稽核優先 + 漸進式 CLI（5 個 Chunk） | 漸進式交付，風險可控 |

## Tech Stack（沿用 Phase 1/2 + 新增）

- 沿用：Spring Boot 3.x + JDK 21 + PostgreSQL 16 + Redis 7 + Spring Security + Spring Data JPA + Flyway
- 沿用前端：React 19 + TypeScript + Vite + TanStack Router + TanStack Query + shadcn/ui + Tailwind CSS
- 新增前端：react-rating-stars-component（評分元件）

---

## 1. 資料庫遷移（V3__phase3_review_social_tables.sql）

Phase 2 已有表：`user_account`, `identity_binding`, `api_token`, `role`, `permission`, `role_permission`, `user_role_binding`, `namespace`, `namespace_member`, `audit_log`, `skill`, `skill_version`, `skill_file`, `skill_tag`, `skill_search_document`

### 1.1 新增表

#### review_task（發布稽核任務）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_version_id | BIGINT NOT NULL FK → skill_version | 關聯的版本 |
| namespace_id | BIGINT NOT NULL FK → namespace | 所屬空間（決定誰能稽核） |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | PENDING / APPROVED / REJECTED |
| version | INT NOT NULL DEFAULT 1 | 樂觀鎖版本號 |
| submitted_by | VARCHAR(128) NOT NULL FK → user_account | 提交人 |
| reviewed_by | VARCHAR(128) FK → user_account | 稽核人 |
| review_comment | TEXT | 稽核意見 |
| submitted_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| reviewed_at | TIMESTAMP | |

索引：
- `(namespace_id, status)` — 稽核列表
- `(submitted_by, status)` — 我的提交
- `(skill_version_id) WHERE status = 'PENDING'` — partial unique index，防止重複提交

業務約束：
- 同一 `skill_version_id` 在 `status=PENDING` 時只能存在一條記錄
- 撤回時物理刪除 review_task 記錄，依賴 partial unique index 防併發

#### promotion_request（提升稽核任務）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| source_skill_id | BIGINT NOT NULL FK → skill | 來源團隊 skill |
| source_version_id | BIGINT NOT NULL FK → skill_version | 申請提升的版本 |
| target_namespace_id | BIGINT NOT NULL FK → namespace | 目標全域性 namespace |
| target_skill_id | BIGINT FK → skill | 審批透過後生成的全域性 skill ID |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | PENDING / APPROVED / REJECTED |
| version | INT NOT NULL DEFAULT 1 | 樂觀鎖版本號 |
| submitted_by | VARCHAR(128) NOT NULL FK → user_account | 提交人 |
| reviewed_by | VARCHAR(128) FK → user_account | 稽核人 |
| review_comment | TEXT | 稽核意見 |
| submitted_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| reviewed_at | TIMESTAMP | |

索引：
- `(source_skill_id)` — 按來源 skill 查詢
- `(status)` — 待稽核列表
- `(source_version_id) WHERE status = 'PENDING'` — partial unique index，防止重複提交

業務約束：
- 同一 `source_version_id` 在 `status=PENDING` 時只能存在一條記錄
- 審批透過後填充 `target_skill_id`

#### skill_star（技能收藏）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_id | BIGINT NOT NULL FK → skill | |
| user_id | VARCHAR(128) NOT NULL FK → user_account | |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `(skill_id, user_id)` UNIQUE — 唯一約束
- `(user_id)` — 我的收藏
- `(skill_id)` — 技能收藏數

#### skill_rating（技能評分）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| skill_id | BIGINT NOT NULL FK → skill | |
| user_id | VARCHAR(128) NOT NULL FK → user_account | |
| score | SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5) | 1-5 分 |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `(skill_id, user_id)` UNIQUE — 唯一約束，每人每技能一條
- `(skill_id)` — 評分聚合

#### idempotency_record（冪等記錄）

| 欄位 | 型別 | 說明 |
|------|------|------|
| request_id | VARCHAR(64) PK | 客戶端傳入的 UUID v4 |
| resource_type | VARCHAR(64) NOT NULL | 如 skill_version, api_token |
| resource_id | BIGINT | 業務操作產生的資源 ID |
| status | VARCHAR(32) NOT NULL | PROCESSING / COMPLETED / FAILED |
| response_status_code | INT | 原始響應狀態碼 |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| expires_at | TIMESTAMP NOT NULL | 過期時間（預設 24h） |

索引：
- `(expires_at)` — 過期清理
- `(status, created_at)` — 僵死任務檢測

### 1.2 Phase 2 表結構調整

Phase 2 設計中 `skill_version.status` 直接到 PUBLISHED，Phase 3 需要調整為稽核流程：

**skill_version 表無需修改** - status 列舉已包含 DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / YANKED

**Phase 2 → Phase 3 遷移策略：**
- Phase 2 發布流程：上傳 → DRAFT → 自動提交 → PENDING_REVIEW → 自動透過 → PUBLISHED
- Phase 3 發布流程：上傳 → DRAFT → 提交稽核 → PENDING_REVIEW → 人工稽核 → PUBLISHED/REJECTED

Phase 2 程式碼中的自動稽核邏輯在 Phase 3 移除，改為建立 review_task 等待人工稽核。

**Phase 2 已有資料的處理：**

1. **已發布的技能（status=PUBLISHED）**
   - 保持現狀，無需補充稽核
   - 視為已透過稽核的技能
   - 後續新版本發布需要經過稽核流程

2. **草稿狀態的技能（status=DRAFT）**
   - 保持 DRAFT 狀態
   - 使用者需要手動提交稽核才能發布

3. **待稽核狀態的技能（status=PENDING_REVIEW）**
   - Phase 2 中不應該存在此狀態（因為自動透過）
   - 如果存在，需要補充建立 review_task 記錄
   - 遷移指令碼：
     ```sql
     -- 為 Phase 2 遺留的 PENDING_REVIEW 版本建立稽核任務
     INSERT INTO review_task (skill_version_id, namespace_id, status, submitted_by, submitted_at)
     SELECT
       sv.id,
       s.namespace_id,
       'PENDING',
       sv.created_by,
       sv.created_at
     FROM skill_version sv
     JOIN skill s ON sv.skill_id = s.id
     WHERE sv.status = 'PENDING_REVIEW'
       AND NOT EXISTS (
         SELECT 1 FROM review_task rt WHERE rt.skill_version_id = sv.id
       );
     ```

4. **資料一致性檢查**
   - 檢查所有 PUBLISHED 版本是否有對應的 skill.latest_version_id
   - 檢查所有 PENDING_REVIEW 版本是否有對應的 review_task
   - 遷移指令碼在 Phase 3 部署前執行

---

## 2. 稽核流程設計

### 2.1 普通發布稽核流程

```
使用者發布技能（Phase 2 已實現）
    │
    ▼
① skill_version 建立（status=DRAFT）
    │
    ▼
② 使用者提交稽核（POST /api/v1/skills/{namespace}/{slug}/versions/{version}/submit）
    │
    ▼
③ 建立 review_task
   - skill_version.status → PENDING_REVIEW
   - INSERT INTO review_task (skill_version_id, namespace_id, status=PENDING, submitted_by)
   - 檢查 partial unique index 防止重複提交
    │
    ▼
④ 稽核人稽核（PUT /api/v1/review-tasks/{id}/approve 或 /reject）
   ├── 透過 →
   │   ① 樂觀鎖更新：UPDATE review_task SET status='APPROVED', reviewed_by=?, reviewed_at=?, version=version+1 WHERE id=? AND version=?
   │   ② skill_version.status → PUBLISHED
   │   ③ 更新 skill.latest_version_id（如果是最新版本）
   │   ④ 發布 SkillPublishedEvent（觸發搜尋索引更新）
   │   ⑤ 同步寫入 audit_log
   │
   └── 拒絕 →
       ① 樂觀鎖更新：UPDATE review_task SET status='REJECTED', reviewed_by=?, reviewed_at=?, review_comment=?, version=version+1 WHERE id=? AND version=?
       ② skill_version.status → REJECTED
       ③ 記錄 reject_reason
       ④ 同步寫入 audit_log
```

**撤回稽核：**
```
使用者撤回稽核（DELETE /api/v1/skills/{namespace}/{slug}/versions/{version}/review）
    │
    ▼
① 檢查 review_task.status = PENDING（只能撤回待稽核的）
    │
    ▼
② 物理刪除 review_task 記錄
    │
    ▼
③ skill_version.status → DRAFT
```

### 2.2 提升稽核流程

```
團隊空間技能（已發布，status=PUBLISHED）
    │
    ▼
① 技能 owner 或 namespace ADMIN 發起提升申請
   POST /api/v1/skills/{namespace}/{slug}/promote
   Body: { "targetNamespaceSlug": "global", "versionId": 123 }
    │
    ▼
② 建立 promotion_request
   - INSERT INTO promotion_request (source_skill_id, source_version_id, target_namespace_id, status=PENDING, submitted_by)
   - 檢查 partial unique index 防止重複提交
   - 檢查 source_version.status = PUBLISHED（只能提升已發布版本）
   - 檢查 target_namespace.type = GLOBAL（只能提升到全域性空間）
    │
    ▼
③ 平臺管理員稽核（PUT /api/v1/promotion-requests/{id}/approve 或 /reject）
   ├── 透過 →
   │   ① 樂觀鎖更新：UPDATE promotion_request SET status='APPROVED', reviewed_by=?, reviewed_at=?, version=version+1 WHERE id=? AND version=?
   │   ② 在全域性空間建立新 skill
   │      - namespace_id = target_namespace_id
   │      - slug = 原 skill.slug（如果衝突則拒絕）
   │      - source_skill_id = 原 skill.id
   │      - owner_id = 原 skill.owner_id
   │      - visibility = PUBLIC
   │   ③ 複製 source_version_id 對應版本的檔案和後設資料到新 skill
   │      - 建立新 skill_version（status=PUBLISHED）
   │      - 複製 skill_file 記錄（物件儲存檔案複用，只複製後設資料）
   │      - 更新新 skill.latest_version_id
   │   ④ 更新 promotion_request.target_skill_id = 新 skill.id
   │   ⑤ 發布 SkillPromotedEvent（觸發搜尋索引寫入新 skill）
   │   ⑥ 同步寫入 audit_log
   │
   └── 拒絕 →
       ① 樂觀鎖更新：UPDATE promotion_request SET status='REJECTED', reviewed_by=?, reviewed_at=?, review_comment=?, version=version+1 WHERE id=? AND version=?
       ② 同步寫入 audit_log
```

**提升後的版本管理：**
- 全域性空間的新 skill 由其 owner 獨立管理版本
- 原團隊 skill 可繼續獨立迭代
- 兩者版本不自動同步，如需同步由 owner 手動操作

### 2.3 稽核許可權判定

#### ReviewPermissionChecker（`domain.review.ReviewPermissionChecker`）

```java
public class ReviewPermissionChecker {

    /**
     * 檢查使用者是否有權稽核指定的 review_task
     */
    public boolean canReview(ReviewTask task, String userId,
                             Map<Long, NamespaceRole> userNamespaceRoles,
                             Set<String> platformRoles) {
        // 不能稽核自己提交的
        if (task.getSubmittedBy().equals(userId)) {
            return false;
        }

        // 全域性空間：只有平臺 SKILL_ADMIN 或 SUPER_ADMIN 可以稽核
        if (task.getNamespace().getType() == NamespaceType.GLOBAL) {
            return platformRoles.contains("SKILL_ADMIN")
                || platformRoles.contains("SUPER_ADMIN");
        }

        // 團隊空間：該 namespace 的 ADMIN 或 OWNER 可以稽核
        NamespaceRole role = userNamespaceRoles.get(task.getNamespaceId());
        return role == NamespaceRole.ADMIN || role == NamespaceRole.OWNER;
    }

    /**
     * 檢查使用者是否有權稽核提升請求
     */
    public boolean canReviewPromotion(PromotionRequest request, String userId,
                                      Set<String> platformRoles) {
        // 只有平臺 SKILL_ADMIN 或 SUPER_ADMIN 可以稽核提升請求
        return platformRoles.contains("SKILL_ADMIN")
            || platformRoles.contains("SUPER_ADMIN");
    }
}
```

#### 許可權矩陣

| 操作 | 團隊空間 | 全域性空間 | 提升請求 |
|------|---------|---------|---------|
| 提交稽核 | namespace MEMBER+ | 平臺 SKILL_ADMIN+ | namespace ADMIN+ |
| 稽核透過/拒絕 | namespace ADMIN+ | 平臺 SKILL_ADMIN+ | 平臺 SKILL_ADMIN+ |
| 撤回稽核 | 提交人本人 | 提交人本人 | 提交人本人 |

### 2.4 樂觀鎖併發控制

**問題：** 多個稽核人同時稽核同一任務，可能導致重複稽核或狀態不一致。

**解決方案：** 使用樂觀鎖（version 欄位）+ 資料庫 UPDATE 影響行數判定。

```java
@Service
public class ReviewService {

    @Transactional
    public void approveReview(Long reviewTaskId, String reviewerId, String comment) {
        // 1. 載入 review_task（帶 version）
        ReviewTask task = reviewTaskRepository.findById(reviewTaskId)
            .orElseThrow(() -> new NotFoundException("Review task not found"));

        // 2. 檢查狀態（只能稽核 PENDING 狀態）
        if (task.getStatus() != ReviewTaskStatus.PENDING) {
            throw new BusinessException("Review task is not pending");
        }

        // 3. 檢查許可權
        if (!reviewPermissionChecker.canReview(task, reviewerId, ...)) {
            throw new ForbiddenException("No permission to review");
        }

        // 4. 樂觀鎖更新
        int updated = reviewTaskRepository.updateStatusWithVersion(
            reviewTaskId,
            ReviewTaskStatus.APPROVED,
            reviewerId,
            comment,
            task.getVersion()  // WHERE version = ?
        );

        // 5. 檢查更新結果
        if (updated == 0) {
            throw new ConcurrentModificationException("Review task was modified by another user");
        }

        // 6. 更新 skill_version.status
        skillVersionRepository.updateStatus(task.getSkillVersionId(), SkillVersionStatus.PUBLISHED);

        // 7. 更新 skill.latest_version_id
        // ...

        // 8. 發布事件
        eventPublisher.publishEvent(new SkillPublishedEvent(...));

        // 9. 寫入審計日誌
        auditLogService.log(...);
    }
}
```

**Repository 實現：**

```java
@Repository
public interface ReviewTaskRepository extends JpaRepository<ReviewTask, Long> {

    @Modifying
    @Query("""
        UPDATE ReviewTask t
        SET t.status = :status,
            t.reviewedBy = :reviewerId,
            t.reviewComment = :comment,
            t.reviewedAt = CURRENT_TIMESTAMP,
            t.version = t.version + 1
        WHERE t.id = :id AND t.version = :expectedVersion
    """)
    int updateStatusWithVersion(
        @Param("id") Long id,
        @Param("status") ReviewTaskStatus status,
        @Param("reviewerId") String reviewerId,
        @Param("comment") String comment,
        @Param("expectedVersion") Integer expectedVersion
    );
}
```

**併發場景：**
- 稽核人 A 和 B 同時稽核任務 T（version=1）
- A 先提交：UPDATE ... WHERE id=T AND version=1 → 成功，version 變為 2
- B 後提交：UPDATE ... WHERE id=T AND version=1 → 失敗（version 已變為 2），返回 409 Conflict

---

## 3. 評分收藏設計

### 3.1 收藏功能

#### SkillStarService（`domain.skill.service.SkillStarService`）

```java
@Service
public class SkillStarService {

    /**
     * 收藏技能
     */
    @Transactional
    public void starSkill(Long skillId, String userId) {
        // 1. 檢查技能存在性和可見性
        Skill skill = skillRepository.findById(skillId)
            .orElseThrow(() -> new NotFoundException("Skill not found"));

        if (!visibilityChecker.canAccess(skill, userId, ...)) {
            throw new ForbiddenException("No permission to access this skill");
        }

        // 2. 插入 skill_star（唯一約束自動去重）
        try {
            SkillStar star = new SkillStar(skillId, userId);
            skillStarRepository.save(star);
        } catch (DataIntegrityViolationException e) {
            // 已收藏，冪等返回成功
            return;
        }

        // 3. 非同步更新計數器
        eventPublisher.publishEvent(new SkillStarredEvent(skillId, true));
    }

    /**
     * 取消收藏
     */
    @Transactional
    public void unstarSkill(Long skillId, String userId) {
        int deleted = skillStarRepository.deleteBySkillIdAndUserId(skillId, userId);

        if (deleted > 0) {
            // 非同步更新計數器
            eventPublisher.publishEvent(new SkillStarredEvent(skillId, false));
        }
    }

    /**
     * 檢查是否已收藏
     */
    public boolean isStarred(Long skillId, String userId) {
        return skillStarRepository.existsBySkillIdAndUserId(skillId, userId);
    }

    /**
     * 獲取使用者的收藏列表
     */
    public Page<Skill> getStarredSkills(String userId, Pageable pageable) {
        return skillStarRepository.findStarredSkillsByUserId(userId, pageable);
    }
}
```

#### 計數器更新（非同步事件）

```java
@Component
public class SkillStarEventListener {

    @EventListener
    @Async("skillhubEventExecutor")
    public void onSkillStarred(SkillStarredEvent event) {
        if (event.isStarred()) {
            // 原子遞增
            skillRepository.incrementStarCount(event.skillId());
        } else {
            // 原子遞減
            skillRepository.decrementStarCount(event.skillId());
        }
    }
}
```

**Repository 實現：**

```java
@Repository
public interface SkillRepository extends JpaRepository<Skill, Long> {

    @Modifying
    @Query("UPDATE Skill s SET s.starCount = s.starCount + 1 WHERE s.id = :id")
    void incrementStarCount(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Skill s SET s.starCount = s.starCount - 1 WHERE s.id = :id AND s.starCount > 0")
    void decrementStarCount(@Param("id") Long id);
}
```

### 3.2 評分功能

#### SkillRatingService（`domain.skill.service.SkillRatingService`）

```java
@Service
public class SkillRatingService {

    /**
     * 提交評分（新增或更新）
     */
    @Transactional
    public void rateSkill(Long skillId, String userId, int score) {
        // 1. 校驗評分範圍
        if (score < 1 || score > 5) {
            throw new IllegalArgumentException("Score must be between 1 and 5");
        }

        // 2. 檢查技能存在性和可見性
        Skill skill = skillRepository.findById(skillId)
            .orElseThrow(() -> new NotFoundException("Skill not found"));

        if (!visibilityChecker.canAccess(skill, userId, ...)) {
            throw new ForbiddenException("No permission to access this skill");
        }

        // 3. 插入或更新評分
        SkillRating rating = skillRatingRepository
            .findBySkillIdAndUserId(skillId, userId)
            .orElse(new SkillRating(skillId, userId));

        rating.setScore(score);
        rating.setUpdatedAt(Instant.now());
        skillRatingRepository.save(rating);

        // 4. 非同步重算平均分
        eventPublisher.publishEvent(new SkillRatedEvent(skillId));
    }

    /**
     * 獲取使用者對技能的評分
     */
    public Optional<Integer> getUserRating(Long skillId, String userId) {
        return skillRatingRepository.findBySkillIdAndUserId(skillId, userId)
            .map(SkillRating::getScore);
    }
}
```

#### 評分重算（非同步事件 + Redis 分散式鎖）

```java
@Component
public class SkillRatingEventListener {

    @EventListener
    @Async("skillhubEventExecutor")
    public void onSkillRated(SkillRatedEvent event) {
        String lockKey = "rating:recalc:" + event.skillId();

        // 獲取 Redis 分散式鎖（TTL 10s）
        boolean locked = redisTemplate.opsForValue()
            .setIfAbsent(lockKey, "1", Duration.ofSeconds(10));

        if (!locked) {
            // 已有其他執行緒在重算，跳過
            return;
        }

        try {
            // 重新計算平均分和評分人數
            RatingStats stats = skillRatingRepository.calculateStats(event.skillId());

            // 更新 skill 表
            skillRepository.updateRatingStats(
                event.skillId(),
                stats.avgScore(),
                stats.count()
            );
        } finally {
            // 釋放鎖
            redisTemplate.delete(lockKey);
        }
    }
}
```

**Repository 實現：**

```java
@Repository
public interface SkillRatingRepository extends JpaRepository<SkillRating, Long> {

    Optional<SkillRating> findBySkillIdAndUserId(Long skillId, String userId);

    @Query("""
        SELECT new com.iflytek.skillhub.domain.skill.RatingStats(
            COALESCE(AVG(r.score), 0.0),
            COUNT(r)
        )
        FROM SkillRating r
        WHERE r.skillId = :skillId
    """)
    RatingStats calculateStats(@Param("skillId") Long skillId);
}

public record RatingStats(Double avgScore, Long count) {}
```

**容錯機制：**
- 如果 Redis 不可用，跳過分散式鎖，直接重算（可能重複計算，但結果最終一致）
- 定時任務每天凌晨從 `skill_rating` 表重算所有技能的評分，修正非同步事件丟失導致的不一致

---

## 4. CLI API 設計

### 4.1 OAuth Device Flow 認證

**標準流程（RFC 8628）：**

```
CLI 使用者執行 skillhub login
    │
    ▼
① CLI 請求 device code
   POST /api/v1/cli/auth/device/code
   Response: {
     "device_code": "xxx",
     "user_code": "ABCD-1234",
     "verification_uri": "https://skills.example.com/device",
     "expires_in": 900,
     "interval": 5
   }
    │
    ▼
② CLI 顯示提示資訊
   "Please visit https://skills.example.com/device and enter code: ABCD-1234"
   CLI 自動開啟瀏覽器（可選）
    │
    ▼
③ 使用者在瀏覽器中訪問 verification_uri
   輸入 user_code
   登入（如果未登入）
   確認授權
    │
    ▼
④ CLI 輪詢 token 端點
   POST /api/v1/cli/auth/device/token
   Body: { "device_code": "xxx" }

   - 授權前：返回 { "error": "authorization_pending" }
   - 授權後：返回 { "access_token": "sk_xxx", "token_type": "Bearer", "expires_in": null }
    │
    ▼
⑤ CLI 儲存 token 到本地配置檔案
   ~/.skillhub/config.json: { "token": "sk_xxx" }
```

#### 後端實現

**DeviceAuthService（`skillhub-auth` 模組）**

```java
@Service
public class DeviceAuthService {

    /**
     * 生成 device code 和 user code
     */
    public DeviceCodeResponse generateDeviceCode() {
        String deviceCode = generateSecureToken(32);  // 長隨機字串
        String userCode = generateUserFriendlyCode();  // ABCD-1234 格式

        // 儲存到 Redis（TTL 15 分鐘）
        DeviceCodeData data = new DeviceCodeData(
            deviceCode,
            userCode,
            DeviceCodeStatus.PENDING,
            null  // userId，授權後填充
        );
        redisTemplate.opsForValue().set(
            "device:code:" + deviceCode,
            data,
            Duration.ofMinutes(15)
        );

        return new DeviceCodeResponse(
            deviceCode,
            userCode,
            "https://skills.example.com/device",
            900,  // expires_in
            5     // interval
        );
    }

    /**
     * 使用者授權 device code
     */
    public void authorizeDeviceCode(String userCode, String userId) {
        // 1. 透過 user_code 查詢 device_code
        String deviceCode = findDeviceCodeByUserCode(userCode);
        if (deviceCode == null) {
            throw new NotFoundException("Invalid user code");
        }

        // 2. 更新狀態為 AUTHORIZED，填充 userId
        DeviceCodeData data = getDeviceCodeData(deviceCode);
        data.setStatus(DeviceCodeStatus.AUTHORIZED);
        data.setUserId(userId);
        redisTemplate.opsForValue().set(
            "device:code:" + deviceCode,
            data,
            Duration.ofMinutes(15)
        );
    }

    /**
     * CLI 輪詢獲取 token
     */
    public DeviceTokenResponse pollToken(String deviceCode) {
        DeviceCodeData data = getDeviceCodeData(deviceCode);

        if (data == null) {
            throw new NotFoundException("Invalid or expired device code");
        }

        return switch (data.getStatus()) {
            case PENDING -> DeviceTokenResponse.pending();
            case AUTHORIZED -> {
                // 生成 API Token
                ApiToken token = apiTokenService.createToken(
                    data.getUserId(),
                    "CLI Device Auth",
                    null  // 永不過期
                );

                // 標記為已使用，防止重複獲取
                data.setStatus(DeviceCodeStatus.USED);
                redisTemplate.opsForValue().set(
                    "device:code:" + deviceCode,
                    data,
                    Duration.ofMinutes(1)  // 短 TTL，快速清理
                );

                yield DeviceTokenResponse.success(token.getTokenString());
            }
            case USED -> throw new BusinessException("Device code already used");
        };
    }

    private String generateUserFriendlyCode() {
        // 生成 ABCD-1234 格式的 8 字元碼
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // 去除易混淆字元
        Random random = new SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            if (i == 4) code.append('-');
            code.append(chars.charAt(random.nextInt(chars.length())));
        }
        return code.toString();
    }
}
```

**Controller 層**

```java
@RestController
@RequestMapping("/api/v1/cli/auth/device")
public class DeviceAuthController {

    @PostMapping("/code")
    public DeviceCodeResponse requestDeviceCode() {
        return deviceAuthService.generateDeviceCode();
    }

    @PostMapping("/token")
    public DeviceTokenResponse pollToken(@RequestBody DeviceTokenRequest request) {
        return deviceAuthService.pollToken(request.deviceCode());
    }
}

@RestController
@RequestMapping("/api/v1/device")
public class DeviceAuthWebController {

    @PostMapping("/authorize")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> authorizeDevice(
            @RequestBody AuthorizeDeviceRequest request,
            @AuthenticationPrincipal PlatformPrincipal principal) {
        deviceAuthService.authorizeDeviceCode(request.userCode(), principal.getUserId());
        return ResponseEntity.ok().build();
    }
}

public record AuthorizeDeviceRequest(String userCode) {}
```

**說明：**
- 前端是 React SPA，後端只提供 REST API 端點，不需要 Thymeleaf 模板
- `/device` 路由由前端 React Router 處理
- 後端只提供 `/api/v1/device/authorize` API 端點用於授權操作

### 4.2 CLI API 端點

#### whoami - 查詢當前使用者資訊

```
GET /api/v1/cli/whoami
Authorization: Bearer sk_xxx

Response 200:
{
  "code": 0,
  "data": {
    "userId": 123,
    "displayName": "張三",
    "email": "zhangsan@example.com",
    "namespaces": [
      {
        "slug": "global",
        "displayName": "Global",
        "role": null
      },
      {
        "slug": "team-ai",
        "displayName": "AI Team",
        "role": "ADMIN"
      }
    ]
  }
}
```

#### publish - 發布技能

```
POST /api/v1/cli/publish
Authorization: Bearer sk_xxx
Content-Type: multipart/form-data
X-Request-Id: uuid-v4（可選，用於冪等）

Parts:
  - file: zip 包（必需）
  - namespace: 目標名稱空間 slug（必需）
  - visibility: PUBLIC / NAMESPACE_ONLY / PRIVATE（可選，預設 PUBLIC）
  - auto_submit: boolean（可選，預設 true，自動提交稽核）

Response 200:
{
  "code": 0,
  "data": {
    "skillId": 456,
    "skillVersionId": 123,
    "namespace": "team-ai",
    "slug": "my-skill",
    "version": "1.2.0",
    "status": "PENDING_REVIEW",  // auto_submit=true 時
    "fileCount": 5,
    "totalSize": 12345
  }
}
```

**與 Phase 2 的差異：**
- Phase 2：上傳 → DRAFT → 自動 PUBLISHED
- Phase 3：上傳 → DRAFT → 提交稽核 → PENDING_REVIEW → 人工稽核 → PUBLISHED

#### resolve - 解析技能版本

```
GET /api/v1/cli/resolve?skill=@team-ai/my-skill&version=1.2.0
Authorization: Bearer sk_xxx（可選，匿名可訪問 PUBLIC 技能）

Query Parameters:
  - skill: 技能座標（@namespace/slug）
  - version: 版本號 / 標籤名 / "latest"（可選，預設 latest）

Response 200:
{
  "code": 0,
  "data": {
    "skillId": 456,
    "namespace": "team-ai",
    "slug": "my-skill",
    "displayName": "My Skill",
    "version": "1.2.0",
    "versionId": 123,
    "status": "PUBLISHED",
    "downloadUrl": "/api/v1/skills/team-ai/my-skill/versions/1.2.0/download",
    "fileCount": 5,
    "totalSize": 12345,
    "publishedAt": "2026-03-12T10:00:00Z"
  }
}
```

#### check - 檢查技能包有效性

```
POST /api/v1/cli/check
Authorization: Bearer sk_xxx
Content-Type: multipart/form-data

Parts:
  - file: zip 包（必需）

Response 200:
{
  "code": 0,
  "data": {
    "valid": true,
    "metadata": {
      "name": "my-skill",
      "version": "1.2.0",
      "description": "..."
    },
    "fileCount": 5,
    "totalSize": 12345,
    "errors": []
  }
}

Response 200（校驗失敗）:
{
  "code": 0,
  "data": {
    "valid": false,
    "errors": [
      "SKILL.md not found",
      "Invalid version format: 1.2"
    ]
  }
}
```

---

## 5. ClawHub 相容層設計

### 5.1 Canonical Slug 對映規則

根據 `00-product-direction.md` 1.1 節的凍結決策：

| skillhub 座標 | ClawHub canonical slug | 說明 |
|--------------|----------------------|------|
| `@global/my-skill` | `my-skill` | 全域性空間省略字首 |
| `@team-ai/my-skill` | `team-ai--my-skill` | 團隊空間使用雙連字元 |

**對映規則：**
- 分隔符為雙連字元 `--`
- skill slug 和 namespace slug 均禁止包含 `--`（在校驗規則中已強制）
- 相容層解析 canonical slug 時：
  - 包含 `--` → 拆分為 `namespace_slug` + `skill_slug`
  - 不包含 `--` → 視為 `@global/{slug}`

**CanonicalSlugMapper（`skillhub-app` 模組）**

```java
@Component
public class CanonicalSlugMapper {

    /**
     * skillhub 座標 → canonical slug
     */
    public String toCanonical(String namespaceSlug, String skillSlug) {
        if ("global".equals(namespaceSlug)) {
            return skillSlug;
        }
        return namespaceSlug + "--" + skillSlug;
    }

    /**
     * canonical slug → skillhub 座標
     */
    public SkillCoordinate fromCanonical(String canonicalSlug) {
        int separatorIndex = canonicalSlug.indexOf("--");

        if (separatorIndex == -1) {
            // 無 --，視為全域性空間
            return new SkillCoordinate("global", canonicalSlug);
        }

        // 有 --，拆分為 namespace + skill
        String namespaceSlug = canonicalSlug.substring(0, separatorIndex);
        String skillSlug = canonicalSlug.substring(separatorIndex + 2);
        return new SkillCoordinate(namespaceSlug, skillSlug);
    }
}

public record SkillCoordinate(String namespaceSlug, String skillSlug) {}
```

### 5.2 相容層端點

#### /.well-known/clawhub.json - 服務發現

```
GET /.well-known/clawhub.json

Response 200:
{
  "apiBase": "/api/v1"
}
```

#### search - 搜尋技能

```
GET /api/v1/search?q=keyword&page=0&size=20
Authorization: Bearer sk_xxx（可選）

Response 200:
{
  "items": [
    {
      "slug": "my-skill",  // canonical slug
      "name": "My Skill",
      "description": "...",
      "version": "1.2.0",
      "downloads": 1234,
      "stars": 56
    },
    {
      "slug": "team-ai--another-skill",
      "name": "Another Skill",
      "description": "...",
      "version": "2.0.0",
      "downloads": 567,
      "stars": 23
    }
  ],
  "total": 42,
  "page": 0,
  "size": 20
}
```

**實現：** 呼叫 skillhub 搜尋 API，將結果轉換為 canonical slug 格式。

#### resolve - 解析技能版本

```
GET /api/v1/resolve?slug=my-skill&version=1.2.0
Authorization: Bearer sk_xxx（可選）

Response 200:
{
  "slug": "my-skill",
  "name": "My Skill",
  "version": "1.2.0",
  "downloadUrl": "/api/v1/download/my-skill/1.2.0",
  "fileCount": 5,
  "totalSize": 12345
}
```

**實現：**
1. 解析 canonical slug → skillhub 座標
2. 呼叫 skillhub resolve API
3. 轉換響應格式

#### download - 下載技能包

```
GET /api/v1/download/{slug}/{version}
Authorization: Bearer sk_xxx（可選）

Response 200:
Content-Type: application/zip
Content-Disposition: attachment; filename="my-skill-1.2.0.zip"

<binary data>
```

**實現：**
1. 解析 canonical slug → skillhub 座標
2. 呼叫 skillhub download API
3. 透傳 zip 檔案

#### publish - 發布技能

```
POST /api/v1/publish
Authorization: Bearer sk_xxx
Content-Type: multipart/form-data

Parts:
  - file: zip 包（必需）
  - namespace: 目標名稱空間 slug（可選，預設 global）

Response 200:
{
  "slug": "my-skill",
  "version": "1.2.0",
  "status": "pending_review"
}
```

**實現：** 呼叫 skillhub publish API，轉換響應格式。

#### whoami - 查詢當前使用者

```
GET /api/v1/whoami
Authorization: Bearer sk_xxx

Response 200:
{
  "userId": 123,
  "username": "zhangsan",
  "email": "zhangsan@example.com"
}
```

**實現：** 呼叫 skillhub whoami API，轉換響應格式。

### 5.3 相容層 Controller 實現

```java
@RestController
@RequestMapping("/api/v1")
public class ClawHubCompatController {

    private final CanonicalSlugMapper slugMapper;
    private final SkillQueryService skillQueryService;
    private final SkillDownloadService skillDownloadService;
    private final SkillPublishService skillPublishService;
    private final SkillSearchAppService skillSearchAppService;

    @GetMapping("/search")
    public ClawHubSearchResponse search(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal PlatformPrincipal principal) {

        // 呼叫 skillhub 搜尋
        SearchResultDTO result = skillSearchAppService.searchSkills(
            q, null, "relevance", page, size, principal
        );

        // 轉換為 ClawHub 格式
        List<ClawHubSkillItem> items = result.items().stream()
            .map(item -> new ClawHubSkillItem(
                slugMapper.toCanonical(item.namespace(), item.slug()),
                item.displayName(),
                item.summary(),
                item.latestVersion(),
                item.downloadCount(),
                item.starCount()
            ))
            .toList();

        return new ClawHubSearchResponse(items, result.total(), page, size);
    }

    @GetMapping("/resolve")
    public ClawHubResolveResponse resolve(
            @RequestParam String slug,
            @RequestParam(defaultValue = "latest") String version,
            @AuthenticationPrincipal PlatformPrincipal principal) {

        // 解析 canonical slug
        SkillCoordinate coord = slugMapper.fromCanonical(slug);

        // 呼叫 skillhub resolve
        SkillVersionDetailDTO detail = skillQueryService.getVersionDetail(
            coord.namespaceSlug(),
            coord.skillSlug(),
            version,
            principal
        );

        // 轉換為 ClawHub 格式
        return new ClawHubResolveResponse(
            slug,
            detail.displayName(),
            detail.version(),
            "/api/v1/download/" + slug + "/" + detail.version(),
            detail.fileCount(),
            detail.totalSize()
        );
    }

    @GetMapping("/download/{slug}/{version}")
    public ResponseEntity<Resource> download(
            @PathVariable String slug,
            @PathVariable String version,
            @AuthenticationPrincipal PlatformPrincipal principal) {

        // 解析 canonical slug
        SkillCoordinate coord = slugMapper.fromCanonical(slug);

        // 呼叫 skillhub download
        DownloadResult result = skillDownloadService.downloadVersion(
            coord.namespaceSlug(),
            coord.skillSlug(),
            version,
            principal
        );

        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + result.filename() + "\"")
            .contentLength(result.contentLength())
            .body(new InputStreamResource(result.content()));
    }

    @PostMapping("/publish")
    public ClawHubPublishResponse publish(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "global") String namespace,
            @AuthenticationPrincipal PlatformPrincipal principal) {

        // 呼叫 skillhub publish
        SkillVersion version = skillPublishService.publishSkill(
            namespace,
            file.getInputStream(),
            principal.getUserId(),
            SkillVisibility.PUBLIC
        );

        // 轉換為 ClawHub 格式
        String canonicalSlug = slugMapper.toCanonical(namespace, version.getSkill().getSlug());
        return new ClawHubPublishResponse(
            canonicalSlug,
            version.getVersion(),
            version.getStatus().name().toLowerCase()
        );
    }

    @GetMapping("/whoami")
    public ClawHubWhoamiResponse whoami(@AuthenticationPrincipal PlatformPrincipal principal) {
        UserAccount user = userAccountRepository.findById(principal.getUserId())
            .orElseThrow();

        return new ClawHubWhoamiResponse(
            user.getId(),
            user.getDisplayName(),
            user.getEmail()
        );
    }
}
```

---

## 6. 冪等去重設計

### 6.1 雙層防護架構

**Redis 層（快速去重）：**
- Key: `idempotent:{requestId}`
- Value: "1"
- TTL: 24 小時
- 作用：快速攔截重複請求，避免資料庫查詢

**PostgreSQL 層（持久化兜底）：**
- 表：`idempotency_record`
- 作用：持久化冪等記錄，Redis 失效後仍能去重

### 6.2 冪等攔截器

```java
@Component
public class IdempotencyInterceptor implements HandlerInterceptor {

    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String IDEMPOTENCY_ATTR = "idempotency.requestId";

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {

        // 只攔截寫操作
        String method = request.getMethod();
        if (!("POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method))) {
            return true;
        }

        // 獲取 Request-Id
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            // 客戶端未傳 Request-Id，不做冪等處理
            return true;
        }

        // 校驗 UUID 格式
        if (!isValidUUID(requestId)) {
            response.setStatus(HttpStatus.BAD_REQUEST.value());
            response.getWriter().write("{\"error\":\"Invalid X-Request-Id format\"}");
            return false;
        }

        // 檢查 Redis 快速去重
        String redisKey = "idempotent:" + requestId;
        Boolean exists = redisTemplate.opsForValue().setIfAbsent(
            redisKey,
            "1",
            Duration.ofHours(24)
        );

        if (Boolean.FALSE.equals(exists)) {
            // Redis 中已存在，查詢 PostgreSQL 獲取原始結果
            IdempotencyRecord record = idempotencyRecordRepository
                .findById(requestId)
                .orElse(null);

            if (record == null) {
                // Redis 有但 PostgreSQL 無，可能是髒資料，刪除 Redis key 允許重試
                redisTemplate.delete(redisKey);
                return true;
            }

            return switch (record.getStatus()) {
                case COMPLETED -> {
                    // 返回原始結果
                    response.setStatus(record.getResponseStatusCode());
                    response.setContentType("application/json");
                    response.getWriter().write(buildIdempotentResponse(record));
                    yield false;  // 攔截請求
                }
                case PROCESSING -> {
                    // 正在處理中，返回 409 Conflict
                    response.setStatus(HttpStatus.CONFLICT.value());
                    response.getWriter().write("{\"error\":\"Request is being processed\"}");
                    yield false;
                }
                case FAILED -> {
                    // 失敗狀態，允許重試
                    redisTemplate.delete(redisKey);
                    yield true;
                }
            };
        }

        // Redis SETNX 成功，插入 PostgreSQL PROCESSING 記錄
        IdempotencyRecord record = new IdempotencyRecord(
            requestId,
            null,  // resourceType，業務層填充
            null,  // resourceId，業務層填充
            IdempotencyStatus.PROCESSING,
            null,
            Instant.now(),
            Instant.now().plus(24, ChronoUnit.HOURS)
        );
        idempotencyRecordRepository.save(record);

        // 將 requestId 存入 request attribute，供業務層使用
        request.setAttribute(IDEMPOTENCY_ATTR, requestId);

        return true;
    }

    private String buildIdempotentResponse(IdempotencyRecord record) {
        // 根據 resourceType 和 resourceId 構建響應
        return String.format(
            "{\"code\":0,\"data\":{\"resourceType\":\"%s\",\"resourceId\":%d}}",
            record.getResourceType(),
            record.getResourceId()
        );
    }
}
```

### 6.3 業務層使用

```java
@Service
public class SkillPublishService {

    @Transactional
    public SkillVersion publishSkill(..., HttpServletRequest request) {
        // 業務邏輯
        SkillVersion version = doPublish(...);

        // 更新冪等記錄為 COMPLETED
        String requestId = (String) request.getAttribute("idempotency.requestId");
        if (requestId != null) {
            idempotencyRecordRepository.updateToCompleted(
                requestId,
                "skill_version",
                version.getId(),
                200
            );
        }

        return version;
    }
}
```

### 6.4 定時清理任務

```java
@Component
public class IdempotencyCleanupTask {

    @Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨 2 點
    public void cleanupExpiredRecords() {
        int deleted = idempotencyRecordRepository.deleteExpired(Instant.now());
        log.info("Cleaned up {} expired idempotency records", deleted);
    }

    @Scheduled(fixedDelay = 300000)  // 每 5 分鐘
    public void cleanupStaleProcessing() {
        // 清理超過 5 分鐘仍在 PROCESSING 狀態的記錄（視為僵死）
        Instant staleThreshold = Instant.now().minus(5, ChronoUnit.MINUTES);
        int updated = idempotencyRecordRepository.markStaleAsFailed(staleThreshold);
        if (updated > 0) {
            log.warn("Marked {} stale PROCESSING records as FAILED", updated);
        }
    }
}
```

---

## 7. 前端設計

### 7.1 稽核中心

#### 路由結構

```
/dashboard/reviews                          → 我的稽核任務（我有權稽核的）
/dashboard/reviews/my-submissions           → 我的提交（我提交的稽核）
/dashboard/reviews/{id}                     → 稽核詳情頁
/dashboard/promotions                       → 提升稽核列表（僅平臺管理員）
/dashboard/promotions/{id}                  → 提升稽核詳情頁
```

#### 稽核任務列表頁（`/dashboard/reviews`）

**佈局：**
- Tab 切換：待稽核 / 已稽核 / 全部
- 篩選器：名稱空間下拉、提交人搜尋、提交時間範圍
- 表格列：技能名、版本號、提交人、提交時間、狀態、操作

**表格列定義：**

| 列 | 內容 |
|----|------|
| 技能名 | `@namespace/slug` + displayName |
| 版本號 | `1.2.0` |
| 提交人 | 使用者頭像 + 名稱 |
| 提交時間 | 相對時間（2 小時前） |
| 狀態 | Badge（PENDING 黃色 / APPROVED 綠色 / REJECTED 紅色） |
| 操作 | 檢視詳情按鈕 |

**許可權過濾：**
- 團隊管理員：只看到自己管理的 namespace 的稽核任務
- 平臺 SKILL_ADMIN：只看到全域性空間的稽核任務
- SUPER_ADMIN：看到所有稽核任務

#### 稽核詳情頁（`/dashboard/reviews/{id}`）

**佈局：**
- 左側主區域（70%）：
  - 技能資訊卡片：名稱、版本、提交人、提交時間
  - Tab 切換：README / 檔案列表 / 變更歷史
  - README tab：Markdown 渲染
  - 檔案列表 tab：檔案樹 + 檔案內容預覽
  - 變更歷史 tab：與上一版本的 diff（如果有）
- 右側操作欄（30%）：
  - 稽核狀態 Badge
  - 稽核意見輸入框（Textarea）
  - 透過按鈕（綠色，帶確認對話方塊）
  - 拒絕按鈕（紅色，必須填寫拒絕原因）
  - 稽核歷史（如果已稽核）

**透過確認對話方塊：**
```
標題：確認透過稽核
內容：確認透過技能 @team-ai/my-skill v1.2.0 的稽核？透過後技能將立即發布。
按鈕：取消 / 確認透過
```

**拒絕對話方塊：**
```
標題：拒絕稽核
內容：
  - 拒絕原因（必填，Textarea）
  - 提示：拒絕原因將傳送給提交人
按鈕：取消 / 確認拒絕
```

#### 我的提交列表頁（`/dashboard/reviews/my-submissions`）

**佈局：** 與稽核任務列表頁類似，但只顯示當前使用者提交的稽核。

**操作列：**
- PENDING 狀態：撤回按鈕
- APPROVED 狀態：檢視詳情
- REJECTED 狀態：檢視詳情 + 檢視拒絕原因

#### 提升稽核列表頁（`/dashboard/promotions`）

**僅平臺 SKILL_ADMIN 和 SUPER_ADMIN 可訪問。**

**佈局：**
- Tab 切換：待稽核 / 已稽核 / 全部
- 表格列：來源技能、目標空間、申請版本、提交人、提交時間、狀態、操作

**表格列定義：**

| 列 | 內容 |
|----|------|
| 來源技能 | `@team-ai/my-skill` |
| 目標空間 | `@global` |
| 申請版本 | `1.2.0` |
| 提交人 | 使用者頭像 + 名稱 |
| 提交時間 | 相對時間 |
| 狀態 | Badge |
| 操作 | 檢視詳情按鈕 |

#### 提升稽核詳情頁（`/dashboard/promotions/{id}`）

**佈局：** 與稽核詳情頁類似，但增加提升資訊：
- 來源技能：`@team-ai/my-skill`
- 目標空間：`@global`
- 提升後坐標：`@global/my-skill`
- 衝突檢查：如果目標空間已存在同名技能，顯示警告

### 7.2 評分收藏 UI

#### 技能詳情頁增強（Phase 2 已有，Phase 3 增強）

**右側資訊欄新增：**

```tsx
// 評分元件
<div className="rating-section">
  <div className="rating-display">
    <StarRating value={skill.ratingAvg} readonly />
    <span className="rating-text">
      {skill.ratingAvg.toFixed(1)} ({skill.ratingCount} 評分)
    </span>
  </div>

  {isAuthenticated ? (
    <div className="user-rating">
      <label>你的評分：</label>
      <StarRating
        value={userRating}
        onChange={handleRatingChange}
      />
    </div>
  ) : (
    <p className="login-prompt">
      <Link to="/login">登入</Link> 後可評分
    </p>
  )}
</div>

// 收藏按鈕
<Button
  variant={isStarred ? "default" : "outline"}
  onClick={handleStarToggle}
  disabled={!isAuthenticated}
>
  <Star className={isStarred ? "fill-current" : ""} />
  {isStarred ? "已收藏" : "收藏"}
  <span className="star-count">({skill.starCount})</span>
</Button>
```

**匿名使用者點選評分/收藏：**
- 彈出 Toast 提示："請先登入"
- 點選 Toast 跳轉到登入頁

#### 我的收藏頁（`/dashboard/favorites`）

**佈局：**
- 網格佈局 SkillCard 列表（與搜尋頁類似）
- 排序選項：收藏時間 / 下載量 / 評分
- 空狀態：引導使用者瀏覽技能並收藏

**SkillCard 增強：**
- 右上角顯示收藏時間（相對時間）
- 懸浮顯示取消收藏按鈕

### 7.3 Device Auth 頁面（CLI 授權）

#### 路由：`/device`

**許可權要求：** 需要登入（未登入使用者跳轉到登入頁）

**頁面佈局：**

```
┌─────────────────────────────────────────┐
│  skillhub Logo                          │
│                                         │
│  授權 CLI 裝置訪問                       │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  請輸入 CLI 顯示的授權碼：          │ │
│  │                                   │ │
│  │  ┌─────┐   ┌─────┐               │ │
│  │  │ABCD │ - │1234 │               │ │
│  │  └─────┘   └─────┘               │ │
│  │                                   │ │
│  │  [確認授權]                        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  提示：授權後，CLI 將獲得訪問你賬號的許可權  │
└─────────────────────────────────────────┘
```

**元件設計：**

1. **User Code 輸入表單**
   - 兩個輸入框，分別輸入 4 個字元
   - 自動格式化為大寫字母和數字
   - 自動聚焦到第一個輸入框
   - 輸入 4 個字元後自動跳轉到第二個輸入框
   - 支援貼上完整的 8 字元碼（自動拆分）
   - 實時校驗：只允許字母和數字

2. **確認授權按鈕**
   - 只有輸入完整 8 字元後才啟用
   - 點選後彈出確認對話方塊

3. **授權確認對話方塊**
   ```
   標題：確認授權 CLI 裝置
   內容：
     - 授權碼：ABCD-1234
     - 裝置資訊：skillhub CLI
     - 許可權：讀取和管理你的技能、名稱空間
     - 警告：請確認這是你正在使用的 CLI 裝置
   按鈕：取消 / 確認授權
   ```

4. **授權成功頁面**
   ```
   ┌─────────────────────────────────────────┐
   │  ✓ 授權成功                              │
   │                                         │
   │  你的 CLI 裝置已成功授權                  │
   │                                         │
   │  請返回 CLI 繼續操作                      │
   │                                         │
   │  [關閉視窗]                              │
   └─────────────────────────────────────────┘
   ```

5. **錯誤處理**

   | 錯誤型別 | 提示資訊 | 使用者操作 |
   |---------|---------|---------|
   | 無效授權碼 | "授權碼無效，請檢查後重試" | 重新輸入 |
   | 授權碼已過期 | "授權碼已過期（15 分鐘有效期），請返回 CLI 重新獲取" | 返回 CLI |
   | 授權碼已使用 | "授權碼已被使用，請返回 CLI 重新獲取" | 返回 CLI |
   | 網路錯誤 | "網路錯誤，請稍後重試" | 重試按鈕 |

**互動流程：**

```
使用者訪問 /device
    │
    ▼
檢查登入狀態
    │
    ├── 未登入 → 跳轉到登入頁（帶 returnUrl=/device）
    │
    └── 已登入 → 顯示授權頁面
            │
            ▼
        使用者輸入 user code
            │
            ▼
        點選"確認授權"
            │
            ▼
        彈出確認對話方塊
            │
            ▼
        使用者確認
            │
            ▼
        呼叫後端 API：POST /device/authorize
            │
            ├── 成功 → 顯示授權成功頁面
            │
            └── 失敗 → 顯示錯誤提示
```

**前端實現檔案：**
- `web/src/pages/device-auth.tsx` - 主頁面
- `web/src/features/device-auth/user-code-input.tsx` - User Code 輸入元件
- `web/src/features/device-auth/authorize-confirm-dialog.tsx` - 授權確認對話方塊
- `web/src/features/device-auth/authorize-success.tsx` - 授權成功頁面
- `web/src/features/device-auth/use-authorize-device.ts` - 授權 Hook

### 7.4 Token 管理頁

#### 路由：`/dashboard/tokens`

**佈局：**
- 頂部：建立 Token 按鈕
- 表格列：名稱、字首、建立時間、最後使用時間、過期時間、操作

**表格列定義：**

| 列 | 內容 |
|----|------|
| 名稱 | Token 名稱（如"CI/CD"、"本地開發"） |
| 字首 | `sk_abc...`（只顯示前 10 個字元） |
| 建立時間 | 相對時間 |
| 最後使用時間 | 相對時間 / "從未使用" |
| 過期時間 | 日期 / "永不過期" |
| 操作 | 吊銷按鈕（紅色，帶確認） |

**建立 Token 對話方塊：**

```
標題：建立 API Token
內容：
  - Token 名稱（必填，Text Input）
  - 過期時間（可選，Date Picker / "永不過期"）
  - 提示：Token 只會顯示一次，請妥善儲存
按鈕：取消 / 建立
```

**建立成功對話方塊：**

```
標題：Token 建立成功
內容：
  - Token 字串（Monospace 字型，帶複製按鈕）
  - 警告：此 Token 只會顯示一次，請立即複製儲存
按鈕：我已複製
```

**吊銷確認對話方塊：**

```
標題：吊銷 Token
內容：確認吊銷 Token "CI/CD"？吊銷後無法恢復，使用此 Token 的應用將無法訪問。
按鈕：取消 / 確認吊銷
```

### 7.5 管理後臺

#### 路由結構

```
/admin                                      → 管理後臺首頁（僅平臺管理員）
/admin/users                                → 使用者管理
/admin/users/{id}                           → 使用者詳情
/admin/roles                                → 角色管理
/admin/audit-logs                           → 審計日誌
```

**許可權要求：**
- `/admin/users`：USER_ADMIN 或 SUPER_ADMIN
- `/admin/roles`：SUPER_ADMIN
- `/admin/audit-logs`：AUDITOR 或 SUPER_ADMIN

#### 使用者管理頁（`/admin/users`）

**佈局：**
- 搜尋框：按使用者名稱/郵箱搜尋
- 篩選器：狀態（ACTIVE / PENDING / DISABLED / MERGED）
- 表格列：使用者名稱、郵箱、狀態、角色、建立時間、操作

**表格列定義：**

| 列 | 內容 |
|----|------|
| 使用者名稱 | 頭像 + displayName |
| 郵箱 | email |
| 狀態 | Badge（ACTIVE 綠色 / PENDING 黃色 / DISABLED 紅色） |
| 角色 | 平臺角色列表（Tag） |
| 建立時間 | 相對時間 |
| 操作 | 檢視詳情 / 編輯角色 / 封禁/解封 |

**操作按鈕：**
- **檢視詳情** - 跳轉到使用者詳情頁
- **編輯角色** - 彈出對話方塊，多選平臺角色（SKILL_ADMIN / USER_ADMIN / AUDITOR）
- **封禁/解封** - 切換使用者狀態（ACTIVE ↔ DISABLED），帶確認對話方塊

**編輯角色對話方塊：**

```
標題：編輯使用者角色
內容：
  - 使用者：張三 (zhangsan@example.com)
  - 角色（多選 Checkbox）：
    □ SKILL_ADMIN - 技能治理
    □ USER_ADMIN - 使用者治理
    □ AUDITOR - 審計只讀
  - 提示：SUPER_ADMIN 角色只能由超管分配
按鈕：取消 / 儲存
```

#### 使用者詳情頁（`/admin/users/{id}`）

**佈局：**
- 使用者資訊卡片：頭像、名稱、郵箱、狀態、建立時間
- Tab 切換：基本資訊 / 平臺角色 / 名稱空間成員 / 操作歷史

**基本資訊 Tab：**
- 顯示使用者的所有身份繫結（GitHub、GitLab 等）
- 顯示使用者的 API Token 列表（只顯示字首和建立時間）

**平臺角色 Tab：**
- 顯示使用者的平臺角色列表
- 新增/移除角色按鈕

**名稱空間成員 Tab：**
- 顯示使用者所屬的名稱空間及角色
- 表格列：名稱空間、角色、加入時間

**操作歷史 Tab：**
- 顯示使用者的審計日誌（最近 100 條）
- 表格列：操作、目標、時間、IP

#### 審計日誌頁（`/admin/audit-logs`）

**佈局：**
- 篩選器：
  - 操作型別下拉（發布、稽核、下載、刪除等）
  - 使用者搜尋
  - 時間範圍選擇器
  - 目標型別下拉（skill、namespace、user 等）
- 表格列：時間、操作人、操作、目標、IP、詳情

**表格列定義：**

| 列 | 內容 |
|----|------|
| 時間 | 精確時間（2026-03-12 10:30:45） |
| 操作人 | 使用者頭像 + 名稱 |
| 操作 | Badge（PUBLISH / APPROVE / REJECT / DELETE 等） |
| 目標 | 目標型別 + ID（如"skill #123"） |
| IP | 客戶端 IP |
| 詳情 | 展開按鈕，顯示 detail_json |

**詳情展開：**
- JSON 格式化顯示
- 語法高亮
- 可複製

### 7.6 前端檔案結構（Phase 3 新增）

```
web/src/
├── pages/
│   ├── device-auth.tsx                     # Device Auth 授權頁面
│   ├── dashboard/
│   │   ├── reviews.tsx                    # 稽核任務列表
│   │   ├── review-detail.tsx              # 稽核詳情
│   │   ├── my-submissions.tsx             # 我的提交
│   │   ├── promotions.tsx                 # 提升稽核列表
│   │   ├── promotion-detail.tsx           # 提升稽核詳情
│   │   ├── favorites.tsx                  # 我的收藏
│   │   └── tokens.tsx                     # Token 管理
│   └── admin/
│       ├── users.tsx                      # 使用者管理
│       ├── user-detail.tsx                # 使用者詳情
│       ├── roles.tsx                      # 角色管理
│       └── audit-logs.tsx                 # 審計日誌
├── features/
│   ├── device-auth/
│   │   ├── user-code-input.tsx            # User Code 輸入元件
│   │   ├── authorize-confirm-dialog.tsx   # 授權確認對話方塊
│   │   ├── authorize-success.tsx          # 授權成功頁面
│   │   └── use-authorize-device.ts        # 授權 Hook
│   ├── review/
│   │   ├── review-task-table.tsx
│   │   ├── review-detail-view.tsx
│   │   ├── review-action-panel.tsx
│   │   ├── approve-dialog.tsx
│   │   ├── reject-dialog.tsx
│   │   ├── use-review-tasks.ts
│   │   ├── use-approve-review.ts
│   │   └── use-reject-review.ts
│   ├── promotion/
│   │   ├── promotion-table.tsx
│   │   ├── promotion-detail-view.tsx
│   │   ├── use-promotions.ts
│   │   └── use-approve-promotion.ts
│   ├── rating/
│   │   ├── star-rating.tsx                # 評分元件
│   │   ├── rating-display.tsx             # 評分展示
│   │   ├── use-rate-skill.ts
│   │   └── use-user-rating.ts
│   ├── star/
│   │   ├── star-button.tsx                # 收藏按鈕
│   │   ├── use-star-skill.ts
│   │   └── use-starred-skills.ts
│   ├── token/
│   │   ├── token-table.tsx
│   │   ├── create-token-dialog.tsx
│   │   ├── token-created-dialog.tsx
│   │   ├── revoke-token-dialog.tsx
│   │   ├── use-tokens.ts
│   │   ├── use-create-token.ts
│   │   └── use-revoke-token.ts
│   └── admin/
│       ├── user-table.tsx
│       ├── user-detail-view.tsx
│       ├── edit-roles-dialog.tsx
│       ├── audit-log-table.tsx
│       ├── use-users.ts
│       ├── use-audit-logs.ts
│       └── use-update-user-roles.ts
└── shared/
    └── components/
        ├── confirm-dialog.tsx             # 通用確認對話方塊
        └── json-viewer.tsx                # JSON 檢視器
```

---

## 8. Chunk 劃分與驗收標準

### Chunk 1：稽核流程核心（後端）

**範圍：** 資料庫遷移 + 稽核流程 + 提升流程 + 樂觀鎖 + 分級許可權

**任務清單：**
1. 資料庫遷移 `V3__phase3_review_social_tables.sql`
   - 建立 review_task、promotion_request、skill_star、skill_rating、idempotency_record 表
   - 建立 partial unique index
2. 領域實體
   - ReviewTask、PromotionRequest、SkillStar、SkillRating、IdempotencyRecord
3. 稽核服務
   - ReviewService：提交稽核、稽核透過/拒絕、撤回稽核
   - PromotionService：提交提升、稽核提升
   - ReviewPermissionChecker：許可權判定
4. Repository 實現
   - ReviewTaskRepository：樂觀鎖更新方法
   - PromotionRequestRepository：樂觀鎖更新方法
5. Controller 層
   - ReviewController：稽核任務 CRUD、稽核操作
   - PromotionController：提升請求 CRUD、稽核操作
6. 單元測試 + 整合測試

**驗收標準：**
1. 使用者可以提交稽核，建立 review_task（status=PENDING）
2. 稽核人可以透過/拒絕稽核，樂觀鎖防止併發衝突
3. 稽核透過後，skill_version.status → PUBLISHED，觸發搜尋索引更新
4. 稽核拒絕後，skill_version.status → REJECTED，記錄拒絕原因
5. 使用者可以撤回 PENDING 狀態的稽核
6. 團隊管理員只能稽核自己管理的 namespace 的技能
7. 平臺 SKILL_ADMIN 只能稽核全域性空間的技能
8. 使用者可以提交提升請求，建立 promotion_request（status=PENDING）
9. 平臺 SKILL_ADMIN 可以稽核提升請求
10. 提升透過後，在全域性空間建立新 skill，複製版本和檔案
11. 所有稽核操作寫入 audit_log
12. 所有測試透過

### Chunk 2：評分收藏 + 前端稽核中心

**範圍：** 評分收藏後端 + 稽核中心前端 + Token 管理前端

**任務清單：**

**後端：**
1. 評分收藏服務
   - SkillStarService：收藏/取消收藏
   - SkillRatingService：提交評分
2. 非同步事件監聽器
   - SkillStarEventListener：更新 star_count
   - SkillRatingEventListener：重算 rating_avg
3. Controller 層
   - SkillStarController：收藏操作、我的收藏列表
   - SkillRatingController：評分操作、獲取使用者評分

**前端：**
1. 稽核中心頁面
   - 稽核任務列表頁
   - 稽核詳情頁
   - 我的提交列表頁
   - 提升稽核列表頁
   - 提升稽核詳情頁
2. 評分收藏元件
   - StarRating 元件
   - StarButton 元件
   - 技能詳情頁整合
   - 我的收藏頁
3. Token 管理頁
   - Token 列表
   - 建立 Token 對話方塊
   - 吊銷 Token 對話方塊

**驗收標準：**
1. 使用者可以收藏技能，skill.star_count 非同步更新
2. 使用者可以取消收藏，star_count 非同步遞減
3. 使用者可以對技能評分（1-5 分），skill.rating_avg 非同步重算
4. 使用者可以修改評分，rating_avg 重新計算
5. 匿名使用者點選評分/收藏，提示登入
6. 稽核中心：稽核人可以檢視待稽核任務列表
7. 稽核中心：稽核人可以檢視稽核詳情，透過/拒絕稽核
8. 稽核中心：使用者可以檢視自己的提交列表，撤回 PENDING 稽核
9. 提升稽核：平臺管理員可以檢視提升請求列表，稽核提升
10. Token 管理：使用者可以建立 Token，檢視 Token 列表，吊銷 Token
11. 前端測試透過

### Chunk 3：CLI API + Web 授權

**範圍：** OAuth Device Flow + CLI API 端點

**任務清單：**
1. OAuth Device Flow 實現
   - DeviceAuthService：生成 device code、授權、輪詢 token
   - DeviceAuthController：device code 端點、token 端點
   - DeviceAuthWebController：Web 授權頁面後端
2. CLI API 端點
   - whoami：查詢當前使用者資訊
   - publish：發布技能（複用 Phase 2 邏輯）
   - resolve：解析技能版本
   - check：檢查技能包有效性
3. 前端 Device Auth 頁面（`/device`）
   - 頁面元件：`web/src/pages/device-auth.tsx`
   - User Code 輸入表單（8 字元，自動格式化為 ABCD-1234）
   - 輸入校驗（格式校驗、存在性校驗）
   - 授權確認對話方塊（顯示 CLI 裝置資訊）
   - 授權成功頁面（提示使用者返回 CLI）
   - 錯誤處理（無效 code、過期 code、已使用 code）
   - 路由配置：`/device` 路由需要登入
4. CLI 工具整合測試（手動測試）

**驗收標準：**
1. CLI 執行 `skillhub login`，獲取 device code 和 user code
2. CLI 開啟瀏覽器，跳轉到授權頁面
3. 使用者輸入 user code，確認授權
4. CLI 輪詢獲取 token，儲存到本地配置檔案
5. CLI 執行 `skillhub whoami`，返回當前使用者資訊
6. CLI 執行 `skillhub publish`，上傳技能包，提交稽核
7. CLI 執行 `skillhub resolve @team-ai/my-skill`，返回版本資訊
8. CLI 執行 `skillhub check skill.zip`，返回校驗結果
9. 所有 CLI API 端點測試透過

### Chunk 4：ClawHub 相容層

**範圍：** canonical slug 對映 + 相容層端點

**任務清單：**
1. CanonicalSlugMapper 實現
2. Well-known 端點：`/.well-known/clawhub.json`
3. 相容層 Controller
   - search：搜尋技能
   - resolve：解析技能版本
   - download：下載技能包
   - publish：發布技能
   - whoami：查詢當前使用者
4. 協議適配測試（使用 ClawHub CLI 真實請求）

**驗收標準：**
1. ClawHub CLI 可以透過 `/.well-known/clawhub.json` 發現相容層 API
2. ClawHub CLI 可以搜尋技能，返回 canonical slug 格式
3. ClawHub CLI 可以解析技能版本（`my-skill` 和 `team-ai--my-skill`）
4. ClawHub CLI 可以下載技能包
5. ClawHub CLI 可以發布技能（需要 Token 認證）
6. ClawHub CLI 可以查詢當前使用者資訊
7. 所有相容層端點測試透過

### Chunk 5：冪等去重 + 管理後臺

**範圍：** 冪等攔截器 + 管理後臺前端

**任務清單：**

**後端：**
1. 冪等攔截器
   - IdempotencyInterceptor：Redis + PostgreSQL 雙層去重
   - IdempotencyCleanupTask：定時清理過期記錄
2. 管理後臺 API
   - UserManagementController：使用者管理、角色分配
   - AuditLogController：審計日誌查詢

**前端：**
1. 管理後臺頁面
   - 使用者管理頁
   - 使用者詳情頁
   - 審計日誌頁
2. 許可權守衛
   - 路由守衛：檢查平臺角色
   - 元件級許可權控制

**驗收標準：**
1. 寫操作帶 `X-Request-Id` 時，重複請求返回原始結果
2. Redis 不可用時，PostgreSQL 兜底去重
3. 定時任務清理過期冪等記錄
4. 管理後臺：USER_ADMIN 可以檢視使用者列表，編輯角色，封禁/解封使用者
5. 管理後臺：AUDITOR 可以檢視審計日誌，篩選和搜尋
6. 管理後臺：SUPER_ADMIN 可以訪問所有管理功能
7. 前端路由守衛：非管理員訪問 `/admin` 跳轉到 403 頁面
8. 所有測試透過

---

## 9. 測試策略

### 9.1 後端測試

| 層級 | 範圍 | 工具 | 覆蓋重點 |
|------|------|------|---------|
| 單元測試 | 領域服務、許可權檢查器 | JUnit 5 + Mockito | ReviewService、PromotionService、ReviewPermissionChecker、SkillStarService、SkillRatingService |
| 整合測試 | Repository + DB | @DataJpaTest + Testcontainers | 樂觀鎖更新、partial unique index、計數器原子操作 |
| 整合測試 | Redis 冪等去重 | @SpringBootTest + Testcontainers Redis | IdempotencyInterceptor、Redis SETNX |
| API 測試 | Controller | @WebMvcTest + MockMvc | 稽核操作、評分收藏、CLI API、相容層端點 |
| 端到端測試 | 稽核全鏈路 | @SpringBootTest + Testcontainers | 提交稽核 → 稽核透過 → 發布 → 搜尋索引更新 |

### 9.2 關鍵測試用例

#### 稽核流程測試

- 提交稽核 → review_task 建立，skill_version.status → PENDING_REVIEW
- 稽核透過 → skill_version.status → PUBLISHED，搜尋索引更新
- 稽核拒絕 → skill_version.status → REJECTED，記錄拒絕原因
- 撤回稽核 → review_task 刪除，skill_version.status → DRAFT
- 併發稽核 → 樂觀鎖衝突，第二個稽核人返回 409 Conflict
- 重複提交 → partial unique index 防止重複

#### 提升稽核測試

- 提交提升 → promotion_request 建立
- 提升透過 → 全域性空間建立新 skill，複製版本和檔案
- 提升拒絕 → 原技能不受影響
- slug 衝突 → 提升失敗，返回錯誤

#### 評分收藏測試

- 收藏技能 → skill_star 建立，star_count 非同步遞增
- 取消收藏 → skill_star 刪除，star_count 非同步遞減
- 重複收藏 → 冪等，不重複計數
- 提交評分 → skill_rating 建立/更新，rating_avg 非同步重算
- 修改評分 → rating_avg 重新計算

#### CLI API 測試

- Device Flow → 生成 device code → 授權 → 輪詢獲取 token
- whoami → 返回當前使用者資訊
- publish → 上傳技能包，提交稽核
- resolve → 解析技能版本
- check → 校驗技能包

#### 相容層測試

- canonical slug 對映 → `my-skill` ↔ `@global/my-skill`，`team-ai--my-skill` ↔ `@team-ai/my-skill`
- search → 返回 canonical slug 格式
- resolve → 解析 canonical slug
- download → 下載技能包
- publish → 發布技能

#### 冪等去重測試

- 帶 Request-Id 的重複請求 → 返回原始結果
- Redis 不可用 → PostgreSQL 兜底
- PROCESSING 狀態超時 → 標記為 FAILED

### 9.3 前端測試

| 型別 | 工具 | 覆蓋重點 |
|------|------|---------|
| 元件測試 | Vitest + React Testing Library | StarRating、StarButton、ReviewTaskTable、TokenTable |
| Hook 測試 | renderHook | useReviewTasks、useRateSkill、useStarSkill、useTokens |
| 頁面測試 | Vitest + MSW | 稽核中心互動、評分收藏互動、Token 管理互動 |

---

## 10. 風險與應對

| 風險 | 應對 |
|------|------|
| 稽核流程需求變更 | 狀態機設計靈活，支援擴充套件新狀態 |
| 樂觀鎖衝突頻繁 | 前端提示使用者重新整理重試，後端記錄衝突日誌監控 |
| 評分重算效能問題 | Redis 分散式鎖防止重複重算，定時任務兜底修正 |
| ClawHub CLI 協議細節不一致 | 相容層獨立 Controller，協議迴歸測試覆蓋 |
| Device Flow 使用者體驗問題 | 提供手動 Token 配置備選方案 |
| 冪等去重 Redis 不可用 | PostgreSQL 兜底，容錯設計 |

---

## 11. 總結

Phase 3 在 Phase 2 的基礎上，建立了完整的治理體系、CLI 生態和社交功能：

**核心價值：**
1. **稽核流程** - 所有技能發布必須經過稽核，建立分級稽核許可權體系，確保技能質量
2. **提升機制** - 團隊技能可以申請提升到全域性空間，經平臺管理員稽核，建立技能晉升通道
3. **評分收藏** - 使用者可以對技能評分和收藏，建立技能質量反饋機制
4. **CLI API** - 提供 skillhub CLI 所需的核心 API，支援 Web 授權流程，使用者體驗最佳
5. **ClawHub 相容層** - 實現 ClawHub CLI 協議相容，支援現有 ClawHub CLI 使用者無縫遷移
6. **冪等去重** - 基於 Redis + PostgreSQL 的雙層冪等機制，保證寫操作的冪等性
7. **管理後臺** - 使用者管理、角色分配、審計日誌查詢，建立完整的運營能力

**技術亮點：**
- 樂觀鎖 + partial unique index 防止併發衝突
- Redis + PostgreSQL 雙層冪等去重
- OAuth Device Flow 提供最佳 CLI 認證體驗
- Canonical slug 對映實現 ClawHub 相容
- 非同步事件 + 分散式鎖實現計數器更新
- 嚴格分級許可權體系保持團隊自治

**交付策略：**
- 5 個 Chunk 漸進式交付，每個 Chunk 都有明確的驗收標準
- 稽核流程優先，建立治理能力
- CLI API 和相容層後置，不阻塞核心功能
- 前後端並行開發，提高交付效率

Phase 3 完成後，skillhub 將具備完整的企業內部技能註冊中心能力，支援 Web 端和 CLI 端的完整工作流，相容 ClawHub CLI，建立完善的治理體系和社交功能。
