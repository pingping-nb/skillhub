# Phase 4: 運維增強 + 打磨 + 開源就緒 設計檔案

> **Goal:** 在 Phase 1-3 完成核心功能的基礎上，擴充套件認證體系（使用者名稱密碼登入 + 多賬號合併）、完善平臺治理（技能隱藏/撤回 + 審計日誌查詢）、提升可觀測性（Prometheus 指標）、最佳化效能（資料庫索引 + 預簽名 URL + 前端程式碼分割）、加固安全、實現 Docker 一鍵啟動和 K8s 基礎部署，並建立完整的開源專案基礎設施。

> **前置條件:** Phase 1 完成（工程骨架 + 認證授權）+ Phase 2 完成（名稱空間 + 技能核心鏈路）+ Phase 3 完成（稽核流程 + CLI API + 評分收藏 + 相容層）

> **重要修訂：身份主鍵約束**
> 使用者身份主鍵全鏈路統一使用 `string`。本文中出現的 `user_id`、`primary_user_id`、`secondary_user_id`、`hidden_by`、`yanked_by`、`actor_user_id` 等使用者關聯欄位都應按字串設計，任何整型使用者主鍵描述都不再有效。

## 關鍵設計決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 密碼登入體系 | 獨立註冊體系，與 OAuth 完全獨立 | 降低耦合，兩種方式各自獨立，透過多賬號合併關聯 |
| 密碼雜湊 | BCrypt (strength=12) | 安全性與效能平衡，約 250ms/次 |
| 多賬號合併 | 使用者主動發起 + 驗證 secondary 身份 + 確認 | 安全可控，避免誤合併 |
| 版本撤回語義 | YANKED（借鑑 crates.io） | 精確版本仍可下載，相容已有 lockfile |
| 下載最佳化 | S3 預簽名 URL + 302 重定向 | 減少後端頻寬壓力，LocalFile 降級代理 |
| Docker 一鍵啟動 | docker Profile + ApplicationRunner 種子資料 | 零配置體驗，clone 即用 |
| K8s 部署 | 基礎版（Deployment + Service + Ingress） | 滿足基本部署需求，不過度設計 |
| 開源許可 | Apache 2.0 | 企業友好，允許商業使用 |
| Chunk 策略 | 4 Chunk 漸進交付 | 每個 Chunk 範圍清晰、風險可控 |

## Tech Stack（沿用 Phase 1-3 + 新增）

- 沿用：Spring Boot 3.x + JDK 21 + PostgreSQL 16 + Redis 7 + Spring Security + Spring Data JPA + Flyway
- 沿用前端：React 19 + TypeScript + Vite + TanStack Router + TanStack Query + shadcn/ui + Tailwind CSS
- 新增後端：spring-security-crypto（BCrypt）、Micrometer Prometheus Registry
- 新增前端：rehype-sanitize（XSS 防護）

---

## 1. 資料庫遷移（V4__phase4_auth_governance.sql）

Phase 3 已有表：`user_account`, `identity_binding`, `api_token`, `role`, `permission`, `role_permission`, `user_role_binding`, `namespace`, `namespace_member`, `audit_log`, `skill`, `skill_version`, `skill_file`, `skill_tag`, `skill_search_document`, `review_task`, `promotion_request`, `skill_star`, `skill_rating`, `idempotency_record`

### 1.1 新增表

#### local_credential（本地密碼憑證）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| user_id | VARCHAR(128) NOT NULL FK → user_account | 關聯使用者 |
| username | VARCHAR(64) NOT NULL UNIQUE | 登入使用者名稱（字母數字下劃線，3-64 字元） |
| password_hash | VARCHAR(255) NOT NULL | BCrypt 雜湊值 |
| failed_attempts | INT NOT NULL DEFAULT 0 | 連續失敗次數 |
| locked_until | TIMESTAMP | 鎖定截止時間（NULL 表示未鎖定） |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `(username)` UNIQUE — 使用者名稱唯一
- `(user_id)` UNIQUE — 每個使用者最多一個本地憑證

#### account_merge_request（賬號合併請求）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | BIGSERIAL PK | |
| primary_user_id | VARCHAR(128) NOT NULL FK → user_account | 主賬號（保留） |
| secondary_user_id | VARCHAR(128) NOT NULL FK → user_account | 副賬號（合併後停用） |
| status | VARCHAR(32) NOT NULL DEFAULT 'PENDING' | PENDING / VERIFIED / COMPLETED / CANCELLED |
| verification_token | VARCHAR(255) | 副賬號驗證令牌（BCrypt 雜湊儲存） |
| token_expires_at | TIMESTAMP | 令牌過期時間（30 分鐘） |
| completed_at | TIMESTAMP | 合併完成時間 |
| created_at | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

索引：
- `(primary_user_id, status)` — 使用者的合併請求列表
- `(secondary_user_id) WHERE status = 'PENDING'` — partial unique index，防止重複合併
- `(verification_token) WHERE status = 'PENDING'` — 令牌查詢

### 1.2 Phase 3 表結構調整

#### skill 表新增欄位

```sql
ALTER TABLE skill ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE skill ADD COLUMN hidden_at TIMESTAMP;
ALTER TABLE skill ADD COLUMN hidden_by VARCHAR(128) REFERENCES user_account(id);
CREATE INDEX idx_skill_hidden ON skill(hidden) WHERE hidden = TRUE;
```

#### skill_version 表調整

`skill_version.status` 列舉已包含 YANKED（Phase 2 預留），Phase 4 啟用：

```sql
-- YANKED 狀態的版本：精確版本號仍可下載，但不出現在版本列表和搜尋結果中
-- 借鑑 crates.io 語義：yank 不是刪除，是標記"不推薦"
ALTER TABLE skill_version ADD COLUMN yanked_at TIMESTAMP;
ALTER TABLE skill_version ADD COLUMN yanked_by VARCHAR(128) REFERENCES user_account(id);
ALTER TABLE skill_version ADD COLUMN yank_reason TEXT;
```

### 1.3 效能最佳化索引

```sql
-- 搜尋效能最佳化
CREATE INDEX idx_skill_search_doc_rank ON skill_search_document USING gin(search_vector);
CREATE INDEX idx_skill_namespace_status ON skill(namespace_id, hidden) WHERE hidden = FALSE;

-- 審計日誌查詢最佳化
CREATE INDEX idx_audit_log_actor_time ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log(target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_log_action_time ON audit_log(action, created_at DESC);

-- 下載統計最佳化
CREATE INDEX idx_skill_version_download ON skill_version(skill_id, status) WHERE status = 'PUBLISHED';
```

---

## 2. 本地認證體系

### 2.1 註冊流程

```
使用者訪問 /register
    │
    ▼
填寫表單：username + password + email（可選）
    │
    ▼
前端校驗：
  - username: 3-64 字元，字母數字下劃線
  - password: 8-128 字元，至少包含 3 種字元型別（大寫、小寫、數字、特殊字元）
    │
    ▼
POST /api/v1/auth/local/register
    │
    ▼
LocalAuthService.register():
  ① 檢查 username 是否已存在（local_credential.username）
  ② 檢查 email 是否已被 OAuth 使用者佔用（user_account.email）
  ③ 密碼強度校驗（後端二次校驗）
  ④ BCrypt 雜湊密碼（strength=12）
  ⑤ 建立 user_account（status=ACTIVE）
  — 認證方式透過 local_credential 表的存在性隱式判斷，不在 user_account 新增欄位
  ⑥ 建立 local_credential
  ⑦ 寫入 audit_log（action=USER_REGISTERED）
    │
    ▼
自動登入：建立 Spring Session
    │
    ▼
重定向到首頁
```

### 2.2 登入流程

```
使用者訪問 /login
    │
    ▼
填寫表單：username + password
    │
    ▼
POST /api/v1/auth/local/login
    │
    ▼
LocalAuthService.login():
  ① 查詢 local_credential（by username）
  ② 檢查賬號狀態：
     - user_account.status = DISABLED → 返回 403 "賬號已被封禁"
     - locked_until > now → 返回 423 "賬號已鎖定，請 X 分鐘後重試"
  ③ BCrypt 校驗密碼
     - 成功 → 重置 failed_attempts = 0，清除 locked_until
     - 失敗 → failed_attempts++
       - failed_attempts >= 5 → locked_until = now + 15 分鐘
       - 返回 401 "使用者名稱或密碼錯誤"
  ④ 寫入 audit_log（action=USER_LOGIN）
    │
    ▼
建立 Spring Session
    │
    ▼
返回 200 + 使用者資訊
```

### 2.3 密碼策略

```java
public class PasswordPolicy {
    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 128;
    public static final int MIN_CHAR_TYPES = 3; // 至少 3 種字元型別

    // 字元型別：大寫字母、小寫字母、數字、特殊字元
    public ValidationResult validate(String password) {
        // 1. 長度檢查
        // 2. 字元型別計數
        // 3. 常見弱密碼黑名單檢查（top 1000）
    }
}
```

### 2.4 登入鎖定機制

| 引數 | 值 | 說明 |
|------|------|------|
| 最大失敗次數 | 5 | 連續失敗 5 次觸發鎖定 |
| 鎖定時長 | 15 分鐘 | 鎖定期間拒絕登入 |
| 重置條件 | 成功登入 | 成功登入後 failed_attempts 歸零 |
| 鎖定粒度 | 賬號級 | 按 username 鎖定，非 IP 級 |

### 2.5 API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/auth/local/register` | 使用者名稱密碼註冊 |
| POST | `/api/v1/auth/local/login` | 使用者名稱密碼登入 |
| POST | `/api/v1/auth/local/change-password` | 修改密碼（需登入） |

### 2.6 前端頁面

- `/register` — 註冊頁（username + password + 密碼強度指示器）
- `/login` 頁面擴充套件 — 增加使用者名稱密碼登入表單（與 OAuth 登入按鈕並列）
- `/settings/security` — 密碼修改（已有本地憑證時顯示）

### 2.7 Spring Security 整合

本地登入與 OAuth 登入並存，共享同一套 Session 和 RBAC 體系：

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        // 現有 OAuth2 登入配置保持不變
        .oauth2Login(oauth2 -> oauth2
            .userInfoEndpoint(info -> info.userService(customOAuth2UserService))
            .successHandler(oAuth2SuccessHandler)
            .failureHandler(oAuth2FailureHandler))
        // 新增：本地登入 API 不需要 CSRF 豁免（使用 JSON body，非 form）
        // LocalAuthController 手動處理認證，不使用 Spring Security formLogin
        ;
}
```

本地登入不使用 Spring Security 的 `formLogin`，而是透過自定義 `LocalAuthController` + `LocalAuthService` 手動校驗密碼並建立 Session。原因：
- 避免與 OAuth2 登入的 `successHandler` 衝突
- JSON API 風格與現有 API 一致
- 更靈活的錯誤響應控制

---

## 3. 多賬號合併

### 3.1 合併流程

```
使用者 A（主賬號，已登入）發起合併
    │
    ▼
① POST /api/v1/account/merge/initiate
   Body: { "secondaryIdentifier": "username 或 OAuth provider:externalId" }
    │
    ▼
② 後端建立 account_merge_request（status=PENDING）
   生成 verification_token（隨機 32 位元組 + BCrypt 雜湊儲存）
   token_expires_at = now + 30 分鐘
    │
    ▼
③ 返回驗證方式：
   - 副賬號是本地賬號 → 要求輸入副賬號密碼
   - 副賬號是 OAuth 賬號 → 要求透過 OAuth 重新登入驗證
    │
    ▼
④ POST /api/v1/account/merge/{id}/verify
   - 本地賬號：Body: { "password": "xxx" }
   - OAuth 賬號：透過 OAuth 回撥驗證（帶 merge_request_id 引數）
    │
    ▼
⑤ 驗證透過 → status = VERIFIED
    │
    ▼
⑥ POST /api/v1/account/merge/{id}/confirm
   使用者確認合併（顯示將要合併的資料摘要）
    │
    ▼
⑦ 執行合併（事務內）：
   a. 遷移 identity_binding：secondary → primary
   b. 遷移 local_credential：secondary → primary（如果 primary 沒有）
   c. 遷移 skill ownership：UPDATE skill SET owner_id = primary WHERE owner_id = secondary
   d. 遷移 namespace_member：合併角色取高許可權
   e. 遷移 api_token：secondary → primary
   f. 遷移 skill_star、skill_rating：secondary → primary（衝突時保留 primary）
   g. 合併 user_role_binding：取並集
   h. 標記 secondary user_account.status = MERGED
   i. 寫入 audit_log（action=ACCOUNT_MERGED，detail 包含完整遷移清單）
    │
    ▼
⑧ status = COMPLETED，返回合併結果摘要
```

### 3.2 合併 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/auth/merge/initiate` | 發起合併請求 |
| POST | `/api/v1/auth/merge/{id}/verify` | 驗證副賬號身份 |
| POST | `/api/v1/auth/merge/{id}/confirm` | 確認執行合併 |
| POST | `/api/v1/auth/merge/{id}/cancel` | 取消合併請求 |
| GET | `/api/v1/auth/merge/history` | 合併歷史記錄 |

### 3.3 安全約束

- 合併操作不可逆，確認前展示完整資料遷移摘要
- verification_token 30 分鐘過期，過期後需重新發起
- 同一副賬號同時只能有一個 PENDING 合併請求（partial unique index）
- MERGED 狀態的使用者無法登入，無法被再次合併
- 合併操作寫入 audit_log，包含完整遷移清單

### 3.4 前端頁面

- `/settings/accounts` — 賬號管理頁
  - 顯示當前繫結的所有登入方式（OAuth + 本地）
  - "合併其他賬號"按鈕 → 合併嚮導
  - 合併歷史記錄

---

## 4. 技能治理（隱藏/恢復/版本撤回）

### 4.1 技能隱藏/恢復

隱藏技能後，技能不出現在搜尋結果和公開列表中，但已有的直接連結仍可訪問（顯示"此技能已被管理員隱藏"提示）。

```
POST /api/v1/admin/skills/{id}/hide
  許可權：SKILL_ADMIN / SUPER_ADMIN
  效果：
    - skill.hidden = true
    - skill.hidden_at = now
    - skill.hidden_by = current_user_id
    - 搜尋索引中移除
    - audit_log 記錄

POST /api/v1/admin/skills/{id}/unhide
  許可權：SKILL_ADMIN / SUPER_ADMIN
  效果：
    - skill.hidden = false
    - 搜尋索引中恢復
    - audit_log 記錄
```

### 4.2 版本撤回（YANK）

借鑑 crates.io 語義：YANKED 版本不出現在版本列表和搜尋中，但透過精確版本號仍可下載（相容已有 lockfile）。

```
POST /api/v1/admin/skills/{id}/yank/{versionId}
  許可權：SKILL_ADMIN / SUPER_ADMIN
  Body: { "reason": "安全漏洞 CVE-2026-xxxx" }
  效果：
    - skill_version.status = YANKED
    - skill_version.yanked_at = now
    - skill_version.yanked_by = current_user_id
    - skill_version.yank_reason = reason
    - 如果是 latest_version_id → 回退到上一個 PUBLISHED 版本
    - 搜尋索引更新
    - audit_log 記錄

POST /api/v1/admin/skills/{id}/unyank/{versionId}
  許可權：SKILL_ADMIN / SUPER_ADMIN
  效果：
    - skill_version.status = PUBLISHED
    - 清除 yanked_at/yanked_by/yank_reason
    - audit_log 記錄
```

### 4.3 下載行為

| 請求方式 | YANKED 版本行為 |
|----------|----------------|
| `GET /download`（不帶版本號） | 返回最新非 YANKED 的 PUBLISHED 版本 |
| `GET /versions/{version}/download`（精確版本） | 正常下載，響應頭附加 `X-Skillhub-Yanked: true` + `X-Skillhub-Yank-Reason: ...` |
| `GET /resolve`（不帶版本號） | 返回最新非 YANKED 的 PUBLISHED 版本 |
| `GET /resolve?version=1.0.0`（精確版本） | 正常解析，響應中標記 `yanked: true` |

---

## 5. 審計日誌查詢

### 5.1 查詢 API

```
GET /api/v1/admin/audit-logs
  許可權：AUDITOR / SUPER_ADMIN
  Query Params:
    - actor_id: BIGINT — 操作人
    - action: STRING — 操作型別（USER_LOGIN, SKILL_PUBLISHED, REVIEW_APPROVED, ...）
    - target_type: STRING — 目標型別（USER, SKILL, SKILL_VERSION, NAMESPACE, ...）
    - target_id: BIGINT — 目標 ID
    - from: TIMESTAMP — 起始時間
    - to: TIMESTAMP — 截止時間
    - page: INT — 頁碼
    - size: INT — 每頁條數（預設 20，最大 100）
```

響應：
```json
{
  "code": 0,
  "msg": "獲取成功",
  "data": {
    "items": [
      {
        "id": 1,
        "actorId": 42,
        "actorName": "zhangsan",
        "action": "SKILL_PUBLISHED",
        "targetType": "SKILL_VERSION",
        "targetId": 123,
        "detail": "{\"namespace\":\"ai-team\",\"slug\":\"my-skill\",\"version\":\"1.0.0\"}",
        "ipAddress": "192.168.1.1",
        "createdAt": "2026-03-12T06:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "size": 20
  },
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

### 5.2 前端審計日誌頁

- 路由：`/admin/audit-logs`
- 許可權：AUDITOR / SUPER_ADMIN
- 功能：
  - 時間範圍篩選（日期選擇器）
  - 操作型別下拉篩選
  - 操作人搜尋（模糊匹配）
  - 目標型別 + 目標 ID 篩選
  - 分頁瀏覽
  - 詳情展開（JSON 格式化顯示）

---

## 6. 可觀測性（Prometheus 指標）

### 6.1 Spring Boot Actuator + Micrometer

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  endpoint:
    health:
      show-details: when_authorized
  metrics:
    tags:
      application: skillhub
    export:
      prometheus:
        enabled: true
```

### 6.2 自定義業務指標

| 指標名 | 型別 | 標籤 | 說明 |
|--------|------|------|------|
| `skillhub_skill_publish_total` | Counter | namespace, status | 技能發布計數 |
| `skillhub_skill_download_total` | Counter | namespace, slug | 技能下載計數 |
| `skillhub_review_total` | Counter | action(approve/reject), namespace | 稽核操作計數 |
| `skillhub_auth_login_total` | Counter | method(oauth/local), result(success/fail) | 登入計數 |
| `skillhub_auth_lockout_total` | Counter | — | 賬號鎖定計數 |
| `skillhub_search_duration_seconds` | Histogram | — | 搜尋耗時分佈 |
| `skillhub_active_sessions` | Gauge | — | 活躍 Session 數 |

### 6.3 實現方式

```java
@Component
@RequiredArgsConstructor
public class SkillhubMetrics {
    private final MeterRegistry registry;

    public void recordPublish(String namespace, String status) {
        registry.counter("skillhub_skill_publish_total",
            "namespace", namespace, "status", status).increment();
    }

    public void recordDownload(String namespace, String slug) {
        registry.counter("skillhub_skill_download_total",
            "namespace", namespace, "slug", slug).increment();
    }

    public void recordLogin(String method, String result) {
        registry.counter("skillhub_auth_login_total",
            "method", method, "result", result).increment();
    }
}
```

端點：`GET /actuator/prometheus` — Prometheus 拉取指標（僅內網可訪問，透過 Spring Security 配置限制）

---

## 7. 效能最佳化

### 7.1 資料庫查詢最佳化

除 1.3 節的索引外，還需：

- 慢查詢日誌：PostgreSQL `log_min_duration_statement = 500`（記錄 >500ms 的查詢）
- 連線池調優：HikariCP `maximum-pool-size` 根據部署環境調整（開發 5，生產 20）
- 搜尋查詢最佳化：確保 `skill_search_document` 的 GIN 索引被正確使用

### 7.2 物件儲存最佳化（S3 預簽名 URL）

```java
@Service
public class StorageService {
    // 現有方法：直接代理下載
    public StreamingResponseBody download(String key) { ... }

    // 新增：預簽名 URL 下載（S3 實現）
    public String generatePresignedUrl(String key, Duration expiry) {
        // S3 實現：生成預簽名 URL（預設 10 分鐘有效）
        // LocalFile 實現：返回 null（降級為代理下載）
    }
}
```

下載 Controller 改造：

```java
@GetMapping("/download")
public ResponseEntity<?> download(...) {
    String presignedUrl = storageService.generatePresignedUrl(key, Duration.ofMinutes(10));
    if (presignedUrl != null) {
        // S3 模式：302 重定向到預簽名 URL
        return ResponseEntity.status(302)
            .header("Location", presignedUrl)
            .build();
    }
    // LocalFile 模式：直接代理下載（保持現有行為）
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(storageService.download(key));
}
```

### 7.3 前端效能最佳化

#### 程式碼分割（TanStack Router lazy routes）

```typescript
// 改造前：所有頁面同步匯入
import { SkillDetailPage } from './pages/skill-detail'

// 改造後：按路由懶載入
const SkillDetailPage = lazy(() => import('./pages/skill-detail'))

// TanStack Router 配置
const skillDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills/$namespace/$slug',
  component: SkillDetailPage,
})
```

#### 分割策略

| 路由組 | 分割方式 | 說明 |
|--------|----------|------|
| 公開頁面（首頁、搜尋、詳情） | 主 bundle | 首屏必需 |
| 認證頁面（登入、註冊） | lazy | 非首屏 |
| Dashboard 頁面 | lazy | 需登入 |
| Admin 頁面 | lazy | 僅管理員 |
| 稽核中心 | lazy | 僅稽核人 |

#### 其他最佳化

- 圖片懶載入：使用者頭像、技能圖示使用 `loading="lazy"`
- API 響應快取：TanStack Query `staleTime` 合理設定（搜尋 30s，詳情 60s，使用者資訊 300s）

---

## 8. 安全加固

### 8.1 Session 安全

```yaml
server:
  servlet:
    session:
      cookie:
        http-only: true      # 防止 JS 讀取 Session Cookie
        secure: true          # 僅 HTTPS 傳輸（生產環境）
        same-site: lax        # 防止 CSRF（允許頂級導航）
        max-age: 28800        # 8 小時
```

### 8.2 XSS 防護

SKILL.md 內容渲染使用 `rehype-sanitize` 過濾危險 HTML：

```typescript
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import ReactMarkdown from 'react-markdown'

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeSanitize]}
>
  {skillMdContent}
</ReactMarkdown>
```

### 8.3 安全響應頭

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.headers(headers -> headers
        .contentTypeOptions(Customizer.withDefaults())     // X-Content-Type-Options: nosniff
        .frameOptions(frame -> frame.deny())                // X-Frame-Options: DENY
        .httpStrictTransportSecurity(hsts -> hsts           // HSTS
            .includeSubDomains(true)
            .maxAgeInSeconds(31536000))
        .referrerPolicy(referrer -> referrer
            .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
    );
}
```

### 8.4 密碼安全

- BCrypt strength=12（約 250ms/次，防暴力破解）
- 密碼不在日誌中輸出（LoggingFilter 排除 password 欄位）
- 密碼修改後使該使用者所有其他 Session 失效
- API 響應中永遠不返回 password_hash

---

## 9. Docker 一鍵啟動

### 9.1 docker-compose.yml（開發環境）

現有 `docker-compose.yml` 已包含 PostgreSQL、Redis、MinIO。Phase 4 擴充套件為完整的一鍵啟動方案：

```yaml
# docker-compose.yml — 開發環境完整啟動
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: skillhub
      POSTGRES_USER: skillhub
      POSTGRES_PASSWORD: skillhub
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: backend
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/skillhub
      SPRING_DATASOURCE_USERNAME: skillhub
      SPRING_DATASOURCE_PASSWORD: skillhub
      SPRING_DATA_REDIS_HOST: redis
      SKILLHUB_STORAGE_TYPE: s3
      SKILLHUB_STORAGE_S3_ENDPOINT: http://minio:9000
      SKILLHUB_STORAGE_S3_ACCESS_KEY: minioadmin
      SKILLHUB_STORAGE_S3_SECRET_KEY: minioadmin
    ports:
      - "8080:8080"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      target: frontend
    depends_on:
      - backend
    ports:
      - "3000:80"

volumes:
  postgres_data:
  minio_data:
```

### 9.2 Dockerfile（多階段構建）

```dockerfile
# === Backend Build ===
FROM eclipse-temurin:21-jdk-alpine AS backend-build
WORKDIR /app
COPY pom.xml .
COPY skillhub-*/pom.xml ./
# Maven 依賴快取層
RUN mvn dependency:go-offline -B
COPY . .
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine AS backend
WORKDIR /app
COPY --from=backend-build /app/skillhub-app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

# === Frontend Build ===
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 9.3 種子資料（ApplicationRunner）

```java
@Component
@Profile("docker")
@RequiredArgsConstructor
public class SeedDataRunner implements ApplicationRunner {
    private final UserAccountRepository userRepo;
    private final RoleRepository roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final LocalCredentialRepository localCredentialRepo;
    private final UserRoleBindingRepository userRoleBindingRepo;
    private final NamespaceRepository namespaceRepo;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepo.count() > 0) return; // 冪等：已有資料則跳過

        // 建立管理員賬號（密碼已 BCrypt 雜湊）
        var admin = new UserAccount();
        admin.setDisplayName("Admin");
        admin.setEmail("admin@skillhub.dev");
        admin.setStatus(UserStatus.ACTIVE);
        userRepo.save(admin);

        // 建立本地憑證
        var credential = new LocalCredential();
        credential.setUserId(admin.getId());
        credential.setUsername("admin");
        credential.setPasswordHash(passwordEncoder.encode("Admin@2026"));
        localCredentialRepo.save(credential);

        // 分配 SUPER_ADMIN 角色
        var superAdminRole = roleRepo.findByName("SUPER_ADMIN").orElseThrow();
        var binding = new UserRoleBinding();
        binding.setUserId(admin.getId());
        binding.setRoleId(superAdminRole.getId());
        userRoleBindingRepo.save(binding);

        // 建立全域性名稱空間
        var globalNs = new Namespace();
        globalNs.setSlug("global");
        globalNs.setDisplayName("Global");
        globalNs.setDescription("全域性公共名稱空間");
        namespaceRepo.save(globalNs);
    }
}
```

### 9.4 Nginx 配置（前端 SPA）

```nginx
# deploy/nginx/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由：所有非檔案請求回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # OAuth 回撥代理
    location /oauth2/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /login/oauth2/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # ClawHub CLI 相容層服務發現
    location /.well-known/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Actuator 端點（僅內網）
    location /actuator/ {
        proxy_pass http://backend:8080;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
    }

    # 靜態資源快取
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 10. K8s 基礎部署

### 10.1 Deployment（後端）

```yaml
# deploy/k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skillhub-backend
  labels:
    app: skillhub
    component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: skillhub
      component: backend
  template:
    metadata:
      labels:
        app: skillhub
        component: backend
    spec:
      containers:
        - name: backend
          image: skillhub/backend:latest
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "production"
            - name: SPRING_DATASOURCE_URL
              valueFrom:
                secretKeyRef:
                  name: skillhub-db
                  key: url
            - name: SPRING_DATASOURCE_USERNAME
              valueFrom:
                secretKeyRef:
                  name: skillhub-db
                  key: username
            - name: SPRING_DATASOURCE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: skillhub-db
                  key: password
            - name: SPRING_DATA_REDIS_HOST
              valueFrom:
                configMapKeyRef:
                  name: skillhub-config
                  key: redis-host
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8080
            initialDelaySeconds: 60
            periodSeconds: 30
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
```

### 10.2 Deployment（前端）

```yaml
# deploy/k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skillhub-frontend
  labels:
    app: skillhub
    component: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: skillhub
      component: frontend
  template:
    metadata:
      labels:
        app: skillhub
        component: frontend
    spec:
      containers:
        - name: frontend
          image: skillhub/frontend:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
```

### 10.3 Service

```yaml
# deploy/k8s/services.yaml
apiVersion: v1
kind: Service
metadata:
  name: skillhub-backend
spec:
  selector:
    app: skillhub
    component: backend
  ports:
    - port: 8080
      targetPort: 8080
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: skillhub-frontend
spec:
  selector:
    app: skillhub
    component: frontend
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

### 10.4 Ingress

```yaml
# deploy/k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: skillhub-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/limit-rps: "30"
spec:
  ingressClassName: nginx
  rules:
    - host: skillhub.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: skillhub-backend
                port:
                  number: 8080
          - path: /oauth2
            pathType: Prefix
            backend:
              service:
                name: skillhub-backend
                port:
                  number: 8080
          - path: /login/oauth2
            pathType: Prefix
            backend:
              service:
                name: skillhub-backend
                port:
                  number: 8080
          - path: /actuator/prometheus
            pathType: Exact
            backend:
              service:
                name: skillhub-backend
                port:
                  number: 8080
          - path: /.well-known
            pathType: Prefix
            backend:
              service:
                name: skillhub-backend
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: skillhub-frontend
                port:
                  number: 80
  tls:
    - hosts:
        - skillhub.example.com
      secretName: skillhub-tls
```

### 10.5 ConfigMap & Secret 模板

```yaml
# deploy/k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: skillhub-config
data:
  redis-host: "redis-service"
  storage-type: "s3"
  s3-endpoint: "http://minio-service:9000"
---
# deploy/k8s/secret.yaml.example（不提交到 Git）
apiVersion: v1
kind: Secret
metadata:
  name: skillhub-db
type: Opaque
stringData:
  url: "jdbc:postgresql://postgres-service:5432/skillhub"
  username: "skillhub"
  password: "CHANGE_ME"
```

---

## 11. 開源專案基礎設施

### 11.1 README.md

```markdown
# skillhub

企業級技能註冊中心，支援技能發布、版本管理、稽核流程和 CLI 工具鏈。

## 功能特性

- 技能發布與版本管理（語義化版本、標籤、草稿/稽核/發布流程）
- 名稱空間隔離（團隊空間 + 全域性空間）
- 多種認證方式（GitHub OAuth + 使用者名稱密碼）
- 完整的 RBAC 許可權體系
- CLI 工具支援（OAuth Device Flow 認證）
- ClawHub CLI 相容層
- 全文搜尋（PostgreSQL Full-Text Search）
- 評分與收藏
- 審計日誌
- Prometheus 可觀測性指標

## 快速開始

### 前置條件

- Docker & Docker Compose
- Git

### 一鍵啟動

\```bash
git clone https://github.com/your-org/skillhub.git
cd skillhub
docker compose up -d
\```

服務啟動後訪問：
- 前端：http://localhost:3000
- 後端 API：http://localhost:8080
- MinIO 控制檯：http://localhost:9001（minioadmin / minioadmin）

預設管理員賬號：`admin` / `Admin@2026`

### 本地開發

\```bash
# 啟動基礎設施
docker compose up -d postgres redis minio

# 後端（需要 JDK 21 + Maven）
cd skillhub-app
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 前端（需要 Node.js 20+）
cd web
npm install
npm run dev
\```

## 技術棧

| 層級 | 技術 |
|------|------|
| 後端 | Spring Boot 3.x, JDK 21, Spring Security, Spring Data JPA |
| 前端 | React 19, TypeScript, Vite, TanStack Router/Query, shadcn/ui |
| 資料庫 | PostgreSQL 16, Redis 7 |
| 物件儲存 | MinIO (S3 相容) |
| 部署 | Docker Compose, Kubernetes |

## 專案結構

\```
skillhub/
├── skillhub-app/          # Spring Boot 啟動模組
├── skillhub-core/         # 領域模型 + 服務
├── skillhub-infra/        # 基礎設施（儲存、快取）
├── skillhub-security/     # 認證授權
├── skillhub-api/          # REST Controller
├── skillhub-common/       # 公共工具
├── web/                   # React 前端
├── deploy/                # 部署配置（Nginx、K8s）
└── docs/                  # 設計檔案
\```

## 檔案

- [產品方向](docs/00-product-direction.md)
- [系統架構](docs/01-system-architecture.md)
- [領域模型](docs/02-domain-model.md)
- [認證設計](docs/03-authentication-design.md)
- [API 設計](docs/06-api-design.md)
- [交付路線](docs/10-delivery-roadmap.md)

## 貢獻

請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) 瞭解貢獻流程。

## 許可證

[Apache License 2.0](LICENSE)
```

### 11.2 CONTRIBUTING.md

```markdown
# 貢獻指南

感謝你對 skillhub 的關注！以下是參與貢獻的流程。

## 開發環境

1. Fork 並 clone 倉庫
2. 安裝依賴：JDK 21、Maven 3.9+、Node.js 20+、Docker
3. 啟動基礎設施：`docker compose up -d postgres redis minio`
4. 後端：`mvn spring-boot:run -Dspring-boot.run.profiles=local`
5. 前端：`cd web && npm install && npm run dev`

## 提交規範

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat(scope): 描述` — 新功能
- `fix(scope): 描述` — Bug 修復
- `docs(scope): 描述` — 檔案更新
- `refactor(scope): 描述` — 重構
- `test(scope): 描述` — 測試
- `chore(scope): 描述` — 構建/工具

scope 示例：`auth`, `skill`, `web`, `deploy`, `api`

## Pull Request 流程

1. 從 `main` 建立 feature 分支：`git checkout -b feat/your-feature`
2. 編寫程式碼和測試
3. 確保所有測試透過：`mvn verify` + `cd web && npm test`
4. 提交 PR，填寫模板中的資訊
5. 等待 Code Review

## 程式碼規範

- 後端：遵循專案現有的 Spring Boot 程式碼風格
- 前端：ESLint + Prettier 自動格式化
- 所有 API 變更需同步更新 OpenAPI spec
- 新功能需附帶單元測試

## Issue 反饋

- Bug 報告請使用 Bug Report 模板
- 功能建議請使用 Feature Request 模板
- 提問請使用 Discussions
```

### 11.3 GitHub Issue / PR 模板

#### `.github/ISSUE_TEMPLATE/bug_report.md`

```markdown
---
name: Bug Report
about: 報告一個 Bug
title: '[Bug] '
labels: bug
---

**描述**
簡要描述 Bug 現象。

**復現步驟**
1. ...
2. ...
3. ...

**期望行為**
描述你期望的正確行為。

**實際行為**
描述實際發生的錯誤行為。

**環境資訊**
- OS:
- Browser:
- skillhub 版本:
- 部署方式（Docker / K8s / 本地開發）:

**截圖/日誌**
如有相關截圖或錯誤日誌，請附上。
```

#### `.github/ISSUE_TEMPLATE/feature_request.md`

```markdown
---
name: Feature Request
about: 提出功能建議
title: '[Feature] '
labels: enhancement
---

**需求描述**
簡要描述你希望實現的功能。

**使用場景**
描述這個功能的使用場景和動機。

**期望方案**
描述你期望的實現方式。

**備選方案**
是否有其他替代方案？

**補充資訊**
其他相關資訊。
```

#### `.github/pull_request_template.md`

```markdown
## 變更說明

簡要描述本次變更的內容和目的。

## 變更型別

- [ ] 新功能（feat）
- [ ] Bug 修復（fix）
- [ ] 重構（refactor）
- [ ] 檔案（docs）
- [ ] 測試（test）
- [ ] 其他

## 關聯 Issue

Closes #

## 檢查清單

- [ ] 程式碼已自測透過
- [ ] 單元測試已新增/更新
- [ ] API 變更已更新 OpenAPI spec
- [ ] 檔案已更新（如適用）
- [ ] 無安全風險引入
```

### 11.4 其他開原始檔

#### LICENSE

Apache License 2.0 標準文字。

#### CODE_OF_CONDUCT.md

採用 [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)。

#### .github/FUNDING.yml（可選）

```yaml
github: [your-username]
```

#### .gitignore 補充

```gitignore
# Phase 4 新增
deploy/k8s/secret.yaml
*.env.local
```

---

## 12. Chunk 劃分與驗收標準

### Chunk 1：本地認證 + 多賬號合併

**範圍：** 使用者名稱密碼註冊/登入 + 密碼策略 + 賬號鎖定 + 多賬號合併流程

**後端任務：**
1. Flyway 遷移：`local_credential` 表、`account_merge_request` 表
2. `LocalAuthService`：註冊、登入、密碼修改、密碼策略校驗
3. `LocalAuthController`：`/api/v1/auth/local/*` 端點
4. `AccountMergeService`：發起合併、驗證、確認、取消
5. `AccountMergeController`：`/api/v1/auth/merge/*` 端點
6. Spring Security 配置擴充套件：本地認證 + OAuth 並存
7. 種子資料 `SeedDataRunner`（docker profile）

**前端任務：**
1. 註冊頁 `/register`
2. 登入頁擴充套件（使用者名稱密碼 Tab + OAuth Tab）
3. 密碼修改頁 `/settings/security`
4. 賬號合併頁 `/settings/accounts`

**驗收標準：**
1. 使用者可透過使用者名稱密碼註冊，密碼強度校驗生效
2. 使用者可透過使用者名稱密碼登入，登入失敗 5 次後鎖定 15 分鐘
3. 使用者可修改密碼，修改後其他 Session 失效
4. 使用者可發起賬號合併，驗證副賬號身份後完成合並
5. 合併後副賬號狀態為 MERGED，無法登入
6. 合併後資料（技能、收藏、角色等）正確遷移到主賬號
7. Docker 啟動後種子資料正確初始化（admin 賬號可登入）
8. 所有測試透過

### Chunk 2：技能治理 + 審計日誌查詢 + 可觀測性

**範圍：** 技能隱藏/恢復 + 版本撤回 + 審計日誌查詢 API 和前端 + Prometheus 指標

**後端任務：**
1. Flyway 遷移：skill 表新增 hidden 欄位、skill_version 表新增 yank 欄位、效能索引
2. `SkillGovernanceService`：隱藏/恢復/撤回
3. `AdminSkillController`：`/api/v1/admin/skills/{id}/hide|unhide|yank`
4. `AuditLogQueryService`：多條件查詢
5. `AuditLogController`：`GET /api/v1/admin/audit-logs`
6. `SkillhubMetrics`：Prometheus 自定義指標
7. Actuator + Micrometer 配置

**前端任務：**
1. 審計日誌查詢頁 `/admin/audit-logs`
2. 技能詳情頁增加隱藏/恢復操作（管理員可見）
3. 版本列表增加撤回操作（管理員可見）

**驗收標準：**
1. SKILL_ADMIN 可隱藏技能，隱藏後搜尋不可見，直接連結顯示隱藏提示
2. SKILL_ADMIN 可恢復隱藏的技能
3. SKILL_ADMIN 可撤回已發布版本，YANKED 版本精確版本號仍可下載
4. 撤回 latest 版本後，latest_version_id 回退到上一個 PUBLISHED 版本
5. AUDITOR 可查詢審計日誌，支援多條件篩選和分頁
6. `/actuator/prometheus` 返回自定義業務指標
7. 所有測試透過

### Chunk 3：效能最佳化 + 安全加固

**範圍：** 資料庫索引最佳化 + S3 預簽名 URL + 前端程式碼分割 + 安全響應頭 + Session 安全

**後端任務：**
1. `StorageService` 擴充套件：`generatePresignedUrl()` 方法
2. 下載 Controller 改造：S3 模式 302 重定向
3. Session Cookie 安全配置
4. 安全響應頭配置（SecurityFilterChain）
5. 密碼安全措施（日誌排除、Session 失效）

**前端任務：**
1. TanStack Router lazy routes 改造
2. `rehype-sanitize` 整合
3. 圖片懶載入
4. TanStack Query staleTime 調優

**驗收標準：**
1. S3 模式下載返回 302 + 預簽名 URL
2. LocalFile 模式下載保持直接代理（向後相容）
3. 前端 bundle 分析：Admin/Dashboard/Auth 頁面獨立 chunk
4. 安全響應頭正確設定（X-Content-Type-Options、X-Frame-Options、HSTS）
5. Session Cookie 設定 HttpOnly + SameSite
6. SKILL.md 渲染經過 XSS 過濾
7. 所有測試透過

### Chunk 4：Docker 一鍵啟動 + K8s 部署 + 開源基礎設施

**範圍：** Dockerfile + docker-compose + K8s 清單 + README + CONTRIBUTING + GitHub 模板

**任務：**
1. 多階段 Dockerfile（backend + frontend）
2. docker-compose.yml 完善（5 個服務 + 健康檢查）
3. Nginx 配置（SPA 路由 + API 代理）
4. K8s 清單（Deployment + Service + Ingress + ConfigMap）
5. README.md（快速開始 + 技術棧 + 專案結構）
6. CONTRIBUTING.md（開發環境 + 提交規範 + PR 流程）
7. GitHub Issue/PR 模板
8. LICENSE（Apache 2.0）
9. CODE_OF_CONDUCT.md

**驗收標準：**
1. `git clone && docker compose up -d` 後所有服務正常啟動
2. 前端可訪問，後端 API 可呼叫
3. 預設管理員賬號可登入
4. K8s 清單可透過 `kubectl apply -f deploy/k8s/` 部署
5. README 包含完整的快速開始指南
6. GitHub 模板檔案齊全
7. 所有測試透過

---

## 13. 測試策略

### 13.1 後端測試

| 層級 | 範圍 | 工具 | 覆蓋重點 |
|------|------|------|----------|
| 單元測試 | 領域服務 | JUnit 5 + Mockito | LocalAuthService（密碼策略、鎖定邏輯）、AccountMergeService（狀態機、資料遷移）、SkillGovernanceService（隱藏/撤回邏輯） |
| 整合測試 | Repository + DB | @DataJpaTest + Testcontainers | local_credential 唯一約束、account_merge_request partial unique index、效能索引驗證 |
| API 測試 | Controller | @WebMvcTest + MockMvc | 本地認證端點、合併端點、治理端點、審計日誌查詢 |
| 端到端測試 | 全鏈路 | @SpringBootTest + Testcontainers | 註冊 → 登入 → 合併 → 驗證資料遷移 |

### 13.2 關鍵測試用例

**本地認證：**
- 註冊成功 → user_account + local_credential 建立，自動登入
- 註冊失敗 → 使用者名稱已存在、密碼強度不足、郵箱已佔用
- 登入成功 → Session 建立，failed_attempts 重置
- 登入失敗 → failed_attempts 遞增，5 次後鎖定
- 鎖定期間登入 → 返回 423
- 密碼修改 → 舊密碼校驗、新密碼雜湊、其他 Session 失效

**多賬號合併：**
- 發起合併 → 建立 PENDING 請求，生成驗證令牌
- 驗證副賬號 → 本地密碼驗證 / OAuth 重新授權
- 確認合併 → 資料遷移事務（技能、收藏、角色、Token）
- 合併衝突 → 收藏去重、評分保留最新、角色取並集
- 副賬號已 MERGED → 無法登入

**技能治理：**
- 隱藏技能 → 搜尋不可見，直接連結可訪問
- 恢復技能 → 搜尋重新可見
- 撤回版本 → YANKED 狀態，精確版本可下載
- 撤回 latest → latest_version_id 回退

### 13.3 前端測試

| 型別 | 工具 | 覆蓋重點 |
|------|------|----------|
| 元件測試 | Vitest + React Testing Library | 登入檔單校驗、登入表單、合併嚮導、審計日誌篩選器 |
| Hook 測試 | renderHook | useLocalAuth、useAccountMerge、useAuditLogs |
| 頁面測試 | Vitest + MSW | 註冊/登入互動、合併流程、審計日誌查詢 |

---

## 14. 風險與應對

| 風險 | 應對 |
|------|------|
| 本地認證與 OAuth Session 衝突 | 兩種認證方式共享 Spring Session，透過 `local_credential` 表存在性判斷認證來源，無需額外欄位 |
| 多賬號合併資料不一致 | 合併操作在單個事務中執行，失敗自動回滾；合併前生成資料摘要供使用者確認 |
| BCrypt 效能影響 | strength=12 約 250ms/次，登入介面限流 30 次/分鐘/IP 防暴力破解 |
| Docker 構建快取失效 | 多階段構建 + 依賴層分離，Maven/npm 依賴變更才觸發重新下載 |
| K8s 配置與實際環境差異 | 提供 ConfigMap/Secret 模板，檔案說明必須修改的配置項 |
| 前端程式碼分割導致首屏閃爍 | 公開頁面保留在主 bundle，僅非首屏頁面 lazy load |
| YANKED 版本語義理解偏差 | 檔案明確說明 YANKED ≠ 刪除，精確版本仍可下載 |

---

## 15. 總結

Phase 4 在 Phase 1-3 的基礎上，完成運維增強、安全加固和開源就緒：

**核心價值：**
1. **本地認證** — 獨立的使用者名稱密碼登入體系，降低 OAuth 依賴
2. **多賬號合併** — 安全的賬號關聯機制，支援使用者統一身份
3. **技能治理** — 隱藏/恢復/撤回能力，完善平臺治理閉環
4. **可觀測性** — Prometheus 指標暴露，支援生產環境監控
5. **效能最佳化** — 資料庫索引、預簽名 URL、前端程式碼分割
6. **安全加固** — Session 安全、XSS 防護、安全響應頭
7. **一鍵啟動** — Docker Compose 零配置體驗，clone 即用
8. **開源就緒** — 完整的開源專案基礎設施

**交付策略：**
- 4 個 Chunk 漸進式交付
- Chunk 1（認證）→ Chunk 2（治理）→ Chunk 3（效能安全）→ Chunk 4（部署開源）
- 每個 Chunk 獨立可驗收，風險可控
