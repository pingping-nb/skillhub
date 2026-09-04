# skillhub API 設計

## 0. 標識型別約束

- 所有 API 中出現的使用者標識一律為 `string`。
- 該約束覆蓋路徑引數、query 引數、請求體欄位、響應 DTO 欄位，以及統一響應結構中的業務資料內容。
- 任何舊草案中的整型使用者標識寫法都已失效，前後端正式契約只允許字串使用者標識。

## 1. 響應結構規範

除檔案下載、檔案內容讀取這類二進位制流介面外，所有 JSON API 必須統一使用以下成功響應結構：

```json
{
  "code": 0,
  "msg": "成功",
  "data": {},
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

約束如下：

- `code`：成功時固定為 `0`；失敗時固定為 HTTP 狀態碼，例如 `400`、`401`、`403`、`500`。
- `msg`：返回給呼叫方的使用者可讀提示文案，必須透過 Spring Boot `MessageSource` + i18n 機制生成，禁止在 controller 中硬編碼。
- `msg` 的 locale 必須在響應封裝層或全域性異常處理層透過 `LocaleContextHolder` 從請求上下文自動獲取，禁止在 controller/service 中顯式傳遞 `Locale`。
- `data` 承載實際業務資料；列表、分頁物件、詳情物件、操作結果物件都必須放在 `data` 下。
- 分頁響應統一使用 `{ items, total, page, size }`，禁止直接暴露 Spring `Page` 的 `content/pageable/sort/first/last` 等內部結構。
- `timestamp`：響應建立時間戳，由後端統一自動生成。
- `requestId`：請求鏈路 ID，由後端統一注入，便於日誌追蹤。
- Controller 層禁止直接返回 `Map`、裸 DTO、裸 `Page`、裸 `List` 作為 JSON 成功響應。
- 普通 JSON 介面應直接返回統一響應 DTO；僅檔案下載、檔案預覽等需要自定義狀態碼或 header 的二進位制介面保留 `ResponseEntity`。
- 刪除、撤銷、移動標籤等操作也必須返回統一 JSON 結構；如無實體資料，返回 `data.message` 或 `data=null`，但外層結構不得變化。
- 錯誤響應與成功響應使用同一外層結構，不再使用單獨的異常 JSON 結構。
- 異常鏈路中的 `msg` 也必須透過 Spring Boot 標準 i18n 機制生成；引數校驗異常、領域異常、認證鑑權異常都必須進入統一的 `@RestControllerAdvice` 出口。
- 二進位制流介面保持原始 HTTP 語義，不套 `code/data` 包裝：
  - `/download`
  - `/file`
  - 其他返回 `application/octet-stream`、`application/zip` 等內容型別的介面

成功響應示例：

```json
{
  "code": 0,
  "msg": "發布成功",
  "data": {
    "skillId": 123,
    "version": "1.0.0"
  },
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

錯誤響應示例：

```json
{
  "code": 403,
  "msg": "需要名稱空間管理員或所有者許可權",
  "data": null,
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

## 7.1 Public API（匿名可訪問）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/skills` | 搜尋/列表（匿名僅返回 PUBLIC 技能） |
| GET | `/api/v1/skills/{namespace}/{slug}` | 技能詳情（PUBLIC 匿名可訪問） |
| GET | `/api/v1/skills/{namespace}/{slug}/versions` | 版本列表 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}` | 版本詳情 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/files` | 檔案清單 |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/file?path=...` | 讀取單個檔案（query param 避免路徑中 / 的解析問題） |
| GET | `/api/v1/skills/{namespace}/{slug}/download` | 下載預設安裝版本（最新已發布版本） |
| GET | `/api/v1/skills/{namespace}/{slug}/versions/{version}/download` | 下載指定版本包 |
| GET | `/api/v1/skills/{namespace}/{slug}/resolve` | 解析技能版本（支援 query param: `version`、`tag`、`hash`） |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/download` | 按標籤下載（解析標籤指向的版本後下載） |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/files` | 按標籤檢視檔案清單 |
| GET | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}/file?path=...` | 按標籤讀取單個檔案 |
| GET | `/api/v1/skills/{skillId}/reviews` | 公開評價分頁列表；僅返回可見評價，管理員可見隱藏項 |
| GET | `/api/v1/namespaces` | 公開名稱空間列表 |
| GET | `/api/v1/namespaces/{slug}` | 名稱空間詳情 |

Public API 的可見性規則：
- `PUBLIC` 技能：若存在已發布版本，則已登入使用者可訪問；匿名訪問仍受下載/resolve 端點的 namespace 型別限制
- `NAMESPACE_ONLY` 技能：僅該名稱空間成員可訪問（需登入）
- `PRIVATE` 技能：owner 本人 + 該 namespace 的 ADMIN 以上可訪問（需登入）
- 若 `latest_version_id = null`，即使 `visibility=PUBLIC`，skill 也不會對外公開，只有 owner 可訪問
- `hidden=true` 時，普通訪客不可訪問；僅 owner 或該 namespace 的 `ADMIN` / `OWNER` 可訪問

`GET /api/v1/skills/{namespace}/{slug}/versions/{version}` 的 `data` 欄位除版本基礎資訊外，還必須包含：

- `parsedMetadataJson`：`SKILL.md` frontmatter 的完整 JSON 序列化結果
- `manifestJson`：版本檔案清單摘要 JSON

## 7.2 Auth API（登入與會話相關）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/oauth2/authorization/github` | 發起 GitHub OAuth 登入（Spring Security 內建） |
| GET | `/login/oauth2/code/github` | GitHub OAuth 回撥（Spring Security 內建） |
| GET | `/api/v1/auth/me` | 當前使用者資訊（未登入返回 401） |
| POST | `/api/v1/auth/logout` | 登出（清除 Session） |
| GET | `/api/v1/auth/providers` | 可用的 OAuth Provider 列表（前端渲染登入按鈕用） |
| GET | `/api/v1/auth/methods` | 統一登入方式目錄（密碼/OAuth/direct/bootstrap 後設資料） |
| POST | `/api/v1/auth/direct/login` | 顯式走直連認證 provider 的相容登入入口（預設關閉） |
| POST | `/api/v1/auth/session/bootstrap` | 顯式嘗試用外部被動會話換取 skillhub Session（預設關閉） |

`/api/v1/auth/providers` 響應示例：

```json
{
  "code": 0,
  "msg": "獲取成功",
  "data": [
    { "id": "github", "name": "GitHub", "authorizationUrl": "/oauth2/authorization/github" }
  ],
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

前端根據此介面動態渲染登入按鈕，新增 Provider 無需改前端程式碼。

`/api/v1/auth/methods` 返回統一登入方式目錄。典型項包括：

- `PASSWORD`：現有本地賬號密碼登入
- `OAUTH_REDIRECT`：OAuth 跳轉登入
- `DIRECT_PASSWORD`：預設關閉的直連認證相容入口
- `SESSION_BOOTSTRAP`：預設關閉的被動會話引匯入口

示例：

```json
{
  "code": 0,
  "msg": "獲取成功",
  "data": [
    {
      "id": "local-password",
      "methodType": "PASSWORD",
      "provider": "local",
      "displayName": "Local Account",
      "actionUrl": "/api/v1/auth/local/login"
    },
    {
      "id": "oauth-github",
      "methodType": "OAUTH_REDIRECT",
      "provider": "github",
      "displayName": "GitHub",
      "actionUrl": "/oauth2/authorization/github"
    }
  ],
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

`/api/v1/auth/session/bootstrap` 請求示例：

```json
{
  "provider": "private-sso"
}
```

`/api/v1/auth/session/bootstrap` 協議約束：

- 開源版預設關閉，需顯式開啟 `skillhub.auth.session-bootstrap.enabled=true`
- 關閉時返回 `403`
- provider 不存在時返回 `400`
- 外部會話不存在或校驗失敗時返回 `401`
- 成功時返回與 `/api/v1/auth/me` 相同的使用者結構，並建立標準 Session

`/api/v1/auth/direct/login` 請求示例：

```json
{
  "provider": "private-sso",
  "username": "alice",
  "password": "secret"
}
```

`/api/v1/auth/direct/login` 協議約束：

- 開源版預設關閉，需顯式開啟 `skillhub.auth.direct.enabled=true`
- 關閉時返回 `403`
- provider 不存在時返回 `400`
- 成功時返回與 `/api/v1/auth/me` 相同的使用者結構，並建立標準 Session
- `/api/v1/auth/local/login` 繼續保留，作為現有本地賬號入口

## 7.3 Authenticated API（需登入）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/skills/{namespace}/{slug}/star` | 收藏 |
| DELETE | `/api/v1/skills/{namespace}/{slug}/star` | 取消收藏 |
| POST | `/api/v1/skills/{namespace}/{slug}/rating` | 評分 |
| GET | `/api/v1/skills/{skillId}/reviews/me` | 當前使用者的評分與文字評價 |
| PUT | `/api/v1/skills/{skillId}/reviews/me` | 新增或更新當前使用者評價（`score` 1-5，`reviewText` 最長 2000） |
| DELETE | `/api/v1/skills/{skillId}/reviews/me` | 刪除文字評價並保留星級評分 |
| GET | `/api/v1/me/stars` | 我的收藏列表 |
| GET | `/api/v1/me/skills` | 我發布的技能列表 |

### 草稿與稽核提交（Phase 3 引入）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/skills/{namespace}/{slug}/versions/{version}/withdraw-review` | 撤回提審（PENDING_REVIEW → DRAFT，同時刪除關聯的 PENDING review_task） |
| POST | `/api/v1/reviews` | 提交指定 `skillVersionId` 進入稽核佇列 |

### 標籤管理

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/skills/{namespace}/{slug}/tags` | 列出標籤 |
| PUT | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}` | 建立/移動自定義標籤（`latest` 為系統保留標籤，不可透過此介面操作） |
| DELETE | `/api/v1/skills/{namespace}/{slug}/tags/{tagName}` | 刪除自定義標籤（`latest` 不可刪） |

### 技能生命週期管理

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/skills/{namespace}/{slug}/archive` | 歸檔技能（namespace ADMIN 或 owner） |
| POST | `/api/v1/skills/{namespace}/{slug}/unarchive` | 恢復歸檔（namespace ADMIN 或 owner） |
| DELETE | `/api/v1/skills/{namespace}/{slug}/versions/{version}` | 刪除 DRAFT/REJECTED 版本 |
| POST | `/api/v1/skills/{namespace}/{slug}/versions/{version}/rerelease` | 從已發布版本重新發出一個新版本（namespace ADMIN 或 owner） |

當前程式碼中的 skill 生命週期讀模型不再依賴 `latestVersionStatus` / `viewingVersionStatus` 一類拼裝欄位，而統一使用以下 projection：

- `headlineVersion`：當前頁面應展示的主版本
- `publishedVersion`：當前最新可分發的已發布版本
- `ownerPreviewVersion`：owner / namespace 管理者可見的 `PENDING_REVIEW` 預覽版本
- `resolutionMode`：`PUBLISHED` / `OWNER_PREVIEW` / `NONE`

其中：

- 公開詳情、公開安裝、公開搜尋一律只認 `publishedVersion`
- owner 詳情頁在沒有可展示發布版本時，才允許 `headlineVersion` 落到 `ownerPreviewVersion`
- 推廣到全域性一律使用 `publishedVersion.id`
- `hidden` 是獨立治理覆蓋層，不屬於生命週期狀態機
- 常規版本詳情介面只放行 `PUBLISHED`，以及 owner 對自己 `PENDING_REVIEW` 版本的預覽；`DRAFT / REJECTED / YANKED` 不透過該介面暴露

發布成功響應中的 `data` 至少包含以下欄位：

- `skillId`
- `namespace`
- `slug`
- `version`
- `status`
- `fileCount`
- `totalSize`

發布狀態約束：

- 普通使用者發布成功後，`status` 為 `PENDING_REVIEW`
- 持有 `SUPER_ADMIN` 的使用者透過 Web、`/api/v1/publish`、`/api/v1/publish` 發布時，`status` 為 `PUBLISHED`，且不要求其必須是目標 namespace 成員
- 當前版本保持該稽核策略，不再提供“全員直髮”的執行模式
- 撤回稽核不會刪除版本記錄，而是 `PENDING_REVIEW → DRAFT`

## 7.4 Token API（需登入）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/tokens` | 建立 API Token |
| GET | `/api/v1/tokens` | 列出我的 Token |
| DELETE | `/api/v1/tokens/{id}` | 吊銷 Token |

## 7.5 CLI API（Bearer Token 認證，CLI 主流程由 Device Flow 獲取憑證）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/whoami` | 當前 Bearer Token 對應的使用者資訊 |
| POST | `/api/v1/publish` | 發布技能包（普通使用者進入稽核；`SUPER_ADMIN` 始終直髮） |
| GET | `/api/v1/resolve/{namespace}/{slug}` | 解析版本 |
| GET | `/api/v1/check/{namespace}/{slug}/{version}` | 本地雜湊與遠端比對 |

### ClawHub CLI 協議相容層

一期不僅提供 skillhub 自有 CLI API，還必須暴露一組相容 ClawHub CLI 的 registry API。

- 目標：讓現有 ClawHub CLI 可透過配置 registry base URL 直接對接 skillhub
- 範圍：一期聚焦覆蓋 ClawHub CLI 所依賴的核心介面：查詢、版本解析、下載、發布、whoami
- 要求：相容層優先保持 ClawHub CLI 既有請求/響應語義；若內部領域模型不同，透過 adapter 層完成協議轉換，而不是要求客戶端適配 skillhub 私有協議
- 要求：相容層納入 OpenAPI 或獨立相容協議檔案，並作為正式對外契約維護
- 要求：相容層與 skillhub 自有 `/api/v1/**` 並存，二者共享同一套許可權、審計、限流與領域服務
- 非目標：前端頁面不直接依賴相容層；相容層用於服務已有 ClawHub CLI 和相關自動化指令碼

相容層最少需要覆蓋的能力類別：

- Registry metadata：技能查詢、技能詳情、版本列表、標籤/預設版本解析
- Artifact resolution：按技能座標或版本解析下載地址/下載流
- Publish workflow：包上傳與發布結果返回
- Integrity check：版本存在性校驗、摘要/雜湊比對、whoami/token 上下文確認

如 ClawHub CLI 的現有協議與 skillhub 自有介面存在差異，檔案以“相容 ClawHub CLI 協議”為準，skillhub 內部 API 可繼續保持當前風格。

## 7.6 Admin API（需對應平臺角色）

Admin API 按最小許可權拆分，不再統一要求 SUPER_ADMIN：

### 平臺治理介面

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/promotions` | 待稽核提升申請列表（需 `SKILL_ADMIN` / `SUPER_ADMIN`；路由不在 `/admin/*` 下） |
| GET | `/api/v1/promotions/{id}` | 提升申請詳情（提交人本人或 `SKILL_ADMIN` / `SUPER_ADMIN` 可讀） |
| POST | `/api/v1/promotions/{id}/approve` | 透過提升申請（需 `SKILL_ADMIN` / `SUPER_ADMIN`） |
| POST | `/api/v1/promotions/{id}/reject` | 拒絕提升申請（需 `SKILL_ADMIN` / `SUPER_ADMIN`） |
| POST | `/api/v1/admin/skills/{id}/hide` | 隱藏技能（僅 `SUPER_ADMIN`） |
| POST | `/api/v1/admin/skills/{id}/unhide` | 恢復技能（僅 `SUPER_ADMIN`） |
| POST | `/api/v1/admin/skills/versions/{versionId}/yank` | 撤回已發布版本（`SKILL_ADMIN` / `SUPER_ADMIN`） |
| POST | `/api/v1/admin/skill-reviews/{reviewId}/hide` | 隱藏使用者評價（`SKILL_ADMIN` / `SUPER_ADMIN`） |
| POST | `/api/v1/admin/skill-reviews/{reviewId}/restore` | 恢復使用者評價（`SKILL_ADMIN` / `SUPER_ADMIN`） |

### 使用者治理（需 USER_ADMIN / SUPER_ADMIN）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/admin/users` | 使用者列表 |
| GET | `/api/v1/admin/users/{id}` | 使用者詳情 |
| PUT | `/api/v1/admin/users/{id}/role` | 修改使用者角色（USER_ADMIN 不可分配 SUPER_ADMIN，也不可修改已有 SUPER_ADMIN 的角色狀態） |
| POST | `/api/v1/admin/users/{id}/approve` | 審批待准入使用者 |
| POST | `/api/v1/admin/users/{id}/disable` | 封禁使用者 |
| POST | `/api/v1/admin/users/{id}/enable` | 解封使用者 |

### 審計（需 AUDITOR / SUPER_ADMIN）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/admin/audit-logs` | 審計日誌查詢 |

## 7.7 Namespace 管理 API（需名稱空間 OWNER 或 ADMIN）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/v1/namespaces` | 建立名稱空間 |
| PUT | `/api/v1/namespaces/{slug}` | 更新名稱空間資訊 |
| GET | `/api/v1/namespaces/{slug}/members` | 成員列表 |
| POST | `/api/v1/namespaces/{slug}/members` | 新增成員 |
| PUT | `/api/v1/namespaces/{slug}/members/{userId}/role` | 修改成員角色 |
| DELETE | `/api/v1/namespaces/{slug}/members/{userId}` | 移除成員 |
| GET | `/api/v1/reviews?namespaceId={id}` | 該空間待稽核列表 |
| POST | `/api/v1/reviews/{id}/approve` | 空間管理員稽核透過 |
| POST | `/api/v1/reviews/{id}/reject` | 空間管理員稽核拒絕 |
| POST | `/api/v1/promotions` | 申請提升到全域性 |

## 7.8 `latest` 語義說明

`latest` 自動跟隨最新已發布版本，不可手動移動。

- `skill.latest_version_id`：每次稽核透過自動更新，始終指向最新 PUBLISHED 版本
- `yank` 當前最新已發布版本時，需要同步重算 `latest_version_id` 指向下一個最新的 `PUBLISHED` 版本；若不存在則允許為 `null`
- `latest` 標籤：系統保留，只讀，自動與 `latest_version_id` 同步
- 自定義標籤（如 `beta`、`stable-2026q1`）：允許人工建立和移動，用於固定安裝通道

| 場景 | 使用欄位 | 說明 |
|------|---------|------|
| 搜尋索引內容 | `publishedVersion` / `latest_version_id` | 外部協議仍叫 latest，但內部語義必須等價於最新已發布版本 |
| `/download`（不帶版本號） | `publishedVersion` / `latest_version_id` | 下載最新已發布版本 |
| CLI `install @team/skill` | `publishedVersion` / `latest_version_id` | 等同於 `@latest` |
| CLI `install @team/skill@beta` | `skill_tag` 查詢 | 自定義標籤指向的版本 |

## 7.9 Resolve 介面說明

`GET /api/v1/skills/{namespace}/{slug}/resolve` 用於解析技能版本，支援以下 query param：

| 引數 | 型別 | 說明 |
|------|------|------|
| `version` | string | 精確版本號（如 `1.2.0`） |
| `tag` | string | 標籤名（如 `beta`、`latest`） |
| `hash` | string | fingerprint 雜湊，用於判斷本地版本是否與 registry 同步 |

解析優先順序：
1. `version` 和 `tag` 不可同時傳，同時傳返回 `400 Bad Request`
2. 僅傳 `version`：精確匹配版本號
3. 僅傳 `tag`：查詢 `skill_tag` 表獲取 `target_version_id`
4. 僅傳 `hash`：遍歷已發布版本，比對 fingerprint
5. 均不傳：返回最新已發布版本；實現上可由 `latest_version_id` 或等價 published projection 解析

響應：

```json
{
  "code": 0,
  "msg": "獲取成功",
  "data": {
    "skillId": 456,
    "namespace": "team-name",
    "slug": "my-skill",
    "version": "1.2.0",
    "versionId": 123,
    "fingerprint": "sha256:abc123...",
    "downloadUrl": "/api/v1/skills/team-name/my-skill/versions/1.2.0/download"
  },
  "timestamp": "2026-03-12T06:00:00Z",
  "requestId": "req-123"
}
```

`hash` 匹配時額外返回 `"matched": true`，不匹配時返回最新版本資訊 + `"matched": false`。

## 7.10 ClawHub CLI 相容層 API

相容層 API 基地址為 `/api/v1`，透過 `/.well-known/clawhub.json` 發現。相容層使用 canonical slug（雙連字元對映規則，詳見 `00-product-direction.md` 1.1 節）。

認證方式：`Authorization: Bearer <token>`。Bearer Token 可來自 CLI Device Flow 或平臺 API Token。

### Well-known 發現

```
GET /.well-known/clawhub.json

響應：
{
  "apiBase": "/api/v1"
}
```

### 相容層端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/v1/whoami` | 當前使用者資訊 |
| GET | `/api/v1/search` | 搜尋技能 |
| GET | `/api/v1/resolve` | 透過 slug + version 解析版本 |
| GET | `/api/v1/download/{slug}/{version}` | 下載技能 zip 包 |
| POST | `/api/v1/publish` | 發布技能（multipart/form-data，`SUPER_ADMIN` 直髮） |

### 相容層請求/響應格式

**GET `/api/v1/whoami`**

```json
{
  "handle": "username",
  "displayName": "User Name",
  "role": "user"
}
```

**GET `/api/v1/search?q={keyword}&page={page}&limit={limit}`**

```json
{
  "results": [
    {
      "slug": "my-skill",
      "name": "My Skill",
      "description": "...",
      "author": { "handle": "username", "displayName": "User Name" },
      "version": "1.2.0",
      "downloadCount": 100,
      "starCount": 50,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-03-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

注意：相容層返回的 `slug` 為 canonical slug 格式（全域性空間直接返回 skill slug，團隊空間返回 `namespace--skill`）。

**GET `/api/v1/resolve?slug={slug}&version={version}`**

```json
{
  "slug": "my-skill",
  "version": "1.2.0",
  "downloadUrl": "/api/v1/download/my-skill/1.2.0"
}
```

**GET `/api/v1/download/{slug}/{version}`**

返回指定版本的 zip 檔案流。預設版本解析由 `resolve` 介面負責。

**POST `/api/v1/publish`**

```
Content-Type: multipart/form-data
Parts:
  - file: zip 包
```

一期同步響應，返回發布結果：

```json
{
  "slug": "my-skill",
  "version": "1.0.0",
  "status": "published"
}
```

### 相容層適配說明

- 相容層是獨立的 Controller 層，內部呼叫與 native API 相同的領域服務
- 請求進入時將 canonical slug 轉換為 `(namespace_id, skill_slug)` 座標
- 響應返回時將內部座標轉換為 canonical slug
- 相容層不暴露 namespace 概念，對 ClawHub CLI 透明
- 發布時如果 canonical slug 包含 `--`，解析為團隊空間發布；否則發布到全域性空間
- 相容層的認證複用 skillhub Bearer Token 體系，ClawHub CLI 透過登入或配置 token 後即可使用

## 7.11 Rate Limiting

分兩階段實施：

### Phase 1：Ingress 層基礎限流

透過 Nginx Ingress `limit-req` 按 IP 全侷限流，覆蓋認證、搜尋、下載等匿名可訪問介面，防止基本的濫用和爬蟲。

### Phase 2：應用層精細限流

基於 Redis 滑動視窗，按使用者/端點分類的精細限流。

| 端點類別 | 限流策略 |
|---------|---------|
| 搜尋 API | 已登入 60 次/分鐘，匿名 20 次/分鐘（按 IP） |
| 下載 API | 已登入 120 次/分鐘，匿名 30 次/分鐘（按 IP） |
| 發布 API | 10 次/小時（按使用者） |
| 認證 API | 30 次/分鐘（按 IP） |

觸發限流時返回 `429 Too Many Requests` + `Retry-After` Header。

## 7.12 API 設計原則

### Native API（`/api/v1/*`）

- 統一響應包裹：`{ code, message, data, timestamp }`
- 分頁格式：`{ items, total, page, size }`
- 錯誤碼體系：業務錯誤碼 + HTTP 狀態碼配合
- 版本策略：URL path 版本 `/api/v1/`
- 冪等性：寫操作透過 `X-Request-Id` + Redis 去重（TTL 24h）

### Compatibility API（`/api/v1/*`）

- 響應格式完全遵循 ClawHub 協議，不套統一響應包裹
- 錯誤響應遵循 ClawHub 格式：`{ error: string, message: string }`
- 分頁格式遵循 ClawHub 格式：`{ results, total, page, limit }`

### OpenAPI 檔案分離

生成兩份獨立的 OpenAPI spec：
- `openapi-native.json`：skillhub Native API，用於前端 SDK 生成
- `openapi-compat-clawhub.json`：ClawHub 相容層 API，用於相容性測試和檔案
