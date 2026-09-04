# 認證擴充套件與私有 SSO 相容設計

## 1. 目標

在不影響當前開源版 OAuth 和本地賬號登入能力的前提下，為未來私有倉庫接入企業 SSO 預留穩定擴充套件點，並把程式碼差異控制在 provider 實現層和少量配置層。

## 2. 已確認約束

- 私有 SSO 能提供穩定唯一 UID
- 使用者名稱密碼校驗與 Cookie 會話校驗都會返回同一穩定 UID
- 生產部署預期為 `skill.xxx.com` 與 `sso.xxx.com`
- 私有版可透過後端內部介面/RPC 代呼叫 SSO 校驗使用者名稱密碼
- 首次 SSO 登入自動建立 skillhub 賬號
- 不做賬號合併設計，不依賴 email
- 登出聯動可保留擴充套件點，但不是近期目標

## 3. 開源版相容策略

### 3.1 不改變現有主鏈路

- 現有 OAuth 登入流程保持不變
- 現有本地使用者名稱密碼登入保持不變
- 現有 `/api/v1/auth/providers` 協議保持不變
- 不在開源版中引入私有 SSO 的真實實現

### 3.2 新增的公共擴充套件協議

開源版新增顯式被動會話引導介面：

- `POST /api/v1/auth/session/bootstrap`

請求：

```json
{
  "provider": "private-sso"
}
```

行為約束：

- 預設關閉，由 `skillhub.auth.session-bootstrap.enabled=false` 控制
- 關閉時返回 `403`
- provider 不存在時返回 `400`
- 外部會話校驗失敗時返回 `401`
- 成功時建立 skillhub Session，並返回當前使用者資訊

同時新增預設關閉的直連認證相容介面：

- `POST /api/v1/auth/direct/login`

請求：

```json
{
  "provider": "private-sso",
  "username": "alice",
  "password": "secret"
}
```

行為約束：

- 預設關閉，由 `skillhub.auth.direct.enabled=false` 控制
- 關閉時返回 `403`
- provider 不存在時返回 `400`
- 成功時建立 skillhub Session，並返回當前使用者資訊
- 開源版仍保留原始 `/api/v1/auth/local/login`

### 3.3 程式碼級擴充套件點

```java
public interface PassiveSessionAuthenticator {
    String providerCode();
    Optional<PlatformPrincipal> authenticate(HttpServletRequest request);
}
```

```java
public interface DirectAuthProvider {
    String providerCode();
    PlatformPrincipal authenticate(DirectAuthRequest request);
}
```

私有版只需要新增實現，例如：

- `private-sso-cookie`：讀取共享 Cookie 並向 SSO 校驗
- 後續如果需要，也可以補“使用者名稱密碼直連認證 provider”擴充套件點

為減少私有 fork 的前端硬編碼，擴充套件 provider 可額外宣告展示名稱：

- `DirectAuthProvider.displayName()` 預設回退為 `providerCode()`
- `PassiveSessionAuthenticator.displayName()` 預設回退為 `providerCode()`
- `GET /api/v1/auth/methods` 會返回該展示名稱，供登入頁直接渲染

## 4. 本輪已落地內容

- 新增 `PassiveSessionAuthenticator` SPI
- 新增 `DirectAuthProvider` SPI
- 新增統一會話建立服務 `PlatformSessionService`
- 新增 `POST /api/v1/auth/session/bootstrap` 協議
- 新增 `POST /api/v1/auth/direct/login` 協議
- 新增 `skillhub.auth.direct.enabled` 開關，預設關閉
- 新增 `skillhub.auth.session-bootstrap.enabled` 開關，預設關閉
- 前端新增基於執行時配置的賬號密碼相容接入層
- 前端新增基於執行時配置的被動會話相容入口
- 前端新增顯式按鈕和可選自動嘗試邏輯，預設都不啟用
- 增加 controller 整合測試，驗證：
  - 預設關閉時不會影響現有系統
  - 啟用並提供 authenticator 時可以建立 skillhub Session

統一會話建立約束：

- 本地登入、OAuth 成功回撥、direct auth、session bootstrap、mock 登入旁路都走 `PlatformSessionService`
- 會話寫入統一依賴 `HttpSession` 屬性：`platformPrincipal` 與 `SPRING_SECURITY_CONTEXT`
- 因此在生產環境啟用 Spring Session Redis 時，不需要為不同登入方式分別處理 Session 序列化或儲存邏輯
- 互動式登入預設輪換 session id；OAuth 這類已在 Spring Security 認證鏈中的流程複用現有 `Authentication`

前端執行時配置：

- `SKILLHUB_WEB_AUTH_DIRECT_ENABLED`
- `SKILLHUB_WEB_AUTH_DIRECT_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_ENABLED`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_PROVIDER`
- `SKILLHUB_WEB_AUTH_SESSION_BOOTSTRAP_AUTO`

使用方式：

1. 若要做密碼直連，後端啟用 `skillhub.auth.direct.enabled=true`
2. 私有版提供 `DirectAuthProvider` 實現
3. 前端設定 `SKILLHUB_WEB_AUTH_DIRECT_*`
4. 若要做被動會話，後端啟用 `skillhub.auth.session-bootstrap.enabled=true`
5. 私有版提供 `PassiveSessionAuthenticator` 實現
6. 前端設定 bootstrap provider 和開關
7. 登入頁顯示相容入口，或在配置允許時自動嘗試一次 bootstrap

## 5. 後續建議

- 私有版實現 `DirectAuthProvider` 和 / 或 `PassiveSessionAuthenticator` 時，只擴充套件 provider 層，不復制 session 建立邏輯
- 私有版優先採用顯式 bootstrap，而不是透明全域性攔截器自動登入
- 如後續需要登出聯動，只透過 `LogoutPropagationHandler` 擴充套件，不改動現有主登出鏈路

## 6. 實施手冊

更詳細的私有 SSO 接入步驟、最佳實踐、測試矩陣和給後續 coding agent 的執行約束，見：

- [12-private-sso-integration-playbook.md](/Users/xudongsun/github/skillhub/docs/12-private-sso-integration-playbook.md)
