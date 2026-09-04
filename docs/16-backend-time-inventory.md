# skillhub 後端時間欄位臺賬

## 1. 掃描範圍

本臺賬基於 `server/skillhub-app`、`server/skillhub-auth`、`server/skillhub-domain`、`server/skillhub-infra`、`server/skillhub-storage` 的當前生產程式碼與 Flyway migration。

目標已經從“摸底問題分佈”轉為“記錄當前真實進展與剩餘尾項”。

## 2. 當前程式碼分佈

### 2.1 生產程式碼中的 `LocalDateTime` 已基本清空

當前生產程式碼裡只剩 1 處相容解析保留 `LocalDateTime`：

- `ApiTokenService`
  - 用於相容舊介面傳入的裸時間字串
  - 當前明確按 UTC 解釋後轉成 `Instant`

此前集中使用 `LocalDateTime` 的主鏈區域已完成遷移或收口：

- 認證與賬號：
  - `api_token`
  - `account_merge_request`
  - `user_account`
  - `identity_binding`
  - `role`
  - `user_role_binding`
  - `local_credential`
- 核心領域：
  - `namespace`
  - `namespace_member`
  - `skill`
  - `skill_version`
  - `skill_file`
  - `skill_tag`
  - `skill_version_stats`
  - `skill_report`
  - `skill_star`
  - `skill_rating`
- 服務層：
  - `AccountMergeService`
  - `LocalAuthService`
  - `SkillPublishService`
  - `SkillGovernanceService`
  - `ReviewService`
  - `PromotionService`
  - `SkillReportService`
- DTO 與介面輸出：
  - `NamespaceResponse`
  - `MemberResponse`
  - `SkillSummaryResponse`
  - `SkillVersionResponse`
  - `SkillVersionDetailResponse`
  - `TagResponse`
  - `AdminUserSummaryResponse`
  - `AdminSkillReportSummaryResponse`

結論：

- 主系統核心“事件發生時間”已經基本收口成 UTC 絕對時間
- 當前剩餘工作主要是相容策略、資料庫尾項複核和防迴歸約束

### 2.2 `Instant` 已成為主流絕對時間型別

當前已穩定使用 `Instant` 的代表區域：

- 審計：
  - `AuditLog`
  - `AuditLogItemResponse`
- 通知：
  - `UserNotification`
- 稽核流程：
  - `ReviewTask`
  - `PromotionRequest`
  - `ReviewTaskResponse`
  - `PromotionResponseDto`
- 冪等：
  - `IdempotencyRecord`
  - `IdempotencyInterceptor`
  - `IdempotencyCleanupTask`
- 技能主鏈：
  - `Skill`
  - `SkillVersion`
  - `SkillTag`
  - `SkillFile`
  - `SkillVersionStats`
- 認證主鏈：
  - `ApiToken`
  - `AccountMergeRequest`
  - `UserAccount`
  - `IdentityBinding`
  - `Role`
  - `UserRoleBinding`
  - `LocalCredential`

## 3. 資料庫層分佈

### 3.1 已完成的 `TIMESTAMPTZ` 遷移

- `V12__governance_notifications.sql`
  - `user_notification.created_at / read_at`
- `V24__api_token_timestamptz.sql`
  - `api_token.expires_at / last_used_at / revoked_at / created_at`
- `V25__account_merge_request_timestamptz.sql`
  - `account_merge_request.token_expires_at / completed_at / created_at`
- `V26__skill_version_timestamptz.sql`
  - `skill_version.published_at / created_at / yanked_at`
- `V16__skill_hidden_at_timestamptz.sql`
  - `skill.hidden_at`
- `V17__skill_created_updated_timestamptz.sql`
  - `skill.created_at / updated_at`
- `V18__namespace_timestamptz.sql`
  - `namespace.created_at / updated_at`
  - `namespace_member.created_at / updated_at`
- `V19__skill_secondary_timestamptz.sql`
  - `skill_tag.created_at / updated_at`
  - `skill_file.created_at`
  - `skill_version_stats.updated_at`
- `V20__social_and_skill_report_timestamptz.sql`
  - `skill_star.created_at`
  - `skill_rating.created_at / updated_at`
  - `skill_report.created_at / handled_at`
- `V21__user_account_timestamptz.sql`
  - `user_account.created_at / updated_at`
- `V22__auth_supporting_tables_timestamptz.sql`
  - `identity_binding.created_at / updated_at`
  - `role.created_at`
  - `user_role_binding.created_at`
  - `local_credential.locked_until / created_at / updated_at`
- `V23__review_and_idempotency_timestamptz.sql`
  - `review_task.submitted_at / reviewed_at`
  - `promotion_request.submitted_at / reviewed_at`
  - `idempotency_record.created_at / expires_at`
- `V42__audit_log_created_at_timestamptz.sql`
  - `audit_log.created_at`

### 3.2 當前狀態

- 主鏈核心事件時間列已基本完成 `TIMESTAMPTZ` 收口
- 初始建表 migration 中仍然能看到舊 `TIMESTAMP` 定義，但已由後續 Flyway 升級覆蓋
- 後續重點不是“大批次遷移”，而是查漏補缺和約束新增

## 4. 已解決的高風險熱點

### 4.1 相容層時區解釋衝突

此前：

- `ClawHubCompatController` 按 `ZoneOffset.UTC` 轉 epoch
- `ClawHubRegistryFacade` 按系統預設時區解釋

當前：

- 已統一按 UTC 解釋絕對時間
- `ClawHubRegistryFacade` 的 `LocalDateTime` epoch 轉換過載已移除

### 4.2 服務層散落的 `now()`

此前熱點包括：

- `ApiTokenService`
- `AccountMergeService`
- `LocalAuthService`
- `SkillPublishService`
- `SkillGovernanceService`
- `ReviewService`
- `PromotionService`
- `SkillReportService`
- 多個實體 `@PrePersist` / `@PreUpdate`

當前：

- 服務層當前時間已基本統一為注入 `Clock`
- 實體回撥已基本統一為顯式 UTC

## 5. 分批遷移進展

### Batch 1：基礎設施與治理鏈路

已完成：

- UTC `Clock` Bean
- Hibernate UTC 配置
- Jackson UTC 配置
- `ApiResponseFactory`
- `IdempotencyInterceptor`
- `IdempotencyCleanupTask`
- 審計、通知、稽核、冪等鏈路

### Batch 2：認證與賬號鏈路

已完成：

- `ApiToken` / `ApiTokenService`
- `AccountMergeRequest` / `AccountMergeService`
- `LocalCredential`
- `UserAccount`
- `IdentityBinding`
- `Role`
- `UserRoleBinding`
- `LocalAuthService`

### Batch 3：技能核心領域

已完成：

- `Skill`
- `SkillVersion`
- `SkillFile`
- `SkillTag`
- `SkillVersionStats`
- `Namespace`
- `NamespaceMember`
- `SkillPublishService`
- `SkillGovernanceService`
- `ReviewService`
- `PromotionService`
- `SkillReport`
- `SkillStar`
- `SkillRating`

### Batch 4：DTO 與 API 契約收口

已完成：

- `NamespaceResponse`
- `MemberResponse`
- `SkillSummaryResponse`
- `SkillVersionResponse`
- `SkillVersionDetailResponse`
- `TagResponse`
- `AdminUserSummaryResponse`
- `AdminSkillReportSummaryResponse`
- `TokenController` 的 UTC 輸出收口

## 6. 當前剩餘尾項

- `ApiTokenService` 仍保留對裸 `LocalDateTime` 字串的相容解析
- 需要補靜態掃描或 ArchUnit 約束，防止新增 `LocalDateTime.now()`
- 需要做一輪跨時區迴歸，把 `UTC` / `Asia/Shanghai` 納入關鍵測試
