# OSS-01 Core 契約審計與凍結

## 1. 審計結論

SkillHub 開源專案已具備 AstronClaw 主鏈路所需的絕大部分 Core 能力。現有介面覆蓋了 skill 唯一標識查詢、版本後設資料查詢、建立（發布）和刪除。**無需在開源 Core 中新增 AstronClaw 專屬介面**；對 AstronClaw 而言，查詢類和主鏈路類能力都應統一由 SaaS 層 `AstronClaw Adapter` 封裝後對外提供，而不是直接繫結開源 Core 的介面形態。

---

## 2. Core 介面清單

以下介面構成 Core 基線能力，供 SaaS 層統一封裝後對 AstronClaw 提供；這些介面本身不應被視為 AstronClaw 的長期直接契約。

### 2.1 skill 唯一標識與詳情查詢

| 介面 | 路徑 | 說明 |
|------|------|------|
| skill 詳情 | `GET /api/v1/skills/{namespace}/{slug}` | 返回 `SkillDetailResponse`，包含完整 identity 和狀態 |
| 版本解析 | `GET /api/v1/skills/{namespace}/{slug}/resolve?version=&tag=&hash=` | 返回 `ResolveVersionResponse`，解析人類可讀版本選擇器到精確版本 |

### 2.2 指定版本安裝後設資料查詢

| 介面 | 路徑 | 說明 |
|------|------|------|
| 版本詳情 | `GET /api/v1/skills/{namespace}/{slug}/versions/{version}` | 返回 `SkillVersionDetailResponse`，含 metadata 和 manifest |
| 版本檔案列表 | `GET /api/v1/skills/{namespace}/{slug}/versions/{version}/files` | 返回 `List<SkillFileResponse>` |
| 版本下載 | `GET /api/v1/skills/{namespace}/{slug}/versions/{version}/download` | 下載指定版本 bundle |
| 版本列表 | `GET /api/v1/skills/{namespace}/{slug}/versions?page=&size=` | 分頁返回版本列表 |

### 2.3 建立（發布）個人 skill

| 介面 | 路徑 | 說明 |
|------|------|------|
| 發布 skill | `POST /api/v1/skills/{namespace}/publish` | 上傳包併發布，返回 `PublishResponse` |

### 2.4 刪除個人 skill

| 介面 | 路徑 | 說明 |
|------|------|------|
| 硬刪除（by ID） | `DELETE /api/v1/skills/id/{skillId}` | 需 SUPER_ADMIN 許可權 |
| 硬刪除（by 座標） | `DELETE /api/v1/skills/{namespace}/{slug}` | 需 SUPER_ADMIN 許可權 |
| 歸檔 | `POST /api/v1/skills/{namespace}/{slug}/archive` | owner 或 namespace admin 可操作 |
| 取消歸檔 | `POST /api/v1/skills/{namespace}/{slug}/unarchive` | 恢復為 ACTIVE |

### 2.5 版本生命週期

| 介面 | 路徑 | 說明 |
|------|------|------|
| 刪除版本 | `DELETE /api/v1/skills/{namespace}/{slug}/versions/{version}` | 僅 DRAFT/REJECTED/SCAN_FAILED 可刪 |
| 撤回稽核 | `POST /api/v1/skills/{namespace}/{slug}/versions/{version}/withdraw-review` | PENDING_REVIEW → DRAFT |
| 重新發布 | `POST /api/v1/skills/{namespace}/{slug}/versions/{version}/rerelease` | 重新發布版本 |

### 2.6 ClawHub 相容介面（已有）

| 介面 | 路徑 | 說明 |
|------|------|------|
| 解析 skill | `GET /api/v1/resolve?slug=&version=` | ClawHub 協議相容 |
| 解析 skill（路徑） | `GET /api/v1/resolve/{canonicalSlug}?version=` | ClawHub 協議相容 |
| 下載 | `GET /api/v1/download/{canonicalSlug}?version=` | 302 重定向到下載地址 |
| 刪除 skill | `DELETE /api/v1/skills/{canonicalSlug}` | owner 可操作 |
| 取消刪除 | `POST /api/v1/skills/{canonicalSlug}/undelete` | owner 可操作 |
| 發布 skill | `POST /api/v1/skills` | ClawHub 協議相容 |
| 發布到 namespace | `POST /api/v1/publish` | ClawHub 協議相容 |

---

## 3. 欄位語義凍結表

### 3.1 Skill Identity 欄位

| 欄位 | 型別 | 含義 | 穩定性 | 說明 |
|------|------|------|--------|------|
| `skill.id` | Long | skill 全域性唯一主鍵 | 不可變 | 自增，建立後永不改變，可作為外部對映主鍵 |
| `namespace` (slug) | String(64) | skill 所屬名稱空間標識 | 不可變 | 全域性唯一，建立後不可改名 |
| `skill.slug` | String(100) | skill 在 namespace 內的唯一標識 | 不可變 | 建立後不可改名，`namespace + slug` 構成業務座標 |
| `skill.displayName` | String(200) | skill 展示名稱 | 可變 | 僅用於展示，不可作為對映依據 |
| `skill.ownerId` | String | skill 建立者 ID | 不可變 | 建立時繫結，不可轉移 |
| `skill.summary` | String(TEXT) | skill 簡介 | 可變 | 展示用 |
| `skill.visibility` | Enum | 可見性 | 可變 | `PUBLIC` / `NAMESPACE_ONLY` / `PRIVATE` |
| `skill.status` | Enum | skill 狀態 | 可變 | `ACTIVE` / `HIDDEN` / `ARCHIVED` |
| `skill.hidden` | boolean | 是否被管理員隱藏 | 可變 | 與 status 獨立的隱藏標記 |
| `skill.latestVersionId` | Long | 最新版本指標 | 可變 | 指向當前最新已發布版本，yank/刪除後自動回退 |
| `skill.downloadCount` | Long | 下載次數 | 可變 | 累計值 |
| `skill.starCount` | Integer | 收藏數 | 可變 | 累計值 |

### 3.2 SkillVersion 欄位

| 欄位 | 型別 | 含義 | 穩定性 | 說明 |
|------|------|------|--------|------|
| `version.id` | Long | 版本全域性唯一主鍵 | 不可變 | 自增 |
| `version.skillId` | Long | 所屬 skill ID | 不可變 | 外來鍵 |
| `version.version` | String(64) | 版本號 | 不可變 | 如 `1.0.0`，建立後不可改 |
| `version.status` | Enum | 版本狀態 | 可變 | 見狀態語義表 |
| `version.bundleReady` | boolean | bundle 是否可用 | 可變 | `true` 表示 bundle 已構建完成，可下載安裝 |
| `version.downloadReady` | boolean | 是否允許下載 | 可變 | yank 後設為 `false` |
| `version.publishedAt` | Instant | 發布時間 | 一次寫入 | 首次發布時設定 |
| `version.parsedMetadataJson` | JSONB | 解析後的後設資料 | 一次寫入 | 包含 `package_name` 等執行時資訊 |
| `version.manifestJson` | JSONB | manifest 原始內容 | 一次寫入 | skill 包的 manifest |
| `version.changelog` | String(TEXT) | 變更日誌 | 可變 | 展示用 |
| `version.fileCount` | Integer | 檔案數量 | 一次寫入 | 發布時確定 |
| `version.totalSize` | Long | 總大小（位元組） | 一次寫入 | 發布時確定 |
| `version.yankedAt` | Instant | yank 時間 | 一次寫入 | yank 時設定 |
| `version.yankReason` | String(TEXT) | yank 原因 | 一次寫入 | yank 時設定 |

### 3.3 關鍵欄位含義凍結

| 欄位 | 凍結定義 |
|------|----------|
| `skill_id` | `skill.id`，Long 型別自增主鍵，全域性唯一，建立後不可變。AstronClaw 應以此作為 `external_skill_mapping` 的外部主鍵 |
| `namespace` | `namespace.slug`，String(64)，全域性唯一，不可改名。與 `slug` 組合構成業務座標 |
| `slug` | `skill.slug`，String(100)，namespace 內唯一，不可改名。`namespace/slug` 是人類可讀的穩定座標 |
| `version` | `skill_version.version`，String(64)，同一 skill 內唯一，不可改。如 `1.0.0` |
| `bundle_url` | 透過 `GET /{namespace}/{slug}/versions/{version}/download` 獲取，或透過 `resolve` 介面的 `downloadUrl` 欄位獲取。不是資料庫欄位，而是動態生成的下載地址 |
| `bundle_ready` | `skill_version.bundleReady`，boolean。`true` 表示 bundle 已構建完成可安裝。AstronClaw 安裝前必須校驗此欄位 |
| `package_name` | 儲存在 `skill_version.parsedMetadataJson` 中，從 skill 包的 manifest 解析而來。同一 skill 跨版本應保持穩定。AstronClaw 用於執行時安裝/解除安裝標識 |

### 3.4 Namespace 欄位

| 欄位 | 型別 | 含義 | 穩定性 |
|------|------|------|--------|
| `namespace.id` | Long | 名稱空間主鍵 | 不可變 |
| `namespace.slug` | String(64) | 名稱空間標識 | 不可變，全域性唯一 |
| `namespace.displayName` | String(128) | 展示名稱 | 可變 |
| `namespace.type` | Enum | 型別 | 不可變，`GLOBAL` / `TEAM` |
| `namespace.status` | Enum | 狀態 | 可變，`ACTIVE` / `FROZEN` / `ARCHIVED` |

---

## 4. 狀態語義凍結表

### 4.1 Skill 狀態（`SkillStatus`）

| 狀態 | 市場可見 | 可新裝 | 已裝是否保留 | 可被 owner 操作 | 說明 |
|------|----------|--------|------------|----------------|------|
| `ACTIVE` | 是（受 visibility 控制） | 是（需有 PUBLISHED 版本） | 是 | 是 | 正常狀態 |
| `HIDDEN` | 否 | 否 | 是 | 受限 | 管理員隱藏，獨立於 status 的 `hidden` 標記 |
| `ARCHIVED` | 否 | 否 | 是 | 可取消歸檔 | owner 或 namespace admin 歸檔 |

### 4.2 版本狀態（`SkillVersionStatus`）

| 狀態 | 是否允許安裝 | 是否允許下載 | 市場可見 | 可轉換到 | 說明 |
|------|------------|------------|---------|---------|------|
| `DRAFT` | 否 | 否 | 否 | SCANNING, 可刪除 | 初始狀態，編輯中 |
| `SCANNING` | 否 | 否 | 否 | SCAN_FAILED, PENDING_REVIEW, PUBLISHED | 安全掃描中 |
| `SCAN_FAILED` | 否 | 否 | 否 | 可刪除 | 安全掃描失敗 |
| `PENDING_REVIEW` | 否 | 否 | 否 | PUBLISHED, REJECTED, → DRAFT(撤回) | 等待稽核 |
| `PUBLISHED` | 是 | 是 | 是 | YANKED | 已發布，可安裝 |
| `REJECTED` | 否 | 否 | 否 | 可刪除 | 稽核拒絕 |
| `YANKED` | 否 | 否 | 否（或弱可見） | 不可逆 | 已撤回，已裝不受影響 |

### 4.3 可見性（`SkillVisibility`）

| 可見性 | 市場列表可見 | 誰可檢視 | 誰可安裝 |
|--------|------------|---------|---------|
| `PUBLIC` | 是 | 所有人 | 所有人（需 PUBLISHED + bundleReady） |
| `NAMESPACE_ONLY` | 否 | namespace 成員 | namespace 成員 |
| `PRIVATE` | 否 | 僅 owner | 僅 owner |

### 4.4 刪除語義

| 操作 | 型別 | 可逆 | 資料影響 | 已裝例項影響 |
|------|------|------|---------|------------|
| 硬刪除 skill | 永久刪除 | 否 | 刪除所有記錄、檔案、儲存物件，slug 可複用 | 不影響，AstronClaw 已裝快照獨立 |
| 歸檔 skill | 狀態變更 | 是 | 無資料刪除，status → ARCHIVED | 不影響 |
| 隱藏 skill | 標記變更 | 是 | 無資料刪除，hidden → true | 不影響 |
| 刪除版本 | 永久刪除 | 否 | 僅刪除 DRAFT/REJECTED/SCAN_FAILED 版本 | 不影響（這些版本未被安裝） |
| Yank 版本 | 狀態變更 | 否 | status → YANKED，downloadReady → false | 不影響已裝例項 |

### 4.5 AstronClaw 安裝判斷規則

AstronClaw 判斷一個 skill 版本是否可安裝，需同時滿足：

```
skill.status == ACTIVE
  AND skill.hidden == false
  AND skill.visibility 允許當前使用者訪問
  AND version.status == PUBLISHED
  AND version.bundleReady == true
```

已安裝例項不受後續狀態變更影響。即使 skill 被刪除/歸檔/隱藏，或版本被 yank，AstronClaw 本地安裝快照仍可正常使用和解除安裝。

## 5. 錯誤語義表

### 5.1 統一響應結構

```json
{
  "code": 0,
  "msg": "操作成功",
  "data": { ... },
  "timestamp": "2026-04-10T08:00:00Z",
  "requestId": "req-xxx"
}
```

- `code = 0` 表示成功
- `code > 0` 表示錯誤，值為 HTTP 狀態碼

### 5.2 錯誤碼對映

| HTTP 狀態碼 | 場景 | 異常型別 | 說明 |
|------------|------|---------|------|
| 400 | 引數非法 | `BadRequestException` / `DomainBadRequestException` | 請求引數校驗失敗 |
| 401 | 未認證 | `UnauthorizedException` / `AuthFlowException` | 未登入或 token 過期 |
| 403 | 無許可權 | `ForbiddenException` / `DomainForbiddenException` | 無操作許可權 |
| 404 | 未找到 | `DomainNotFoundException` | skill/version/namespace 不存在 |
| 408 | 請求超時 | `AsyncRequestTimeoutException` | 非同步請求超時 |
| 503 | 儲存不可用 | `StorageAccessException` | 物件儲存訪問失敗 |
| 500 | 服務異常 | `Exception` | 未預期的內部錯誤 |

### 5.3 Core 主鏈路關鍵錯誤場景

| 場景 | HTTP 狀態碼 | msg 示例 | AstronClaw 處理建議 |
|------|-----------|---------|-------------------|
| skill 不存在 | 404 | `error.skill.notFound` | 對映失敗，提示使用者 |
| 版本不存在 | 404 | `error.skill.notFound` | 安裝/升級失敗，提示使用者 |
| 版本不可安裝（非 PUBLISHED） | 400 | `error.badRequest` | 拒絕安裝，提示版本狀態 |
| bundle 未就緒 | 400 | `error.badRequest` | 拒絕安裝，提示稍後重試 |
| 無權訪問（PRIVATE skill） | 403 | `error.forbidden` | 提示無許可權 |
| namespace 不存在 | 404 | `error.namespace.notFound` | 對映失敗 |
| 儲存服務不可用 | 503 | `error.storage.unavailable` | 降級處理，已裝 skill 不受影響 |
| 刪除不允許（非 owner） | 403 | `error.forbidden` | 提示無許可權 |

---

## 6. Core vs SaaS Adapter 能力分界

### 6.1 Core 已滿足的能力

說明：

下表表示“開源 Core 已具備、可供 SaaS 封裝”的能力，並不表示 AstronClaw 應直接呼叫這些開源介面。

| PRD 需求 | Core 介面 | 滿足程度 | 備註 |
|---------|----------|---------|------|
| skill 唯一標識查詢 | `GET /{namespace}/{slug}` | 完全滿足 | 返回 `id`、`namespace`、`slug` |
| 指定版本安裝後設資料 | `GET /{namespace}/{slug}/versions/{version}` | 基本滿足 | 返回 status、metadata；`package_name` 在 `parsedMetadataJson` 中 |
| 版本解析 | `GET /{namespace}/{slug}/resolve` | 完全滿足 | 支援 version/tag/hash 解析 |
| bundle 下載 | `GET /{namespace}/{slug}/versions/{version}/download` | 完全滿足 | 直接下載 |
| 建立（發布）個人 skill | `POST /{namespace}/publish` | 完全滿足 | 返回 skillId、namespace、slug、version、status |
| 刪除個人 skill | `DELETE /{namespace}/{slug}` (ClawHub 相容) | 完全滿足 | owner 可操作 |
| 歸檔 skill | `POST /{namespace}/{slug}/archive` | 完全滿足 | 可逆操作 |
| 版本狀態查詢 | `GET /{namespace}/{slug}` 中的 headlineVersion/publishedVersion | 完全滿足 | 包含版本狀態 |
| labels 資料 | `GET /{namespace}/{slug}` 中的 labels 欄位 | 完全滿足 | 返回 `List<SkillLabelDto>` |

### 6.2 需要 SaaS Adapter 新增的能力

| PRD 需求 | 原因 | Adapter 建議 |
|---------|------|-------------|
| 市場列表查詢（搜尋/過濾/排序） | Core 不提供面向頁面的聚合列表 | `GET /api/v1/astronclaw/adapter/skills/market` |
| 市場詳情（AstronClaw DTO） | Core 返回的 DTO 包含 Core 內部欄位，需適配 | `GET /api/v1/astronclaw/adapter/skills/{id}` |
| owner 維度"我建立的"查詢 | Core 的 `/me/skills` 返回 Core DTO，需適配 | `GET /api/v1/astronclaw/adapter/skills/mine` |
| `is_installed` 補全 | 安裝關係在 AstronClaw 側 | AstronClaw 本地補全，不在 Adapter |
| `package_name` 頂層欄位 | 當前在 `parsedMetadataJson` 內，需提取 | Adapter 解析 JSON 後平鋪返回 |
| `bundle_url` 直接返回 | 當前需透過 download 介面獲取 | Adapter 可直接返回預簽名 URL |
| 統一 `can_install` 判斷 | 需組合 status + visibility + bundleReady | Adapter 計算後返回布林值 |
| 統一 `can_delete` 判斷 | 需組合 owner + status | Adapter 計算後返回布林值 |

### 6.3 分界原則

```
Core 負責：skill 生命週期真相（identity、version、status、artifact）
Adapter 負責：面向 AstronClaw 的 DTO 適配（欄位平鋪、狀態聚合、許可權預判斷）
```

補充原則：

1. 即使開源 `Core` 已經具備某項主鏈路能力，`AstronClaw` 仍應統一透過 SaaS Adapter 消費。
2. 該原則同時適用於唯一標識查詢、版本後設資料、建立個人 skill、刪除個人 skill。
3. 開原始檔中的介面清單用於說明 `Core` 能力邊界，不應被解讀為 AstronClaw 的直接對接建議。

---

## 7. 成功 / 失敗 / 邊界樣例

### 7.1 查詢 skill identity — 成功

```
GET /api/v1/skills/my-namespace/my-skill
```

```json
{
  "code": 0,
  "data": {
    "id": 42,
    "slug": "my-skill",
    "displayName": "My Skill",
    "ownerId": "user-123",
    "status": "ACTIVE",
    "visibility": "PUBLIC",
    "namespace": "my-namespace",
    "labels": [{"slug": "nlp", "type": "CATEGORY", "displayName": "NLP"}],
    "headlineVersion": {"id": 100, "version": "1.2.0", "status": "PUBLISHED"},
    "publishedVersion": {"id": 100, "version": "1.2.0", "status": "PUBLISHED"}
  }
}
```

AstronClaw 對映關鍵欄位：`id=42`，`namespace=my-namespace`，`slug=my-skill`。

### 7.2 查詢 skill identity — 不存在

```
GET /api/v1/skills/my-namespace/nonexistent
```

```json
{
  "code": 404,
  "msg": "Skill not found",
  "data": null
}
```

### 7.3 查詢指定版本後設資料 — 成功

```
GET /api/v1/skills/my-namespace/my-skill/versions/1.2.0
```

```json
{
  "code": 0,
  "data": {
    "id": 100,
    "version": "1.2.0",
    "status": "PUBLISHED",
    "changelog": "Bug fixes",
    "fileCount": 3,
    "totalSize": 102400,
    "publishedAt": "2026-04-01T10:00:00Z",
    "parsedMetadataJson": "{\"name\":\"my-skill\",\"package_name\":\"my_namespace__my_skill\",\"version\":\"1.2.0\"}",
    "manifestJson": "{...}"
  }
}
```

`package_name` 從 `parsedMetadataJson` 中提取。

### 7.4 查詢已 YANKED 版本

```
GET /api/v1/skills/my-namespace/my-skill/versions/1.0.0
```

```json
{
  "code": 0,
  "data": {
    "id": 98,
    "version": "1.0.0",
    "status": "YANKED",
    "publishedAt": "2026-03-01T10:00:00Z"
  }
}
```

AstronClaw 判斷 `status != PUBLISHED`，拒絕新安裝。已裝例項不受影響。

### 7.5 發布（建立）個人 skill — 成功

```
POST /api/v1/skills/my-namespace/publish
Content-Type: multipart/form-data
file: <skill-package.tar.gz>
visibility: PRIVATE
```

```json
{
  "code": 0,
  "data": {
    "skillId": 43,
    "namespace": "my-namespace",
    "slug": "new-skill",
    "version": "0.1.0",
    "status": "DRAFT",
    "fileCount": 2,
    "totalSize": 51200
  }
}
```

### 7.6 刪除個人 skill — 成功

```
DELETE /api/v1/skills/my-namespace/my-skill
```

```json
{
  "code": 0,
  "data": {
    "ok": true
  }
}
```

### 7.7 刪除個人 skill — 無許可權

```
DELETE /api/v1/skills/other-namespace/other-skill
```

```json
{
  "code": 403,
  "msg": "Forbidden",
  "data": null
}
```

### 7.8 邊界：skill 已歸檔後查詢

```
GET /api/v1/skills/my-namespace/archived-skill
```

```json
{
  "code": 0,
  "data": {
    "id": 44,
    "slug": "archived-skill",
    "status": "ARCHIVED",
    "visibility": "PUBLIC"
  }
}
```

skill 仍可查詢，但 AstronClaw 應根據 `status=ARCHIVED` 判斷不可新裝。

---

## 8. 遺留問題與建議

### 8.1 `package_name` 提取

當前 `package_name` 巢狀在 `parsedMetadataJson` JSONB 欄位中，不是頂層欄位。

建議：SaaS Adapter 在返回 AstronClaw DTO 時，解析 JSON 並將 `package_name` 提取為頂層欄位。Core 不需要改動。

### 8.2 `bundle_url` 獲取方式

當前沒有直接返回 `bundle_url` 的欄位，需透過 download 介面獲取。`ResolveVersionResponse` 中有 `downloadUrl` 欄位。

建議：SaaS Adapter 可透過 `resolve` 介面獲取 `downloadUrl`，或直接生成預簽名 URL 返回給 AstronClaw。

### 8.3 刪除介面許可權

當前 `DELETE /api/v1/skills/{namespace}/{slug}`（portal 路徑）需要 SUPER_ADMIN 許可權。ClawHub 相容介面 `DELETE /api/v1/skills/{canonicalSlug}` 允許 owner 操作。

建議：SaaS Adapter 應統一封裝 owner 可操作的刪除介面，對 AstronClaw 暴露穩定契約；AstronClaw 不直接依賴開源刪除介面路徑。

### 8.4 `hidden` 與 `status` 的關係

當前 `hidden` 是獨立於 `status` 的布林標記（管理員操作），而 `HIDDEN` 是 `SkillStatus` 列舉值之一但實際程式碼中 skill 的 status 列舉包含 `ACTIVE`、`HIDDEN`、`ARCHIVED`。

建議：SaaS Adapter 統一為 AstronClaw 提供一個 `is_visible` 聚合欄位，遮蔽內部 hidden 標記與 status 的複雜關係。
