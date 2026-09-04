# 註冊時自動建立個人名稱空間

## 背景

自建部署裡常見的訴求：每個新賬號都應該有一塊屬於自己的地盤，可以直接發布技能，
而不必先向管理員申請名稱空間、也不必把半成品塞進 `global`。

## 一、自動建立個人名稱空間

### 「私有」在當前模型裡的含義

名稱空間沒有可見性欄位——只有 `GLOBAL` 和 `TEAM` 兩種型別，
技能的可見性是技能自己的屬性。因此這裡的「私有名稱空間」= **一個只有本人為成員的 TEAM 名稱空間**。
本人拿到的是 `OWNER` 角色（比 `ADMIN` 更強：可以改設定、管成員、刪除）。

如果要做到「別人搜不到這個名稱空間」，那是獨立的 namespace visibility 特性，不在本次範圍內。

### 觸發時機

在賬號**第一次變得可用**時觸發，共三處，均發布 `UserActivatedEvent`：

| 入口 | 位置 |
|------|------|
| 本地註冊 | `LocalAuthService.register` |
| 外部身份首次登入 | `IdentityBindingService.bindOrCreate`（僅 `initialStatus == ACTIVE`） |
| 管理員審批 / 解封 | `AdminUserAppService.updateUserStatus`（僅從非 ACTIVE 轉為 ACTIVE） |

第三處不可省略：開啟了准入審批的部署裡，使用者在 OAuth 首次嘗試時就以 `PENDING` 建號，
真正可用是在管理員審批那一刻。

### 為什麼走事件 + AFTER_COMMIT

`PersonalNamespaceProvisioningListener` 用 `@TransactionalEventListener`
（預設 AFTER_COMMIT）並在自己的事務裡建名稱空間。原因是資料庫約束：

```
namespace.created_by      REFERENCES user_account(id)
namespace_member.user_id  REFERENCES user_account(id)
```

- 如果**加入註冊事務**：名稱空間建立失敗（例如 slug 競態撞唯一約束）會把註冊一起回滾，
  使用者會因為「名稱空間沒建成」而登不上來。
- 如果在註冊事務中**用 `REQUIRES_NEW` 掛起**：新事務看不到尚未提交的 `user_account` 行，
  外來鍵檢查會阻塞在外層事務的行鎖上，形成互等。

放到提交之後就同時避開了這兩點：賬號已經落庫，建名稱空間失敗只損失一個名稱空間，
監聽器捕獲異常並記 WARN。

監聽器**不加 `@Async`**：名稱空間要在使用者下一個請求到達前就緒。

### 命名模板

兩個模板，佔位符語法 `${...}`：

| 佔位符 | 取值 |
|--------|------|
| `${username}` | 認證路徑提供的使用者名稱；缺失時依次回落到郵箱字首、使用者 ID |
| `${email_prefix}` | 郵箱 `@` 之前的部分 |
| `${user_id}` | 平臺內部使用者 ID |

未知佔位符原樣保留，讓拼錯的名字暴露出來，而不是靜默消失。

slug 模板渲染後按 `SlugValidator` 的規則歸一化：轉小寫、
字母數字以外的字元變連字元、去掉首尾與重複連字元。
**注意下劃線不合法**——`${username}_space` 會得到 `alice-space`。
衝突處理：候選 slug 若非法（保留字如 `admin`、長度不足）或已被佔用，
依次嘗試 `-2`、`-3`……最多 64 次；全部失敗則跳過並記 WARN。
`admin` 這類保留字因此自然落到 `admin-2`。

冪等：使用者若已經擁有任意非 GLOBAL 名稱空間，直接跳過。
解封會再次發布 `UserActivatedEvent`，靠這條保證不會重複發一個名稱空間。

## 二、配置

| 位置 | 項 | 預設 |
|------|-----|------|
| `application.yml` | `skillhub.namespace.personal-provisioning.enabled` | `false` |
| 配置檔案/環境變數 | 啟用開關 | `true` |

預設只對新啟用賬號生效，不回填已有賬號；如需關閉可設定環境變數。

模板刻意**不放在 `application.yml`**：它們含 `${...}`，
Spring 會當成屬性佔位符去解析（Boot 3.2 / Framework 6.1 尚不支援轉義 `\${`）。
模板預設值固定為 `personal-${random}` 和 `${username}-個人空間`，
如需關閉可設定 `SKILLHUB_NAMESPACE_PERSONAL_PROVISIONING_ENABLED=false`。
