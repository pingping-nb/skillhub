# skillhub 認證與授權設計

## 0. 身份標識約束

- `PlatformPrincipal.userId` 必須是穩定的字串標識，而不是 `Long`。
- 使用者身份在系統內的主契約是字串 `userId`；認證、授權、審計、資源 owner 判定都基於該字串進行。
- 外部身份源的 `subject`、企業 SSO UID、工號型字串等都必須可以原樣或經確定性對映後進入系統，禁止先壓縮成自增整數再作為正式使用者主鍵在全鏈路傳播。
- 歷史草案裡的整型使用者主鍵描述全部廢棄，當前認證與授權設計只承認字串身份主鍵。

## 1. 認證架構

```
請求進入
  │
  ▼
┌─────────────────────────────┐
│  Layer 1: OAuth2/OIDC Login │  Spring Security OAuth2 Client
│  (GitHub/GitLab/OIDC 可擴充套件) │  授權碼模式 (Authorization Code)
│  Layer 1b: Session Bootstrap│  顯式被動會話引導（預設關閉）
└─────────────┬───────────────┘
              │ OAuth2User
              ▼
┌─────────────────────────────┐
│  Layer 2: Access Policy     │  准入策略判定
│  (認證成功 ≠ 有權使用平臺)    │  白名單/郵箱域名/開放註冊
└─────────────┬───────────────┘
              │ 准入透過
              ▼
┌─────────────────────────────┐
│  Layer 3: Identity Mapping  │  OAuth2 使用者 → 平臺使用者
│  (查詢/建立 identity_binding) │  自動註冊 + 資訊同步
└─────────────┬───────────────┘
              │ PlatformPrincipal
              ▼
┌─────────────────────────────┐
│  Layer 4: Session / Token   │  Web: Spring Session (Redis)
│                             │  CLI: Device Flow + Bearer Token
└─────────────┬───────────────┘
              │ SecurityContext
              ▼
┌─────────────────────────────┐
│  Layer 5: Authorization     │  RBAC + 資源級判定
└─────────────────────────────┘
```

## 2. 准入策略（Access Policy）

OAuth 認證成功僅代表身份可信，不代表有權使用平臺。准入層在認證成功後、建立平臺使用者前執行。

```java
// 基於 claims 的准入策略，與 Provider 無關
public interface AccessPolicy {
    AccessDecision evaluate(OAuthClaims claims);
}

public record OAuthClaims(
    String provider,          // github, google, wechat
    String subject,           // provider 唯一 ID
    String email,             // nullable（微信等可能無郵箱）
    boolean emailVerified,    // 是否已驗證
    String providerLogin,     // 如 GitHub login
    Map<String, Object> extra
) {}

public enum AccessDecision {
    ALLOW,              // 准入，繼續建立/繫結平臺使用者
    DENY,               // 拒絕，不建立 Session，重定向到拒絕頁
    PENDING_APPROVAL    // 等待管理員審批，不建立業務 Session
}
```

### 2.1 一期支援的策略（透過配置切換）

```yaml
astron:
  access-policy:
    mode: EMAIL_DOMAIN   # OPEN / PROVIDER_ALLOWLIST / EMAIL_DOMAIN / SUBJECT_WHITELIST
    allowed-providers:
      - github
    allowed-email-domains:
      - company.com
      - subsidiary.com
```

| 策略 | 判定依據 | 說明 |
|------|---------|------|
| `OPEN` | 無限制 | 所有 OAuth 登入使用者自動准入 |
| `PROVIDER_ALLOWLIST` | `claims.provider` | 僅允許指定 Provider 登入 |
| `EMAIL_DOMAIN` | `claims.email` + `claims.emailVerified` | 僅允許已驗證郵箱且域名匹配（email 為空或未驗證則 DENY） |
| `SUBJECT_WHITELIST` | `claims.provider` + `claims.subject` | 按 `provider:subject` 白名單，管理員預新增 |

### 2.2 准入失敗處理

- `DENY`：丟擲 `OAuth2AccessDeniedException`，由 `failureHandler` 重定向到 `/access-denied` 頁面。不建立使用者，不建立 Session。
- `PENDING_APPROVAL`：建立 `user_account`（status=`PENDING`），但不建立業務 Session。丟擲 `AccountPendingException`，由 `failureHandler` 重定向到 `/pending-approval` 頁面（純靜態提示頁，無需登入態）。管理員在後臺審批後狀態變為 `ACTIVE`，使用者下次 OAuth 登入才會正常建立 Session。

安全邊界：PENDING / DISABLED / MERGED 使用者和 system account 絕不會透過互動式登入獲得
業務 Session。外部身份命中這些賬號時，在更新使用者資料或載入角色前直接拒絕。

### 2.3 擴充套件性

後續新增 OAuth Provider（Google、GitLab、微信）時，准入策略與 Provider 無關，統一在 AccessPolicy 層判定，不需要重做入駐邏輯。

## 3. Web 認證流程（OAuth2 / OIDC Authorization Code）

```
瀏覽器點選"登入"
    │
    ▼
前端跳轉: /oauth2/authorization/github
    │
    ▼
Spring Security 重定向到 GitHub 授權頁
    │
    ▼
使用者在 GitHub 授權
    │
    ▼
GitHub 回撥: /login/oauth2/code/github?code=xxx&state=xxx
    │
    ▼
Spring Security 自動完成:
  ① 用 code 換取 access_token
  ② 呼叫 GitHub API 獲取使用者資訊
  ③ 觸發自定義 OAuth2UserService
    │
    ▼
CustomOAuth2UserService / CustomOidcUserService:
  ① 從 OAuth2User 提取 provider + externalId → 構建 OAuthClaims
  ② AccessPolicy.evaluate(claims) → 准入判定
  │
  ├── DENY → 丟擲 OAuth2AccessDeniedException → failureHandler 重定向 /access-denied（不建立 Session）
  ├── PENDING_APPROVAL → 建立 PENDING 使用者 → 丟擲 AccountPendingException → failureHandler 重定向 /pending-approval（不建立 Session）
  └── ALLOW ↓
  │
  ③ 查詢 identity_binding 是否已繫結
  ├── 已繫結 → 載入平臺使用者，檢查使用者狀態（DISABLED → 拋異常），同步最新頭像/暱稱
  └── 未繫結 → 建立 user_account(ACTIVE) + identity_binding
    │
    ▼
AuthenticationSuccessHandler:
  ① 建立 Spring Session (Redis)
  ② 重定向到前端頁面 (可配置的 redirect_uri)
```

OIDC 登入沿用同一條業務鏈路，但由 Spring Security 的 `oidcUserService`
分支處理。`CustomOidcUserService` 會把標準 OIDC claims 對映為
`OAuthClaims`：

- `provider`：Spring OAuth2 client registration id，例如 `okta`、`keycloak`
  或 `oidc`
- `subject`：OIDC `sub`
- `email` / `emailVerified`：`email` 與 `email_verified`
- `providerLogin`：優先 `preferred_username`，其次 `name`、`email`、`sub`
- `picture` 會同步為 `avatar_url`，供現有頭像同步邏輯複用

因此 OIDC 不需要新增資料庫表；現有 `identity_binding(provider_code,
subject)` 可以儲存任意 OIDC issuer 下的穩定使用者標識。不同 IdP 應使用不同
registration id，避免多個 issuer 的 `sub` 值空間混用。

### 3.1 統一 Session 建立約束

所有 Web 登入入口都必須透過統一的 `PlatformSessionService` 建立登入態，包括：

- 本地使用者名稱密碼登入
- OAuth 登入成功回撥
- `POST /api/v1/auth/direct/login`
- `POST /api/v1/auth/session/bootstrap`
- 本地開發態 `MockAuthFilter`

統一約束如下：

- 統一寫入 `platformPrincipal`
- 統一寫入 `SPRING_SECURITY_CONTEXT`
- 統一透過 `HttpSession` 持久化，確保 Spring Session Redis 能無差別接管
- 互動式登入預設呼叫 `changeSessionId()`，降低 session fixation 風險
- 已由 Spring Security 完成認證的入口可以複用現有 `Authentication`，避免重複構造認證結果

這意味著未來私有版新增企業 SSO provider 時，只能擴充套件認證來源本身，不能繞開統一的 session 建立服務直接操作 Session。

## 3.3 Session Bootstrap 擴充套件點

為了相容未來私有部署中的企業 SSO 被動登入，開源版預留顯式會話引導協議：

- 介面：`POST /api/v1/auth/session/bootstrap`
- 用途：前端在同域場景下顯式觸發一次“讀取外部會話並嘗試換取 skillhub Session”的流程
- 預設狀態：關閉，開源版不提供任何 `PassiveSessionAuthenticator` 實現
- 安全邊界：預設不做全域性自動登入 filter，避免匿名訪問時隱式建會話、放大 CSRF 和審計複雜度

擴充套件介面如下：

```java
public interface PassiveSessionAuthenticator {
    String providerCode();
    Optional<PlatformPrincipal> authenticate(HttpServletRequest request);
}
```

約束如下：

- `authenticate()` 只負責驗證外部被動會話並返回平臺登入所需主體
- 是否允許啟用該入口由 `skillhub.auth.session-bootstrap.enabled` 控制，預設 `false`
- 未啟用時介面返回 `403`
- 啟用但 provider 不受支援時返回 `400`
- 啟用但請求中不存在有效外部會話時返回 `401`
- 成功時建立標準 Spring Security Session，並返回與 `/api/v1/auth/me` 一致的使用者結構

## 3.4 Direct Authentication 擴充套件點

為相容未來“前端收集使用者名稱密碼，後端呼叫企業 SSO / RPC 校驗”的私有部署模式，開源版增加預設關閉的直連認證抽象：

```java
public interface DirectAuthProvider {
    String providerCode();
    PlatformPrincipal authenticate(DirectAuthRequest request);
}
```

對應公共協議：

- `POST /api/v1/auth/direct/login`

約束如下：

- 開源版預設關閉，由 `skillhub.auth.direct.enabled` 控制
- 關閉時返回 `403`
- provider 不受支援時返回 `400`
- provider 認證失敗時沿用 provider 自身的認證異常語義
- 成功時建立標準 Session，並返回與 `/api/v1/auth/me` 一致的使用者結構
- 現有 `/api/v1/auth/local/login` 保持不變，相容層只是新增可選入口

### 3.5 Spring Security 配置要點

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(info -> info
                    .userService(customOAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
                .failureHandler(oAuth2FailureHandler)
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .ignoringRequestMatchers("/api/v1/**"))
            // ...
        ;
    }
}
```

### 3.6 OAuth2 Provider 擴充套件設計

一期只實現 GitHub，但架構支援後續擴充套件：

```yaml
# application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          github:
            client-id: ${OAUTH2_GITHUB_CLIENT_ID}
            client-secret: ${OAUTH2_GITHUB_CLIENT_SECRET}
            scope: read:user,user:email
          # 二期擴充套件示例:
          # gitlab:
          #   client-id: ...
          #   authorization-grant-type: authorization_code
          # google:
          #   client-id: ...
```

Spring Security OAuth2 Client 原生支援多 Provider 並存，新增 Provider 只需：
1. `application.yml` 新增 registration 配置
2. `CustomOAuth2UserService` 中按 `registrationId` 分支處理使用者屬性對映
3. 前端登入頁增加對應按鈕（透過 `/api/v1/auth/providers` 自動發現）

## 4. 核心介面設計

```java
// 自定義 OAuth2 使用者服務，處理准入 + 使用者對映
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) {
        OAuth2User oAuth2User = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId();

        // 提取標準化 claims（傳入 accessToken 用於呼叫 Provider API，如 GitHub /user/emails）
        OAuthClaims claims = OAuthClaimsExtractor.extract(registrationId, oAuth2User, request.getAccessToken());

        // 准入策略判定（基於 claims，與 Provider 無關）
        AccessDecision decision = accessPolicy.evaluate(claims);
        if (decision == AccessDecision.DENY) {
            throw new OAuth2AccessDeniedException("Access denied by policy");
        }
        if (decision == AccessDecision.PENDING_APPROVAL) {
            // 建立 PENDING 使用者但不返回有效 principal，不建立業務 Session
            identityBindingService.createPendingUser(registrationId, claims);
            throw new AccountPendingException("Account pending approval");
        }

        // 繫結或建立平臺使用者（僅 ALLOW 才走到這裡）
        UserAccount account = identityBindingService.bindOrCreate(registrationId, claims);
        if (account.getStatus() == UserStatus.DISABLED) {
            throw new AccountDisabledException("Account is disabled");
        }

        return new PlatformOAuth2User(account, oAuth2User.getAuthorities());
    }
}

// 按 Provider 提取標準化 claims（每個 Provider 有自己的可信欄位契約）
public class OAuthClaimsExtractor {
    public static OAuthClaims extract(String registrationId, OAuth2User user,
                                      OAuth2AccessToken accessToken) {
        return switch (registrationId) {
            case "github" -> extractGitHub(user, accessToken);
            // 後續擴充套件其他 Provider
            default -> throw new OAuth2AuthenticationException("Unsupported provider: " + registrationId);
        };
    }

    // GitHub: 公開 email 可能為空，需呼叫 /user/emails API 獲取已驗證郵箱
    private static OAuthClaims extractGitHub(OAuth2User user, OAuth2AccessToken accessToken) {
        String verifiedEmail = GitHubEmailFetcher.fetchVerifiedEmail(accessToken);
        return new OAuthClaims(
            "github",
            String.valueOf(user.getAttribute("id")),
            verifiedEmail,                    // 從 /user/emails 獲取的已驗證郵箱，可能為 null
            verifiedEmail != null,            // 只有確認 verified 才為 true
            user.getAttribute("login"),
            Map.of("avatar_url", user.getAttribute("avatar_url"))
        );
    }

    // GitHubEmailFetcher: 呼叫 GitHub /user/emails API，
    // 返回 primary + verified 的郵箱，無則返回 null
}
```

### 4.1 多 Provider 賬號合併策略

同一個員工透過不同 OAuth Provider 登入時，可能產生多個 `user_account`。

一期策略：預設關閉自動合併，僅支援管理員手動合併。

- 一期 GitHub-only：不需要自動合併，每個 Provider 登入獨立建立使用者
- 多 Provider 上線時，再引入顯式繫結/合併流程（使用者主動發起 + 郵箱驗證確認）
- 管理員可在後臺手動合併兩個 user_account（合併 identity_binding、遷移 skill ownership、合併角色取並集）

合併操作規則：
- 合併操作寫入審計日誌
- 合併後原 user_account 標記為 `MERGED`，保留記錄不物理刪除
- 不提供按 email 自動合併；即使 Provider 宣告 email 已驗證，也不能替代對兩個賬號控制權
  的分別證明。未來繫結/合併必須使用顯式、可審計的重新認證流程。

## 5. CLI 認證（OAuth Device Flow + 平臺憑證）

CLI 主認證基線調整為 OAuth Device Flow。使用者在 CLI 中發起授權，瀏覽器側完成登入與確認，CLI 輪詢後獲取平臺簽發的憑證並訪問 CLI API。

- 發起：CLI 請求 device code，展示 `user_code` 與驗證地址
- 授權：使用者在瀏覽器完成 GitHub OAuth 登入並確認繫結
- 輪詢：CLI 使用 `device_code` 輪詢授權結果
- 完成：服務端簽發 CLI 可用憑證，CLI 持 `Authorization: Bearer <token>` 呼叫後續介面

API Token 仍保留，但定位從“CLI 唯一認證方式”調整為“平臺通用憑證能力”：

- 用途：自動化指令碼、相容層呼叫、手工 Token 管理、後續系統整合
- 儲存：只存 SHA-256 雜湊，明文只展示一次
- 校驗：從 `Authorization: Bearer <token>` 提取 → 雜湊比對 → 載入關聯使用者 → 檢查使用者狀態
- 失敗閉合與身份優先順序：共享認證過濾器只識別 Bearer scheme。有效 Bearer 覆蓋已載入的 Web Session 身份；Bearer 為空、格式錯誤、未知、過期、已吊銷、使用者缺失或使用者禁用時立即返回 401，即使存在有效 Session 也不得回退。缺少 `Authorization` 頭或使用 Basic/其他非 Bearer scheme 時保留有效 Session；若無 Session，公共讀介面按匿名訪問，`whoami` 返回 401
- 作用域：`skill:read`, `skill:publish`, `skill:delete`, `token:manage`
- 拒絕原因：API Token 缺少作用域或不能訪問某個介面時，403 響應返回本地化的安全原因和 `requestId`；其他授權失敗仍返回通用資訊，避免暴露內部異常

> **一期作用域說明（非最小許可權）**：一期 Token 作用域為粗粒度動作級別，不與 namespace 繫結。Token 繼承使用者的全部許可權——如果使用者是某個 namespace 的 MEMBER，則該使用者的任何 Token（只要包含 `skill:publish` scope）都可以向該 namespace 發布技能。這是有意的一期簡化，不滿足最小許可權原則。後續版本計劃引入 namespace 級別的 Token 作用域限定（如 `namespace:ai-team:skill:publish`），或透過 `api_token_scope` 子表實現 Token 與 namespace 的繫結。

## 6. RBAC 授權判定

```
許可權判定 = 平臺角色許可權（role → permission 查詢） ∪ 名稱空間角色（namespace_member.role）
```

一期即上線完整 RBAC，平臺角色按最小許可權拆分：

| 平臺角色 | 職責 |
|---------|------|
| `SUPER_ADMIN` | 全部許可權，硬判定短路 |
| `SKILL_ADMIN` | 全域性空間稽核、提升稽核、隱藏/恢復技能、撤回已發布版本 |
| `USER_ADMIN` | 准入審批、封禁/解封、角色分配（不可分配 SUPER_ADMIN） |
| `AUDITOR` | 審計日誌只讀 |

- 名稱空間許可權仍由 `namespace_member.role`（OWNER / ADMIN / MEMBER）決定
- 一個使用者可持有多個平臺角色
- 普通使用者無平臺角色，僅透過 namespace 成員關係獲得操作許可權

判定邏輯：
1. 從 SecurityContext 獲取當前使用者
2. 檢查使用者狀態（`DISABLED` → 拒絕所有操作）
3. 查詢使用者的平臺角色（`user_role_binding` → `role` → `role_permission`）
4. `SUPER_ADMIN` 短路：直接透過所有許可權檢查
5. 如果涉及名稱空間資源，查詢使用者在該名稱空間的角色（`namespace_member.role`）
6. 檢查名稱空間狀態（`FROZEN` → 拒絕寫操作）
7. 合併平臺許可權 + 名稱空間角色，判定是否滿足

| 操作 | 所需許可權 | 判定邏輯 |
|------|---------|---------|
| 發布技能包 | `skill:publish` | 普通使用者要求是目標 namespace 成員；`SUPER_ADMIN` 可繞過成員校驗並直髮 |
| 提交已有版本進入稽核 | `review:submit` | owner 本人，或 namespace `ADMIN` / `OWNER`，或 `SKILL_ADMIN` / `SUPER_ADMIN` |
| 管理技能（歸檔/版本管理） | `skill:manage` | namespace ADMIN 以上，或 owner 本人 |
| 提升到全域性 | `skill:promote` | namespace ADMIN 以上，或 owner 本人 |
| 稽核技能發布 | `review:approve` | namespace `ADMIN` / `OWNER`，或 `SKILL_ADMIN` / `SUPER_ADMIN`；提交人本人僅 `SUPER_ADMIN` 可稽核自己的 review task |
| 稽核提升申請 | `promotion:approve` | 持有 SKILL_ADMIN / SUPER_ADMIN |
| 隱藏/恢復技能 | `skill:manage` | 僅 `SUPER_ADMIN` |
| 撤回已發布版本（YANK） | `skill:manage` | `SKILL_ADMIN` / `SUPER_ADMIN` |
| 管理使用者角色 | `user:manage` | 持有 USER_ADMIN / SUPER_ADMIN |
| 審批使用者准入 | `user:approve` | 持有 USER_ADMIN / SUPER_ADMIN |
| 檢視審計日誌 | `audit:read` | 持有 AUDITOR / SUPER_ADMIN |

許可權主軸說明：
- namespace role 是許可權主軸，namespace ADMIN 對空間內所有 skill 有完整管理權，不受 owner 限制
- `owner_id` 語義為"主要維護人"，owner 作為 MEMBER 時僅可管理自己建立的 skill
- 企業場景人員流動頻繁，owner 離職後 namespace ADMIN 仍能完整管理所有技能

### 6.1 稽核與提升 API 路徑適用範圍

| API 路徑 | 適用範圍 | 許可權要求 |
|----------|---------|---------|
| `POST /api/v1/reviews/{id}/approve` | 技能發布稽核 | namespace `ADMIN` / `OWNER`，或 `SKILL_ADMIN` / `SUPER_ADMIN` |
| `POST /api/v1/promotions/{id}/approve` | 提升到全域性稽核 | `SKILL_ADMIN` / `SUPER_ADMIN` |
| `GET /api/v1/admin/audit-logs` | 審計日誌查詢 | AUDITOR / SUPER_ADMIN |
| `PUT /api/v1/admin/users/{id}/roles` | 使用者角色管理 | USER_ADMIN / SUPER_ADMIN |
| `POST /api/v1/admin/users/{id}/approve` | 使用者准入審批 | USER_ADMIN / SUPER_ADMIN |

當前實現中，稽核與提升都走統一 portal API；是否允許操作由服務層根據 namespace role 與 platform role 聯合判定，而不是靠分叉路由表達。

## 7. Session 設計

- 儲存：Spring Session + Redis（必須，多 Pod 環境剛需）
- 序列化：JSON
- 過期：預設 8 小時，Redis TTL 自動清理

### 7.1 Session 內容

Session 中儲存以下欄位：
- `userId`：平臺使用者 ID
- `displayName`：展示名
- `oauthProvider`：登入使用的 OAuth Provider
- `currentNamespaceId`：當前選中的名稱空間（可選）
- `platformRoles`：平臺角色列表（如 `["SKILL_ADMIN", "AUDITOR"]`），登入時從 `user_role_binding` → `role` 查詢寫入
- `roleVersion`：角色版本號，用於快取一致性

### 7.2 角色快取一致性機制

平臺角色變更需要即時生效（如撤銷稽核許可權），不能等 Session 過期：

1. 每次請求時從 Session 讀取 `roleVersion`
2. 與 Redis 中的 `user:{userId}:roleVersion` 比對
3. 版本一致 → 直接使用 Session 中的 `platformRoles`
4. 版本不一致 → 從資料庫重新載入角色，更新 Session

管理員修改使用者角色時，遞增 Redis 中該使用者的 `roleVersion`。

## 8. CSRF 防護

採用 Cookie-to-Header 模式：
- 後端設定 `XSRF-TOKEN` Cookie（`HttpOnly=false`）
- 前端從 Cookie 讀取 Token，放入請求 Header `X-XSRF-TOKEN`
- 後端校驗 Header 與 Cookie 是否一致
- CLI API（`/api/v1/**`）與相容層（`/api/v1/**`）豁免 CSRF（使用 Bearer Token，無 Cookie）

## 9. 前端許可權控制

### 9.1 `/api/v1/auth/me` 響應結構

```json
{
  "code": 0,
  "msg": "獲取成功",
  "data": {
    "userId": "usr_42",
    "displayName": "zhangsan",
    "email": "zhangsan@company.com",
    "avatarUrl": "https://...",
    "oauthProvider": "local",
    "canChangePassword": true,
    "platformRoles": ["SKILL_ADMIN", "AUDITOR"]
  },
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

前端平臺級許可權判定基於 `platformRoles`；是否展示修改密碼入口和表單基於後端返回的 `canChangePassword`。後端透過 `role_permission` 表查詢許可權碼。

統一約束：
- `/api/v1/auth/me`、`/api/v1/auth/providers` 等 JSON 響應必須統一使用 `code/msg/data/timestamp/requestId` 外層結構。
- `/api/v1/auth/session/bootstrap` 也必須遵守同一統一響應結構。
- `msg` 必須走 Spring Boot 標準 `MessageSource` i18n 機制。
- locale 必須透過請求上下文自動獲取，不在 controller 中顯式傳遞。
- 認證失敗返回 `401`，但 JSON 外層結構仍保持一致，例如 `{"code":401,"msg":"需要先登入","data":null,...}`。

### 9.2 usePermission() Hook

```typescript
function usePermission() {
  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchMe })

  const hasRole = (role: string) => me?.platformRoles.includes(role) ?? false
  const isSuperAdmin = () => hasRole('SUPER_ADMIN')
  const isSkillAdmin = () => hasRole('SKILL_ADMIN') || isSuperAdmin()
  const isUserAdmin = () => hasRole('USER_ADMIN') || isSuperAdmin()
  const isAuditor = () => hasRole('AUDITOR') || isSuperAdmin()

  return {
    isLoggedIn: !!me,
    isSuperAdmin,
    isSkillAdmin,
    isUserAdmin,
    isAuditor,

    // 名稱空間角色判定
    getNamespaceRole: (slug: string) =>
      me?.namespaces.find(n => n.slug === slug)?.role,
    isNamespaceAdmin: (slug: string) =>
      ['OWNER', 'ADMIN'].includes(me?.namespaces.find(n => n.slug === slug)?.role ?? ''),
    isNamespaceMember: (slug: string) =>
      ['OWNER', 'ADMIN', 'MEMBER'].includes(me?.namespaces.find(n => n.slug === slug)?.role ?? ''),
  }
}
```

### 9.3 路由級守衛

在 TanStack Router `beforeLoad` 中判定：

| 路由 | 條件 |
|------|------|
| `/dashboard/*` | 已登入 |
| `/dashboard/namespaces/{slug}/reviews` | 已登入 + 該 namespace 的 ADMIN 以上 |
| `/admin/*` | 已登入 + 持有任一平臺角色（SUPER_ADMIN / SKILL_ADMIN / USER_ADMIN / AUDITOR） |

不滿足條件時：未登入 → 重定向登入；已登入但無許可權 → 顯示 403 頁面。

### 9.4 操作級控制

| 場景 | 判定邏輯 | UI 行為 |
|------|---------|---------|
| 技能詳情頁"提交發布"按鈕 | `isNamespaceMember(namespace)` | 非成員不顯示 |
| 稽核列表"透過/拒絕"按鈕 | 團隊空間：`isNamespaceAdmin(namespace)`；全域性空間：`isSkillAdmin()` | 無許可權不顯示 |
| 使用者管理頁 | `isUserAdmin()` | 無許可權不顯示 |
| 使用者管理頁"設為 SUPER_ADMIN" | `isSuperAdmin()` | 僅超管可見 |
| 審計日誌頁 | `isAuditor()` | 無許可權不顯示 |
| 技能詳情頁"歸檔"按鈕 | `isNamespaceAdmin(namespace)` 或當前使用者是 owner | 否則不顯示 |
| 名稱空間"新增成員"按鈕 | `isNamespaceAdmin(namespace)` | 非管理員不顯示 |
| 收藏/評分按鈕 | `isLoggedIn` | 未登入時點選提示登入 |

### 9.5 登入互動

```
前端登入按鈕
    │
    ▼
window.location.href = '/oauth2/authorization/github'
    │
    ▼
(後端 OAuth2 流程，使用者無感)
    │
    ▼
回撥後重定向到前端 (如 /?login=success)
    │
    ▼
前端檢測 URL 引數 → 呼叫 /api/v1/auth/me → 更新登入態
```

前端無需引入額外 OAuth 庫，登入流程完全由後端 Spring Security 處理。前端只需：
- 呼叫 `/api/v1/auth/providers` 獲取可用 Provider 列表，動態渲染登入按鈕
- 處理登入後的重定向
- 透過 `/api/v1/auth/me` 檢測登入狀態

### 9.6 安全邊界原則

- 前端許可權控制是 UX 最佳化，不是安全邊界
- 後端每個寫操作介面獨立校驗許可權，不信任前端判定
- 前端隱藏按鈕 ≠ 安全，使用者可以直接調 API，後端必須攔截

## 10. 許可權矩陣（完整）

以下矩陣列出每個 API 介面的許可權判定來源，作為後端實現的唯一參考。

### 10.1 Public API（匿名可訪問）

| 介面 | 匿名 | 已登入 | 判定邏輯 |
|------|------|--------|---------|
| `GET /api/v1/skills`（搜尋） | 僅 `PUBLIC`，且僅搜尋 `ACTIVE`、非 hidden、已索引 skill | `PUBLIC + NAMESPACE_ONLY（成員空間）+ PRIVATE（owner/admin）` | `SearchVisibilityScope` + 搜尋索引狀態 |
| `GET /api/v1/skills/{ns}/{slug}` | 僅已發布且可見的 `PUBLIC` skill | 同左，另加 owner 可讀未發布 skill、namespace `ADMIN` / `OWNER` 可讀 hidden | `visibility + latest_version_id + hidden + namespace 成員關係` |
| `GET /api/v1/skills/{ns}/{slug}/versions` | 僅 `PUBLISHED` 版本 | owner / namespace `ADMIN` / `OWNER` 可見全部五種狀態 | 同上 + version status 過濾 |
| `GET /api/v1/skills/{ns}/{slug}/download` | 僅 `PUBLIC`、`ACTIVE`、非 hidden、名稱空間未歸檔且目標版本可安裝的 skill 支援匿名下載 | 已登入後按 visibility 判定；下載目標版本必須可安裝 | visibility + namespace status + `SkillInstallability` |
| `GET /api/v1/skills/{ns}/{slug}/resolve` | 僅 `PUBLIC`、`ACTIVE`、非 hidden、名稱空間未歸檔且目標版本可安裝的 skill 可匿名 | 同上 | visibility + namespace status + `SkillInstallability` |
| `GET /api/v1/namespaces` | 全部 | 全部 | 無限制 |

### 10.2 Authenticated API

| 介面 | 所需許可權 | 判定來源 |
|------|---------|---------|
| `POST /api/v1/skills/{ns}/{slug}/star` | 已登入 | Session/Token |
| `POST /api/v1/skills/{ns}/{slug}/rating` | 已登入 | Session/Token |
| `POST /api/v1/reviews` | owner 本人，或 namespace `ADMIN` / `OWNER`，或 `SKILL_ADMIN` / `SUPER_ADMIN` | `skill.owner_id` / `namespace_member.role` / platform roles |
| `POST .../versions/{ver}/withdraw-review` | 提交人本人 | `review_task.submitted_by` |
| `PUT /api/v1/skills/{ns}/{slug}/tags/{tag}` | namespace ADMIN 以上 或 owner | `namespace_member.role` 或 `skill.owner_id` |
| `POST /api/v1/skills/{ns}/{slug}/archive` | namespace ADMIN 以上 或 owner | `namespace_member.role` 或 `skill.owner_id` |
| `POST .../versions/{ver}/rerelease` | namespace ADMIN 以上 或 owner；源版本必須 `PUBLISHED` | `namespace_member.role` 或 `skill.owner_id` + `skill_version.status` |
| `DELETE .../versions/{ver}` | namespace ADMIN 以上 或 owner（僅 `DRAFT` / `REJECTED`） | `namespace_member.role` 或 `skill.owner_id` + `skill_version.status` |

### 10.3 CLI API

| 介面 | 憑證規則 | 授權與錯誤語義 |
|------|---------|---------------|
| `GET /api/cli/v1/auth/whoami` | 有效 Web Session 或有效 Bearer Token | 無有效身份返回 401；壞 Bearer 即使存在 Session 也返回 401 |
| `GET /api/cli/v1/skills/search` | Session 可用；無 Session 時可匿名；提供 Bearer 時必須有效 | 匿名僅返回公開可安裝 skill；有效 Bearer 覆蓋 Session；壞 Bearer 返回 401，不得降級 |
| `GET /api/cli/v1/skills/{namespace}/{slug}/resolve` | Session 可用；無 Session 時可匿名讀取公開資源；提供 Bearer 時必須有效 | 有效 Bearer 覆蓋 Session；壞 Bearer 返回 401；有效身份無資源許可權返回 403 |
| `GET /api/cli/v1/skills/{namespace}/{slug}/download` | Session 可用；無 Session 時可匿名下載公開資源；提供 Bearer 時必須有效 | 有效 Bearer 覆蓋 Session；壞 Bearer 返回 401；有效身份無資源許可權返回 403 |
| `GET /api/cli/v1/skills/{namespace}/{slug}/versions/{version}/download` | Session 可用；無 Session 時可匿名下載公開資源；提供 Bearer 時必須有效 | 有效 Bearer 覆蓋 Session；壞 Bearer 返回 401；有效身份無資源許可權返回 403 |

Spring Security 先載入 Web Session 身份，共享 API token 過濾器隨後只處理 Bearer scheme。有效 Bearer 會覆蓋 Session，確保請求使用 token 的使用者、角色與 scope；Bearer 為空、格式錯誤、未知、過期、已撤銷、使用者缺失或使用者禁用時，過濾器清除當前身份並立即返回 401，不能回退到 Session 或匿名身份。完全缺少 `Authorization` 頭或使用 Basic/其他非 Bearer scheme 時，過濾器不改變已有 Session；如果 Session 也不存在，公共讀介面按匿名身份執行，而 `whoami` 返回 401。身份已驗證但 token scope 或資源可見性不足時返回 403；服務端不向客戶端區分 token 不存在、過期或已撤銷。`whoami.email` 欄位始終存在，但沒有可用郵箱時值為 `null`。

### 10.4 Admin API

| 介面 | 所需平臺角色 | 判定來源 |
|------|------------|---------|
| `POST /api/v1/admin/skills/{id}/hide` | SUPER_ADMIN | `user_role_binding` → `role_permission` |
| `POST /api/v1/admin/skills/{id}/unhide` | SUPER_ADMIN | 同上 |
| `POST /api/v1/admin/skills/versions/{versionId}/yank` | SKILL_ADMIN / SUPER_ADMIN | 同上 |
| `PUT /api/v1/admin/users/{id}/roles` | USER_ADMIN / SUPER_ADMIN | 同上，且 USER_ADMIN 不可分配 SUPER_ADMIN |
| `POST /api/v1/admin/users/{id}/approve` | USER_ADMIN / SUPER_ADMIN | 同上 |
| `POST /api/v1/admin/users/{id}/ban` | USER_ADMIN / SUPER_ADMIN | 同上 |
| `GET /api/v1/admin/audit-logs` | AUDITOR / SUPER_ADMIN | 同上 |

### 10.5 Namespace API

| 介面 | 所需 namespace 角色 | 判定來源 |
|------|-------------------|---------|
| `POST /api/v1/namespaces/{slug}/members` | 該空間 ADMIN 以上 | `namespace_member.role` |
| `DELETE /api/v1/namespaces/{slug}/members/{userId}` | 該空間 ADMIN 以上 | `namespace_member.role` |
| `POST /api/v1/promotions` | 該空間 ADMIN 以上 或 owner | `namespace_member.role` 或 `skill.owner_id` |

### 10.6 Compatibility API（Bearer Token 認證）

| 介面 | 所需憑證 | 額外判定 |
|------|---------|---------|
| `GET /api/v1/whoami` | 任意有效 Bearer Token | 無 |
| `GET /api/v1/search` | 可選（匿名限 PUBLIC） | `SearchVisibilityScope` |
| `GET /api/v1/resolve` | 可選（匿名僅限 `PUBLIC`、`ACTIVE`、非 hidden、名稱空間未歸檔且目標版本可安裝） | visibility + namespace status + `SkillInstallability` |
| `GET /api/v1/download/{slug}/{version}` | 可選（匿名僅限 `PUBLIC`、`ACTIVE`、非 hidden、名稱空間未歸檔且目標版本可安裝） | visibility + namespace status + `SkillInstallability` |
| `POST /api/v1/publish` | Bearer Token + `skill:publish` | 普通使用者要求目標 namespace 成員；`SUPER_ADMIN` 可繞過（namespace 由 canonical slug 解析） |
