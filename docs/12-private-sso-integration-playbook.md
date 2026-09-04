# 私有 SSO 接入相容層實施手冊

## 1. 檔案目的

本檔案面向兩類讀者：

- 後續在私有倉庫中接入企業 SSO 的開發者
- 需要基於當前開源版相容層繼續開發的 coding agent

本檔案不是認證架構總覽，而是實施手冊。目標是讓後續執行者在不瞭解全部歷史上下文的情況下，也能基於當前成果直接開始接入工作，並且儘量把私有倉庫與開源倉庫的差異控制在 provider 實現層和少量配置層。

相關檔案：

- [03-authentication-design.md](/Users/xudongsun/github/skillhub/docs/03-authentication-design.md)
- [06-api-design.md](/Users/xudongsun/github/skillhub/docs/06-api-design.md)
- [08-frontend-architecture.md](/Users/xudongsun/github/skillhub/docs/08-frontend-architecture.md)
- [11-auth-extensibility-and-private-sso.md](/Users/xudongsun/github/skillhub/docs/11-auth-extensibility-and-private-sso.md)

## 2. 當前上下文與已確認約束

本輪改造的真實目標不是在開源版裡實現私有 SSO，而是先把開源版前後端改造成一個穩定的相容接入層。

已經確認的業務前提如下：

- 私有 SSO 能返回穩定且唯一的 UID
- 使用者名稱密碼校驗介面與基於 Cookie 的會話校驗介面都返回同一個 UID
- SkillHub 私有版與私有 SSO 會部署在統一主域下，例如 `skill.xxx.com` 與 `sso.xxx.com`
- 私有版可以透過內部介面或 RPC 呼叫 SSO 的使用者名稱密碼校驗能力
- 首次 SSO 登入自動建立 SkillHub 賬號
- 不考慮賬號合併
- 不依賴 email 欄位
- 不要求聯動登出，但可保留低優先順序擴充套件點

這意味著後續私有 SSO 的正確接入方式是：

- 把 SSO 建模為新的認證來源 `private-sso`
- 用 `providerCode + subject` 表示外部身份，其中 `subject` 就是 SSO UID
- 複用當前平臺的統一 Session 建立邏輯，而不是再造一套登入態機制

## 3. 當前相容層已經提供了什麼

### 3.1 後端擴充套件點

當前開源版已經提供以下後端相容能力：

- `DirectAuthProvider`
  - 用於“前端收集使用者名稱密碼，後端呼叫外部系統校驗”的模式
- `PassiveSessionAuthenticator`
  - 用於“瀏覽器自動帶上 SSO Cookie，後端讀取請求並向 SSO 校驗”的模式
- `PlatformSessionService`
  - 用於統一建立 SkillHub Web Session
- `LogoutPropagationHandler`
  - 用於未來低優先順序登出聯動

關鍵程式碼位置：

- [DirectAuthProvider.java](/Users/xudongsun/github/skillhub/server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/direct/DirectAuthProvider.java)
- [PassiveSessionAuthenticator.java](/Users/xudongsun/github/skillhub/server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/bootstrap/PassiveSessionAuthenticator.java)
- [PlatformSessionService.java](/Users/xudongsun/github/skillhub/server/skillhub-auth/src/main/java/com/iflytek/skillhub/auth/session/PlatformSessionService.java)

### 3.2 後端公共協議

當前開源版已經提供以下相容協議：

- `POST /api/v1/auth/direct/login`
- `POST /api/v1/auth/session/bootstrap`
- `GET /api/v1/auth/methods`

這些協議的設計原則如下：

- 預設關閉
- 預設沒有私有 SSO 實現
- 啟用後由 provider 擴充套件驅動
- 成功後統一建立標準 Spring Security Session
- 不替換現有 `/api/v1/auth/local/login`
- 不替換現有 OAuth 登入

### 3.3 前端相容層

當前開源版前端已經支援透過執行時配置開啟相容入口：

- `SKILLHUB_WEB_AUTH_DIRECT_ENABLED`
- `SKILLHUB_WEB_AUTH_DIRECT_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_ENABLED`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_AUTO`

前端設計原則如下：

- 預設不啟用任何私有登入入口
- 開啟後透過相容層切換，不破壞現有登入頁預設行為
- 優先走統一目錄介面 `/api/v1/auth/methods`
- 被動會話登入優先使用顯式 bootstrap，而不是頁面載入時偷偷嘗試多次

## 4. 私有 SSO 的推薦接入方案

### 4.1 推薦總策略

最佳實踐不是隻選一種方式，而是同時支援兩條鏈路：

1. 主路徑：`DirectAuthProvider`
   - 登入頁展示企業 SSO 使用者名稱密碼錶單
   - 後端透過內部介面或 RPC 呼叫私有 SSO 校驗
   - 校驗成功後給使用者建立 SkillHub Session

2. 補充路徑：`PassiveSessionAuthenticator`
   - 當使用者已經在 SSO 系統登入過，並且瀏覽器會自動帶上共享 Cookie 時
   - 登入頁允許使用者主動點選“從企業 SSO 登入”
   - 或在非常謹慎的前提下自動嘗試一次 bootstrap

這樣做的理由：

- 覆蓋“尚未登入 SSO”和“已登入 SSO”兩種使用者狀態
- 不依賴瀏覽器一定已持有 Cookie
- 不把所有登入成功率押在 Cookie 域、SameSite、過期策略等細節上
- 不改變開源版原始登入邏輯

### 4.2 不推薦的做法

以下做法不建議在私有版採用：

- 在全域性 servlet filter 中對所有匿名請求自動嘗試 SSO 登入
- 直接在 controller、filter 或 provider 裡手寫 `HttpSession` 和 `SecurityContext` 邏輯
- 把私有 SSO 的 UID 對映成臨時整數 ID 再作為使用者主標識
- 按 email 自動合併賬號
- 讓前端直接呼叫私有 SSO 的內部校驗介面
- 為私有版新增一整套與開源版平行的“私有登入 session 機制”

## 5. 私有版最小差異實施方案

### 5.1 後端應新增什麼

私有倉庫建議只新增以下實現類，不改主鏈路：

1. 一個 `DirectAuthProvider` 實現
2. 一個 `PassiveSessionAuthenticator` 實現
3. 可選的 `LogoutPropagationHandler` 實現
4. 私有配置屬性類或私有配置項
5. 若 SSO 返回的是外部 UID 而不是現成平臺使用者，需要補充“根據 SSO UID 查詢或建立平臺使用者”的私有服務

建議命名示例：

- `PrivateSsoDirectAuthProvider`
- `PrivateSsoPassiveSessionAuthenticator`
- `PrivateSsoLogoutPropagationHandler`
- `PrivateSsoProperties`
- `PrivateSsoIdentityService`

不建議修改這些公共類的職責：

- `PlatformSessionService`
- `LocalAuthController`
- `AuthController`
- `SecurityConfig`

### 5.2 後端建議實現步驟

#### 步驟 1：定義 provider code

私有版統一使用穩定 provider code：

```text
private-sso
```

要求：

- `DirectAuthProvider.providerCode()` 和 `PassiveSessionAuthenticator.providerCode()` 返回同一個值
- 不要為“使用者名稱密碼登入”和“Cookie 登入”定義兩個不同 provider code
- 如需更友好的登入頁文案，請同時覆蓋 provider 的 `displayName()`，避免前端再維護一份私有顯示名對映

#### 步驟 2：封裝 SSO 客戶端

不要在 provider 實現裡直接散落 HTTP 或 RPC 呼叫。建議先抽一層私有客戶端：

```java
public interface PrivateSsoClient {
    PrivateSsoUser verifyPassword(String username, String password);
    Optional<PrivateSsoUser> verifySession(HttpServletRequest request);
}
```

其中 `PrivateSsoUser` 至少應包含：

- `uid`
- `username`
- `displayName`

最佳實踐：

- 所有超時、重試、日誌脫敏、錯誤碼翻譯都放在客戶端層
- provider 層只負責把外部結果對映成平臺所需的身份物件
- 禁止記錄明文密碼

#### 步驟 3：實現使用者對映服務

私有 SSO 不依賴 email，也不做賬號合併，因此建議私有版實現一個專用服務：

```java
public interface PrivateSsoIdentityService {
    PlatformPrincipal resolveOrCreate(PrivateSsoUser ssoUser);
}
```

推薦邏輯：

1. 按 `providerCode=private-sso` 和 `subject=ssoUid` 查現有繫結
2. 若已存在，載入對應平臺使用者
3. 若不存在，則自動建立平臺使用者
4. 建立新的身份繫結
5. 返回 `PlatformPrincipal`

要求：

- 自動建立出的使用者預設應是 `ACTIVE`
- 不要嘗試和現有本地賬號或 OAuth 賬號按 email 合併

#### 步驟 4：實現 `DirectAuthProvider`

虛擬碼如下：

```java
@Component
public class PrivateSsoDirectAuthProvider implements DirectAuthProvider {

    @Override
    public String providerCode() {
        return "private-sso";
    }

    @Override
    public PlatformPrincipal authenticate(DirectAuthRequest request) {
        PrivateSsoUser ssoUser = privateSsoClient.verifyPassword(
            request.username(),
            request.password()
        );
        return privateSsoIdentityService.resolveOrCreate(ssoUser);
    }
}
```

要求：

- 只返回認證成功後的 `PlatformPrincipal`
- 不在這裡建立 Session
- 不在這裡寫 `SecurityContext`

#### 步驟 5：實現 `PassiveSessionAuthenticator`

虛擬碼如下：

```java
@Component
public class PrivateSsoPassiveSessionAuthenticator implements PassiveSessionAuthenticator {

    @Override
    public String providerCode() {
        return "private-sso";
    }

    @Override
    public Optional<PlatformPrincipal> authenticate(HttpServletRequest request) {
        return privateSsoClient.verifySession(request)
            .map(privateSsoIdentityService::resolveOrCreate);
    }
}
```

要求：

- 只消費當前請求已帶上的 Cookie 或其他被動憑證
- 不主動重定向到 SSO
- 不在這裡自行建立 Session

#### 步驟 6：開啟配置

私有版部署時啟用：

```yaml
skillhub:
  auth:
    direct:
      enabled: true
    session-bootstrap:
      enabled: true
```

建議：

- 預發環境先只開 direct auth
- passive bootstrap 在確認 Cookie 域和 SameSite 行為可靠後再開啟

## 6. 前端最佳實踐

### 6.1 推薦的登入頁策略

私有版推薦保留當前開源登入頁結構，但增加企業 SSO 入口：

- 保留 OAuth 按鈕
- 本地賬號登入是否保留，由私有版自行決定
- 增加企業 SSO 使用者名稱密碼錶單，或將現有密碼錶單切換到 direct auth 相容介面
- 增加“從企業 SSO 登入”按鈕，對應 `session/bootstrap`

推薦優先順序：

1. 首先提供明確可見的企業使用者名稱密碼登入
2. 其次提供“從企業 SSO 登入”按鈕
3. 最後才考慮自動 bootstrap

### 6.2 自動 bootstrap 的使用建議

只有在以下條件同時滿足時才建議開啟 `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_AUTO=true`：

- 已確認瀏覽器在 `skill.xxx.com` 下能穩定帶上 SSO Cookie
- 失敗時 UI 不會卡死或重複重試
- 頁面只會自動嘗試一次
- 前端不會因為自動嘗試失敗而阻斷正常密碼登入

如果以上條件不滿足，建議只顯示一個顯式按鈕，讓使用者主動觸發。

### 6.3 前端禁止事項

- 不要把密碼提交給非 SkillHub 後端地址
- 不要在瀏覽器裡解析或操作私有 SSO 內部 Cookie 細節
- 不要把 bootstrap 失敗當成頁面級致命錯誤

## 7. Spring Session Redis 相關約束

當前平臺的統一 Web 登入態是 Spring Session。

後續私有版繼續接入時，必須遵守以下規則：

- 所有成功登入都必須透過 `PlatformSessionService`
- 所有 Web 會話都透過 `HttpSession` 持久化
- 不要手動維護第二份“私有 SSO session”
- 不要在 Redis 中自行定義另一套認證快取結構來替代 Session

當前統一服務會做的事：

- 寫入 `platformPrincipal`
- 寫入 `SPRING_SECURITY_CONTEXT`
- 在互動式登入流程中輪換 session id

## 8. 安全最佳實踐

### 8.1 使用者名稱密碼直連場景

- SkillHub 後端與私有 SSO 之間必須走內網或可信 RPC
- 明文密碼只允許存在於瀏覽器提交和後端呼叫 SSO 的瞬時鏈路中
- 日誌、埋點、異常資訊中禁止出現密碼
- 對下游 SSO 呼叫應設定超時和熔斷策略

### 8.2 Cookie 被動會話場景

- 必須先確認 Cookie 域、路徑、SameSite、Secure 策略能滿足 `skill.xxx.com` 使用
- bootstrap 介面應保留 CSRF 防護
- 失敗時只返回認證失敗，不洩露過多 Cookie 校驗細節
- 除非有明確產品要求，否則不要做無感知的全站自動登入 filter

### 8.3 身份對映場景

- 只信任穩定 UID，不信任顯示名作為主身份依據
- 不按 email 合併
- 不按 username 合併

## 9. 建議測試矩陣

### 9.1 後端單元測試

- `DirectAuthProvider` 成功認證
- `DirectAuthProvider` 認證失敗
- `PassiveSessionAuthenticator` 在有效 Cookie 下成功返回主體
- `PassiveSessionAuthenticator` 在無效 Cookie 下返回空或失敗
- `PrivateSsoIdentityService` 首次登入自動建號
- `PrivateSsoIdentityService` 再次登入複用已有繫結

### 9.2 後端整合測試

- `POST /api/v1/auth/direct/login` 在開啟配置後能建立 Session
- `POST /api/v1/auth/session/bootstrap` 在開啟配置後能建立 Session
- 成功登入後 `/api/v1/auth/me` 返回正確使用者
- direct auth 與現有 `/api/v1/auth/local/login` 不互相影響
- bootstrap 關閉時仍返回 `403`
- direct auth 關閉時仍返回 `403`

### 9.3 前端測試

- 未開啟執行時開關時，登入頁與開源版預設行為一致
- 開啟 direct auth 後，密碼錶單請求走 `/api/v1/auth/direct/login`
- 開啟 bootstrap 按鈕後，點選能觸發 bootstrap 請求
- 自動 bootstrap 失敗後，使用者仍可正常使用其它登入入口

### 9.4 手工驗收

- 已登入 SSO 的瀏覽器中，bootstrap 能成功建立 SkillHub 登入態
- 未登入 SSO 的瀏覽器中，bootstrap 失敗但不影響密碼登入
- direct auth 登入成功後，重新整理頁面仍保持登入態
- 多 Pod 環境下，藉助 Spring Session Redis，切換例項後 session 仍有效

## 10. 推薦開發順序

如果後續在私有倉庫中真正開始接入，建議按下面順序推進：

1. 實現 `PrivateSsoClient`
2. 實現 `PrivateSsoIdentityService`
3. 實現 `PrivateSsoDirectAuthProvider`
4. 先啟用 `skillhub.auth.direct.enabled=true`
5. 前端接通 direct auth 入口並完成測試
6. 再實現 `PrivateSsoPassiveSessionAuthenticator`
7. 確認 Cookie 作用域和瀏覽器行為
8. 啟用 `session-bootstrap`
9. 視需要決定是否開啟自動 bootstrap

## 11. 給 coding agent 的執行指令

如果後續由 AI 繼續在私有倉庫上完成接入，建議嚴格遵守以下執行規則：

- 先讀 [11-auth-extensibility-and-private-sso.md](/Users/xudongsun/github/skillhub/docs/11-auth-extensibility-and-private-sso.md) 和本檔案
- 不要重構現有公共認證主鏈路，除非發現明確 bug
- 私有 SSO 的具體實現優先寫成 provider、authenticator、client、identity service
- 不要複製 `PlatformSessionService` 邏輯
- 不要在多個 controller 或 filter 中重複寫 Session 建立程式碼
- 任何新增前端行為都必須保證執行時配置關閉時完全不影響開源版
- 所有新增協議和執行時配置必須同步更新檔案
- 每完成一個階段都跑後端測試；涉及前端改動時再補跑 `pnpm typecheck` 和 `pnpm build`

## 12. 完成定義

當私有版 SSO 接入完成時，應滿足以下標準：

- 開源版預設登入方式仍然不變
- 私有版只透過擴充套件點接入，沒有複製一套獨立登入架構
- direct auth 可用
- session bootstrap 可用
- 首次 SSO 登入自動建號
- 統一使用 Spring Session Redis 承載 Web 登入態
- `/api/v1/auth/me`、RBAC、現有業務介面對登入來源無感知
- 檔案、配置、測試都完整
