# SkillHub SMTP 郵箱配置指南（驗證碼郵件）

本文說明如何為 SkillHub 配置 SMTP，用於傳送“密碼重置驗證碼”郵件。

適用場景：
- 生產/預發布環境（`compose.release.yml` + `.env.release`）
- 本地聯調環境（直接注入後端環境變數）

補充說明：
- SMTP 本質是郵件傳輸協議，不是單一廠商產品。
- 你可以使用企業郵箱、雲郵箱或本地測試 SMTP 服務（例如 MailHog）作為 SMTP 服務端。

當前密碼重置頁面入口說明：
- 當前前端統一使用 `/reset-password` 頁面。
- 該頁面同時包含“傳送驗證碼”和“提交新密碼”兩步，不再單獨使用 `/forgot-password`。

## 1. 需要配置的環境變數

以下變數已被後端讀取：

| 變數名 | 說明 | 示例 |
|---|---|---|
| `SPRING_MAIL_HOST` | SMTP 伺服器地址 | `smtp.example.com` |
| `SPRING_MAIL_PORT` | SMTP 埠 | `465` |
| `SPRING_MAIL_USERNAME` | SMTP 使用者名稱 | `noreply@example.com` |
| `SPRING_MAIL_PASSWORD` | SMTP 密碼/授權碼 | `xxxxxx` |
| `SPRING_MAIL_SMTP_AUTH` | 是否啟用 SMTP AUTH | `true` |
| `SPRING_MAIL_SMTP_STARTTLS_ENABLE` | 是否啟用 STARTTLS | `false` |
| `SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE` | 是否啟用 SMTP SSL 直連 | `true` |
| `SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST` | SSL 信任主機（用於規避部分環境下證書鏈校驗失敗） | `smtp.mail.example` |
| `SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY` | 驗證碼有效期（ISO-8601 Duration） | `PT10M` |
| `SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS` | 發件人郵箱 | `noreply@example.com` |
| `SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME` | 發件人名稱 | `SkillHub` |

說明：
- 當前檔案統一按 `465 + SSL` 配置，不再展開 `587 + STARTTLS` 方案。
- 使用 `465` 時配置：`STARTTLS=false`、`SSL_ENABLE=true`。
- 若出現 `PKIX path building failed` / `SSLHandshakeException`，可嘗試增加 `SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=<SMTP_HOST>`（本地聯調常用）。
- 生產環境預設不建議配置 `SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST`，僅在證書鏈異常時臨時啟用。
- `SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY` 支援如 `PT5M`、`PT10M`、`PT30M`。

## 1.1 配置方案速查（推薦）

### A. 通用 SMTP 郵箱（本地直連真實郵箱）

```dotenv
SPRING_MAIL_HOST=smtp.mail.example
SPRING_MAIL_PORT=465
SPRING_MAIL_USERNAME=mailer@example.com
SPRING_MAIL_PASSWORD=your-smtp-app-password
SPRING_MAIL_SMTP_AUTH=true
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example
SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY=PT10M
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=mailer@example.com
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=your-from-name
```

本地 `export` 示例寫法：

```bash
export SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example
export SPRING_MAIL_HOST=smtp.mail.example
export SPRING_MAIL_PORT=465
export SPRING_MAIL_USERNAME=mailer@example.com
export SPRING_MAIL_PASSWORD=your-smtp-app-password
export SPRING_MAIL_SMTP_AUTH=true
export SPRING_MAIL_SMTP_STARTTLS_ENABLE=false
export SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true
export SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY=PT10M
export SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=mailer@example.com
export SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=your-from-name
```

### B. MailHog（本地聯調推薦）

```dotenv
SPRING_MAIL_HOST=127.0.0.1
SPRING_MAIL_PORT=1025
SPRING_MAIL_USERNAME=
SPRING_MAIL_PASSWORD=
SPRING_MAIL_SMTP_AUTH=false
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=false
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=noreply@skillhub.local
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=SkillHub
```

### C. 線上部署（465 埠示例）

```dotenv
SPRING_MAIL_HOST=smtp.mail.example
SPRING_MAIL_PORT=465
SPRING_MAIL_USERNAME=mailer@example.com
SPRING_MAIL_PASSWORD=your-smtp-app-password
SPRING_MAIL_SMTP_AUTH=true
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example
SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY=PT10M
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=mailer@example.com
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=your-from-name
```

## 2. 單機交付（Compose）配置步驟

1. 複製環境模板（若尚未建立）：

```bash
cp .env.release.example .env.release
```

2. 編輯 `.env.release`，填寫 SMTP 變數：

```dotenv
SPRING_MAIL_HOST=smtp.mail.example
SPRING_MAIL_PORT=465
SPRING_MAIL_USERNAME=mailer@example.com
SPRING_MAIL_PASSWORD=your-smtp-app-password
SPRING_MAIL_SMTP_AUTH=true
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example

SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY=PT10M
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=mailer@example.com
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=your-from-name
```

3. 重啟後端容器使配置生效：

```bash
docker compose --env-file .env.release -f compose.release.yml up -d server
```

4. 檢視後端日誌確認啟動正常：

```bash
docker compose --env-file .env.release -f compose.release.yml logs -f server
```

## 3. 本地開發配置與驗證

### 3.1 一次性臨時生效（推薦）

適合當前終端臨時測試，重開終端後失效。

```bash
SPRING_MAIL_HOST=smtp.mail.example \
SPRING_MAIL_PORT=465 \
SPRING_MAIL_USERNAME=mailer@example.com \
SPRING_MAIL_PASSWORD=your-smtp-app-password \
SPRING_MAIL_SMTP_AUTH=true \
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false \
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=true \
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example \
SKILLHUB_AUTH_PASSWORD_RESET_CODE_EXPIRY=PT10M \
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=mailer@example.com \
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=your-from-name \
make dev-server
```

### 3.2 長期生效（shell 配置）

如果你寫到了 `~/.zshrc`，請注意：
- 必須 `source ~/.zshrc` 或重開終端後變數才會生效
- 需要在“同一個終端”啟動 `make dev-server`

可先確認變數是否在當前 shell 中：

```bash
env | rg '^(SPRING_MAIL_|SKILLHUB_AUTH_PASSWORD_RESET_)'
```

### 3.3 推薦聯調方式（MailHog）

如果你只是本地驗證驗證碼鏈路，建議用 MailHog 作為本地 SMTP 服務：

1. 啟動 MailHog：

```bash
docker run -d --name skillhub-mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog
```

2. 啟動依賴服務（Postgres/Redis）：

```bash
make dev
```

3. 啟動後端時注入 SMTP 環境變數（示例）：

```bash
SPRING_MAIL_HOST=127.0.0.1 \
SPRING_MAIL_PORT=1025 \
SPRING_MAIL_USERNAME= \
SPRING_MAIL_PASSWORD= \
SPRING_MAIL_SMTP_AUTH=false \
SPRING_MAIL_SMTP_STARTTLS_ENABLE=false \
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_ENABLE=false \
SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS=noreply@skillhub.local \
SKILLHUB_AUTH_PASSWORD_RESET_FROM_NAME=SkillHub \
make dev-server
```

4. 開啟 MailHog Web UI 檢視郵件：

```text
http://localhost:8025
```

5. 在 SkillHub 頁面驗證流程：
- 開啟 `/reset-password`
- 輸入郵箱並點選“傳送驗證碼”
- 在 MailHog 中檢視驗證碼郵件
- 輸入郵箱 + 驗證碼 + 新密碼完成重置

6. 也可使用介面做快速驗證（示例）：

```bash
curl -X POST http://localhost:8080/api/v1/auth/local/password-reset/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-email@example.com"}'
```

## 4. 功能驗證（驗證碼郵件）

### 4.1 使用者自助找回

在 `/reset-password` 頁面點選“傳送驗證碼”後，系統會嘗試傳送驗證碼郵件。

說明：
- 為防止賬號列舉，自助介面總是返回通用成功提示。
- 即使郵件傳送失敗，介面也可能返回成功；請結合後端日誌確認實際傳送結果。

### 4.2 管理員觸發重置

管理員在使用者管理頁觸發“重置密碼”時，系統會強制傳送驗證碼；
若 SMTP 傳送失敗，會返回錯誤（便於運維排障）。

## 5. 常見問題排查

### 5.1 認證失敗（`535 Authentication failed`）

排查方向：
- 使用者名稱/密碼是否正確
- 郵箱服務是否要求“客戶端授權碼”而非登入密碼
- 發件賬號是否已開啟 SMTP 服務

### 5.2 連線超時或拒絕連線

排查方向：
- 主機到 SMTP 服務埠 `465` 是否可達
- 安全組/防火牆是否放行出站連線
- SMTP 服務地址是否填寫正確

### 5.3 本地明明配置了變數但不生效

排查方向：
- 是否只是編輯了 `~/.zshrc` 但沒有 `source ~/.zshrc`
- 啟動後端的終端是否與配置變數的終端是同一個
- `8080` 是否被舊程式佔用，導致新程式沒啟動成功

可執行以下命令快速檢查：

```bash
# 檢視 8080 是否被舊程式佔用
lsof -nP -iTCP:8080 -sTCP:LISTEN

# 檢視當前 shell 是否有 SMTP 環境變數
env | rg '^(SPRING_MAIL_|SKILLHUB_AUTH_PASSWORD_RESET_)'
```

### 5.4 發件人被拒絕

排查方向：
- `SKILLHUB_AUTH_PASSWORD_RESET_FROM_ADDRESS` 是否與 SMTP 賬號一致或已驗證
- 郵箱服務是否限制別名發件

### 5.5 健康檢查是否校驗 SMTP

預設配置下，郵件健康檢查關閉，不會因為 SMTP 不可達導致 `health` 失敗。

若需要將 SMTP 連通性納入健康檢查，可設定：

```dotenv
MANAGEMENT_HEALTH_MAIL_ENABLED=true
```

### 5.6 SMTP 報 `PKIX path building failed`（證書鏈校驗失敗）

典型日誌：
- `SSLHandshakeException`
- `unable to find valid certification path to requested target`

處理建議（本地聯調）：
- 增加：

```dotenv
SPRING_MAIL_PROPERTIES_MAIL_SMTP_SSL_TRUST=smtp.mail.example
```

- 然後重啟後端，再觸發一次“傳送驗證碼”。

補充：
- 該配置用於指定信任主機，適合本地排障與聯調。
- 生產環境預設不建議長期啟用該配置，更推薦使用規範 CA 證書鏈或將企業 CA 匯入 Java truststore。

## 6. 安全建議

- 不要把 SMTP 密碼提交到倉庫；僅寫入受控的 `.env.release` 或金鑰管理系統。
- 使用專用發信賬號，避免使用個人郵箱主密碼。
- 生產環境建議定期輪換 SMTP 授權碼。
