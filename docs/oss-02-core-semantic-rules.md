# OSS-02 Core 語義規則收口

## 1. 檔案目標

本檔案固化 SkillHub Core 的執行時語義規則，確保開源版與 SaaS 版對刪除、YANKED、同名衝突、package_name 等規則口徑一致，避免 AstronClaw 接入後出現狀態漂移。本文定義的是可由 SaaS 統一封裝並對 AstronClaw 提供的 `Core` 規則基線，不表示 AstronClaw 直接對接這些開源介面。

---

## 2. 變更概要

### 2.1 新增功能

| 功能 | 說明 |
|------|------|
| UPLOADED 狀態 | 新增版本狀態，表示"已上傳，未提交稽核" |
| PRIVATE skill 自動發布 | PRIVATE skill 發布後進入 UPLOADED 狀態，不自動進入稽核 |
| 提交稽核介面 | 新增 `POST /{namespace}/{slug}/submit-review`，允許 UPLOADED 狀態的版本提交稽核 |
| 撤回稽核後進入 UPLOADED | 撤回稽核後版本狀態變為 UPLOADED，而不是 DRAFT |

### 2.2 狀態機變更

**變更前**：
```
DRAFT → SCANNING → PENDING_REVIEW → PUBLISHED
                         ↓            ↓
                    REJECTED      YANKED
```

**變更後**：
```
DRAFT → SCANNING → UPLOADED → PENDING_REVIEW → PUBLISHED
         ↓              ↓           ↓            ↓
    SCAN_FAILED    (可刪除)     REJECTED      YANKED
         ↓                       ↓
      (可刪除)                (可刪除)
```

### 2.3 許可權模型變更

**核心原則**：許可權只和 status 相關，visibility 隻影響狀態流轉。

---

## 3. 版本狀態定義

### 3.1 狀態列舉

```java
public enum SkillVersionStatus {
    DRAFT,           // 草稿，編輯中
    SCANNING,        // 安全掃描中
    SCAN_FAILED,     // 掃描失敗
    UPLOADED,        // 已上傳，未提交稽核（新增）
    PENDING_REVIEW,  // 等待稽核
    PUBLISHED,       // 已發布
    REJECTED,        // 稽核拒絕
    YANKED           // 已撤回
}
```

### 3.2 狀態語義

| 狀態 | 含義 | 檔案狀態 | 可下載 | 可編輯 | 有檢測報告 |
|------|------|---------|-------|-------|----------|
| DRAFT | 草稿，編輯中 | 可能不完整 | 否 | 是 | 否 |
| SCANNING | 安全掃描中 | 完整 | 否 | 否 | 否 |
| SCAN_FAILED | 掃描失敗 | 完整 | 否 | 是 | 是（失敗） |
| UPLOADED | 已上傳，掃描透過 | 完整 | owner | 否 | 是 |
| PENDING_REVIEW | 稽核中 | 完整 | owner | 否 | 是 |
| PUBLISHED | 已發布 | 完整 | 看 visibility | 否 | 是 |
| REJECTED | 稽核拒絕 | 完整 | 否 | 是 | 是 |
| YANKED | 已撤回 | 完整 | 否 | 否 | 是 |

---

## 4. 發布流程設計

### 4.1 發布路徑

| visibility | 發布後初始狀態 | 是否建立稽核任務 |
|------------|--------------|----------------|
| PRIVATE | UPLOADED | 否 |
| NAMESPACE_ONLY | PENDING_REVIEW | 是 |
| PUBLIC | PENDING_REVIEW | 是 |

### 4.2 PRIVATE skill 完整生命週期

```
使用者發布 PRIVATE skill
    ↓
狀態：SCANNING（安全掃描中）
    ↓
掃描透過
    ↓
狀態：UPLOADED
visibility：PRIVATE
    ↓
owner 可下載/安裝/測試
市場不可見
管理員可見（用於審計）
已有檢測報告
    ↓
owner 測試滿意，確認發布（confirm-publish）
    ↓
狀態：PUBLISHED
visibility：PRIVATE（正式私有版本）
    ↓
owner 可下載/安裝
市場不可見
    ↓
使用者想公開，提交稽核
    ↓
狀態：PENDING_REVIEW
requestedVisibility：PUBLIC
    ↓
owner 仍可下載/測試
    ↓
稽核透過
    ↓
狀態：PUBLISHED
visibility：PUBLIC（不再是 PRIVATE）
    ↓
市場可見，所有人可下載
```

### 4.3 PUBLIC/NAMESPACE_ONLY skill 生命週期

```
使用者發布 PUBLIC/NAMESPACE_ONLY skill
    ↓
狀態：PENDING_REVIEW
    ↓
owner 可下載/測試
    ↓
稽核透過
    ↓
狀態：PUBLISHED
visibility：PUBLIC 或 NAMESPACE_ONLY
    ↓
市場可見（受 visibility 控制）
```

---

## 5. 許可權矩陣

### 5.1 status 決定下載許可權

| status | 市場可見 | 可下載 |
|--------|---------|-------|
| DRAFT | 否 | 否 |
| SCANNING | 否 | 否 |
| SCAN_FAILED | 否 | 否 |
| UPLOADED | 否 | owner |
| PENDING_REVIEW | 否 | owner |
| PUBLISHED | 看 visibility | 看 visibility |
| REJECTED | 否 | 否 |
| YANKED | 否 | 否 |

### 5.2 PUBLISHED 狀態下，visibility 決定可見性

| visibility | 市場可見 | 可下載 |
|------------|---------|-------|
| PUBLIC | 是 | 所有人 |
| NAMESPACE_ONLY | 名稱空間內 | 名稱空間成員 |
| PRIVATE | 否 | owner |

### 5.3 AstronClaw 安裝判斷規則

```
可安裝 = 
  skill.status == ACTIVE
  AND skill.hidden == false
  AND 存在至少一個可下載版本
  AND 該版本 bundleReady == true

可下載版本判斷：
  - UPLOADED/PENDING_REVIEW：僅 owner
  - PUBLISHED：按 visibility 規則
```

---

## 6. 狀態流轉詳細設計

### 6.1 狀態轉換表

| 當前狀態 | 操作 | 目標狀態 | 說明 |
|---------|------|---------|------|
| DRAFT | 上傳包 | SCANNING | 開始安全掃描 |
| SCANNING | 掃描透過 | UPLOADED 或 PENDING_REVIEW | 看 visibility |
| SCANNING | 掃描失敗 | SCAN_FAILED | - |
| SCAN_FAILED | 重新上傳 | SCANNING | - |
| UPLOADED | 提交稽核 | PENDING_REVIEW | 新增操作 |
| UPLOADED | 確認發布 | PUBLISHED | PRIVATE skill 正式發布，不觸發新掃描 |
| UPLOADED | 重新上傳 | SCANNING | 允許重新上傳 |
| UPLOADED | 刪除 | (刪除) | 允許刪除，未正式發布 |
| PENDING_REVIEW | 稽核透過 | PUBLISHED | - |
| PENDING_REVIEW | 稽核拒絕 | REJECTED | - |
| PENDING_REVIEW | 撤回稽核 | UPLOADED | 變更：原為 DRAFT |
| PUBLISHED | Yank | YANKED | - |
| REJECTED | 重新上傳 | SCANNING | - |

### 6.2 狀態機圖

```
                    ┌─────────────────────────────────────────┐
                    │              上傳包                      │
                    └─────────────────────────────────────────┘
                                      ↓
                              ┌───────────────┐
                              │   SCANNING    │
                              └───────────────┘
                               /            \
                     掃描透過  /              \ 掃描失敗
                             /                \
               ┌────────────────────────┐  ┌───────────────┐
               │ visibility=PRIVATE     │  │ SCAN_FAILED   │
               │ → UPLOADED             │  └───────────────┘
               │ visibility=PUBLIC/     │         │
               │   NAMESPACE_ONLY       │         │ 重新上傳
               │ → PENDING_REVIEW       │         ↓
               └────────────────────────┘  ┌───────────────┐
                             │             │   SCANNING    │
                             ↓             └───────────────┘
               ┌────────────────────────┐
               │       UPLOADED         │◄────────────────────────┐
               │  (PRIVATE skill 專屬)   │                         │
               │  已有檢測報告           │                         │
               └────────────────────────┘                         │
                    /           \                                 │
        確認發布   /             \ 提交稽核                        │
   (不觸發新掃描) /               \                               │
                /                 \                              │
               ↓                   ↓                             │
    ┌───────────────────┐  ┌───────────────────┐                 │
    │ PUBLISHED         │  │  PENDING_REVIEW   │                 │
    │ visibility=PRIVATE│  └───────────────────┘                 │
    └───────────────────┘           │                           │
              │                     │                           │
              │ 提交稽核             │ 稽核透過                   │
              ↓                     ↓                           │
    ┌───────────────────┐  ┌───────────────────┐                 │
    │  PENDING_REVIEW   │  │    PUBLISHED      │                 │
    └───────────────────┘  │ visibility=PUBLIC │                 │
              │            │ 或 NAMESPACE_ONLY │                 │
              │            └───────────────────┘                 │
              │ 撤回稽核              │                          │
              └──────────────────────┘                          │
                      (進入 UPLOADED)                            │
                                                                  │
    ┌───────────────────┐                                        │
    │     REJECTED      │────────────────────────────────────────┘
    └───────────────────┘              重新上傳
              │
              │ 刪除
              ↓
           (刪除)
```

---

## 7. 新增介面設計

說明：

以下介面屬於開源 `Core` 為 SaaS 提供的基礎狀態機能力。對 `AstronClaw` 而言，後續仍應統一透過 `SkillHub SaaS` 的 `AstronClaw Adapter` 消費這些能力，而不是直接繫結這些開源介面路徑。

### 7.1 提交稽核介面

**介面**：`POST /api/v1/skills/{namespace}/{slug}/submit-review`

**請求引數**：
```json
{
  "version": "1.0.0",
  "targetVisibility": "PUBLIC"
}
```

**前置條件**：
- 版本狀態為 UPLOADED
- 操作者為 skill owner 或 namespace ADMIN/OWNER

**執行效果**：
- 版本狀態 → PENDING_REVIEW
- `requestedVisibility` 設為目標可見性
- 建立稽核任務

**響應**：
```json
{
  "code": 0,
  "data": {
    "versionId": 100,
    "status": "PENDING_REVIEW",
    "requestedVisibility": "PUBLIC"
  }
}
```

### 7.2 確認發布介面（PRIVATE skill）

**介面**：`POST /api/v1/skills/{namespace}/{slug}/confirm-publish`

**請求引數**：
```json
{
  "version": "1.0.0"
}
```

**前置條件**：
- 版本狀態為 UPLOADED
- skill.visibility = PRIVATE
- 操作者為 skill owner

**執行效果**：
- 版本狀態 → PUBLISHED
- visibility 保持 PRIVATE
- **不觸發新的掃描**，複用 UPLOADED 時的掃描結果
- 未來可擴充套件：加入"發布掃描"功能

**響應**：
```json
{
  "code": 0,
  "data": {
    "skillId": 42,
    "versionId": 100,
    "status": "PUBLISHED",
    "visibility": "PRIVATE"
  }
}
```

---

## 8. 刪除 / 隱藏 / 歸檔 / YANKED 語義規則

### 8.1 操作語義總表

| 操作 | 觸發方式 | 可逆 | 市場可見 | 可新裝 | 已裝保留 | 可解除安裝 | slug 可複用 |
|------|---------|------|---------|-------|---------|-------|-----------|
| **硬刪除 skill** | owner 或 SUPER_ADMIN | 否 | 否 | 否 | 是 | 是 | 是 |
| **歸檔 skill** | owner / namespace admin | 是 | 否 | 否 | 是 | 是 | 否 |
| **隱藏 skill** | 管理員 | 是 | 否 | 否 | 是 | 是 | 否 |
| **Yank 版本** | owner / namespace admin | 否 | 否 | 否 | 是 | 是 | N/A |

### 8.2 Yank 版本

**定義**：YANK 是"撤回已發布版本"的操作，用於將一個已發布的版本從可用狀態移除。

**觸發條件**：
- owner 或 namespace ADMIN/OWNER 對 PUBLISHED 狀態的版本執行 yank

**執行效果**：
- `version.status` → `YANKED`（不可逆，無 un-yank 操作）
- `version.downloadReady` → `false`
- 記錄 `yankedAt`、`yankedBy`、`yankReason`
- 如果該版本是 `skill.latestVersionId` 指向的版本：
  - 自動回退到上一個 PUBLISHED 版本
  - 如果沒有其他 PUBLISHED 版本，`latestVersionId` → `null`

**對 AstronClaw 的影響**：
- 已安裝例項不受影響
- 無法新裝該版本
- 升級場景：目標版本被 yank → 升級失敗

對接原則：
- 上述語義應由 SaaS Adapter 原樣繼承並穩定對外提供
- AstronClaw 透過 Adapter 感知這些狀態，不直接繫結開源返回形態

**補救方式**：
- 不能 un-yank
- 只能發布新版本（rerelease 或重新上傳）

---

## 9. 同名衝突規則

### 9.1 唯一性約束

資料庫約束：`UNIQUE(namespace_id, slug, owner_id)`

含義：
- 同一 namespace 下，不同 owner 可以有相同 slug
- 同一 namespace 下，同一 owner 只能有一個相同 slug 的 skill

### 9.2 衝突規則設計原則

**核心原則**：只有 PUBLISHED 狀態才會阻塞同名發布，但區分 visibility。

| 對方狀態 | 我發布同名 PRIVATE | 我發布同名 PUBLIC | 說明 |
|---------|-------------------|------------------|------|
| UPLOADED | ✅ 允許 | ✅ 允許 | 多個 UPLOADED 可共存 |
| PENDING_REVIEW | ✅ 允許 | ✅ 允許 | 還未正式發布 |
| PRIVATE + PUBLISHED | ❌ 拒絕 | ❌ 拒絕 | 只允許一個正式私有版本 |
| PUBLIC + PUBLISHED | ❌ 拒絕 | ❌ 拒絕 | 市場已佔用 |

### 9.3 衝突規則表（詳細）

| 場景 | 是否允許 | 說明 |
|------|---------|------|
| 同 namespace，同 slug，同 owner | 允許（複用） | 新版本掛到已有 skill 下 |
| 同 namespace，同 slug，不同 owner，對方只有 UPLOADED | 允許 | 多個 UPLOADED 可共存測試 |
| 同 namespace，同 slug，不同 owner，對方只有 PENDING_REVIEW | 允許 | 還未正式發布 |
| 同 namespace，同 slug，不同 owner，對方有 PRIVATE + PUBLISHED | 拒絕 | 只允許一個正式私有版本 |
| 同 namespace，同 slug，不同 owner，對方有 PUBLIC/NAMESPACE_ONLY + PUBLISHED | 拒絕 | 市場已佔用 |
| 不同 namespace，同 slug | 允許 | namespace 隔離 |

### 9.4 完整流程示例

```
使用者 A 發布 PRIVATE `ns/my-skill`
    ↓
狀態：UPLOADED
    ↓
使用者 B 發布 PRIVATE `ns/my-skill`
    ↓
狀態：UPLOADED ✅ 允許（多個 UPLOADED 可共存）
    ↓
使用者 A 確認發布 → PRIVATE + PUBLISHED ✅ 允許
    ↓
使用者 B 確認發布 → ❌ 被拒絕
    ↓
錯誤資訊：error.skill.publish.nameConflict.private
    ↓
使用者 B 可以：
  1. 改名發布
  2. 等使用者 A 刪除/歸檔後再發布
  3. 提交稽核變成 PUBLIC（如果 A 是 PRIVATE）
```

### 9.5 程式碼改動

**檔案**：`SkillPublishService.java`

```java
// 衝突檢查邏輯（第 230-242 行）
for (Skill existing : existingSkills) {
    if (!existing.getOwnerId().equals(publisherId)) {
        // 檢查是否有 PUBLISHED 版本
        boolean hasPublished = !skillVersionRepository
                .findBySkillIdAndStatus(existing.getId(), SkillVersionStatus.PUBLISHED)
                .isEmpty();
        
        if (hasPublished) {
            // PUBLISHED 版本存在，無論 visibility 如何都拒絕
            // 因為只允許一個 PRIVATE + PUBLISHED 或 PUBLIC + PUBLISHED
            if (existing.getVisibility() == SkillVisibility.PRIVATE) {
                throw new DomainBadRequestException("error.skill.publish.nameConflict.private", skillSlug);
            } else {
                throw new DomainBadRequestException("error.skill.publish.nameConflict", skillSlug);
            }
        }
    }
}
```

### 9.6 錯誤資訊

| 錯誤碼 | 說明 |
|-------|------|
| `error.skill.publish.nameConflict` | 已有同名 PUBLIC/NAMESPACE_ONLY skill 發布 |
| `error.skill.publish.nameConflict.private` | 已有同名 PRIVATE skill 正式發布 |

---

## 10. package_name / runtime 規則

### 10.1 當前實現

- `package_name` 不是 Core 的結構化欄位
- 儲存在 `skill_version.parsedMetadataJson` JSONB 欄位中
- 由 skill 作者在 SKILL.md frontmatter 中定義

### 10.2 SaaS Adapter 職責

- 從 `parsedMetadataJson` 中提取 `package_name`
- 作為頂層欄位返回給 AstronClaw
- 可選：檢查跨 skill 的 package_name 唯一性
- 統一封裝 `submit-review`、`confirm-publish`、刪除、查詢等 Core 能力，對 AstronClaw 暴露穩定介面

### 10.3 規則建議

| 規則 | 建議 |
|------|------|
| 格式 | 建議使用 `namespace__slug` 格式，避免衝突 |
| 跨版本穩定性 | 同一 skill 跨版本應保持 package_name 一致 |
| 唯一性 | SaaS Adapter 可檢查並警告衝突，但不強制阻止 |

---

## 11. 程式碼改動清單

說明：

以下改動屬於開源 `Core` 的規則實現，用於給 SaaS 封裝層提供穩定能力基線；不等同於直接向 AstronClaw 暴露這些開源介面。

### 11.1 列舉新增

**檔案**：`SkillVersionStatus.java`

```java
public enum SkillVersionStatus {
    DRAFT,
    SCANNING,
    SCAN_FAILED,
    UPLOADED,      // 新增
    PENDING_REVIEW,
    PUBLISHED,
    REJECTED,
    YANKED
}
```

### 11.2 發布邏輯改動

**檔案**：`SkillPublishService.java`

```java
// 第 279-285 行，改為
if (visibility == SkillVisibility.PRIVATE) {
    version.setStatus(SkillVersionStatus.UPLOADED);
    version.setPublishedAt(currentTime());
    // 不建立稽核任務
} else if (autoPublish) {
    version.setStatus(SkillVersionStatus.PUBLISHED);
    version.setPublishedAt(currentTime());
} else {
    version.setStatus(SkillVersionStatus.PENDING_REVIEW);
    // 建立稽核任務
}
```

### 11.3 撤回稽核改動

**檔案**：`SkillGovernanceService.java`

```java
// withdrawPendingVersion 方法，改為
skillVersion.setStatus(SkillVersionStatus.UPLOADED);  // 原為 DRAFT
```

### 11.4 下載許可權改動

**檔案**：`SkillDownloadService.java`、`SkillQueryService.java`

```java
// UPLOADED 和 PENDING_REVIEW 狀態允許 owner 下載
private boolean canDownload(SkillVersion version, Skill skill, String currentUserId) {
    return switch (version.getStatus()) {
        case UPLOADED, PENDING_REVIEW -> skill.getOwnerId().equals(currentUserId);
        case PUBLISHED -> true;  // 按 visibility 判斷
        default -> false;
    };
}
```

### 11.5 新增服務

**檔案**：`SkillReviewSubmitService.java`（新增）

- 實現 UPLOADED 版本提交稽核邏輯

### 11.6 新增控制器

**檔案**：`SkillReviewSubmitController.java`（新增）

- 暴露 `POST /{namespace}/{slug}/submit-review` 介面
- 暴露 `POST /{namespace}/{slug}/confirm-publish` 介面

### 11.7 管理員可見性

**檔案**：`VisibilityChecker.java`

- SUPER_ADMIN 可以看到所有 skill，包括 UPLOADED 狀態

### 11.8 資料庫遷移

**檔案**：新增遷移指令碼

- 更新 `skill_version_status` 列舉型別，新增 UPLOADED 值

---

## 12. 阻塞上線條件

| 問題 | 嚴重程度 | 狀態 |
|------|---------|------|
| 新增 UPLOADED 狀態 | 高 | 已完成 |
| PRIVATE skill 發布邏輯改動 | 高 | 已完成 |
| 提交稽核介面 | 高 | 已完成 |
| 撤回稽核後進入 UPLOADED | 中 | 已完成 |
| 同名衝突檢查補全 | 中 | 已完成 |
| 管理員可見 UPLOADED skill | 低 | 已完成 |
| package_name 唯一性檢查 | 低 | 可選（SaaS Adapter 職責） |

---

## 13. 對老版本的影響

### 13.1 資料相容性

| 影響點 | 分析 | 需要處理 |
|--------|------|---------|
| 老版本資料 | 不受影響，狀態不變 | 否 |
| 資料庫列舉 | 需新增 UPLOADED 值 | 是 |
| API 相容性 | 新介面是新增，不影響老介面 | 否 |

### 13.2 狀態流轉影響

| 場景 | 老邏輯 | 新邏輯 | 影響 |
|------|--------|--------|------|
| 老版本撤回稽核 | PENDING_REVIEW → DRAFT | PENDING_REVIEW → UPLOADED | 前端需適配新狀態 |
| 老版本刪除 | DRAFT/REJECTED/SCAN_FAILED 可刪 | UPLOADED 也可刪 | 需更新程式碼判斷 |

### 13.3 程式碼改動點

**檔案**：`SkillGovernanceService.java`

**1. 刪除版本邏輯**（第163-166行）：
```java
// 原始碼
if (version.getStatus() != SkillVersionStatus.DRAFT
        && version.getStatus() != SkillVersionStatus.REJECTED
        && version.getStatus() != SkillVersionStatus.SCAN_FAILED) {
    throw new DomainBadRequestException("error.skill.version.delete.unsupported", version.getVersion());
}

// 改為：允許刪除 UPLOADED 狀態
if (version.getStatus() != SkillVersionStatus.DRAFT
        && version.getStatus() != SkillVersionStatus.REJECTED
        && version.getStatus() != SkillVersionStatus.SCAN_FAILED
        && version.getStatus() != SkillVersionStatus.UPLOADED) {
    throw new DomainBadRequestException("error.skill.version.delete.unsupported", version.getVersion());
}
```

**2. 撤回稽核邏輯**（第245行）：
```java
// 原始碼
version.setStatus(SkillVersionStatus.DRAFT);

// 改為
version.setStatus(SkillVersionStatus.UPLOADED);
```

### 13.4 前端適配

| 狀態 | 前端展示建議 |
|------|-------------|
| UPLOADED | "已上傳" 或 "待確認" |
| 可刪除狀態 | DRAFT、SCAN_FAILED、REJECTED、UPLOADED |
| 可編輯狀態 | DRAFT、SCAN_FAILED、REJECTED |

### 13.5 遷移策略

1. **資料庫遷移**：新增 UPLOADED 列舉值
2. **程式碼部署**：先部署後端，再部署前端
3. **老資料處理**：無需處理，老版本狀態保持不變
4. **回滾方案**：如需回滾，UPLOADED 狀態的版本按 DRAFT 處理
