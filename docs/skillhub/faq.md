# 常見問題

## Q: SkillHub 和 ClawHub 有什麼區別？

A: SkillHub 是企業級的自託管方案，提供了更強的許可權控制、稽核機制和治理能力。ClawHub 是公共註冊中心，類似 npm。

**主要區別**：

| 特性 | SkillHub | ClawHub |
|------|----------|---------|
| **部署方式** | 自託管 | 公共雲 |
| **許可權控制** | 名稱空間 RBAC | 基礎許可權 |
| **稽核機制** | 多級稽核 | 無 |
| **安全掃描** | 內建 Skill Scanner | 無 |
| **資料主權** | 完全自主 | 託管在雲端 |
| **適用場景** | 企業內部 | 公開分享 |

## Q: 如何備份資料？

A: SkillHub 的資料儲存在 PostgreSQL 和物件儲存中。定期備份這兩部分即可。

**備份 PostgreSQL**：
```bash
pg_dump -h localhost -U postgres skillhub > backup.sql
```

**備份物件儲存**：
- 如果使用 MinIO，備份 MinIO 資料目錄
- 如果使用 S3，使用 AWS CLI 或 S3 備份工具

## Q: 支援哪些認證方式？

A: SkillHub 支援多種認證方式：

- **OAuth2**：GitHub、Google、GitLab 等
- **本地賬號**：使用者名稱密碼登入（內建管理員：admin / ChangeMe!2026）
- **企業 SSO**：可以整合 LDAP、SAML 等

配置方式參考專案 README 中的認證配置章節。

## Q: 技能包大小有限制嗎？

A: 預設限制為 **100MB**。可以透過配置調整：

```yaml
# application.yml
spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 100MB
```

## Q: 如何使用 CLI 工具管理技能包？

A: SkillHub 相容 OpenClaw CLI，使用 `npx clawhub` 命令即可操作：

```bash
# 配置註冊中心地址
export CLAWHUB_REGISTRY=http://your-skillhub-host:8080

# 搜尋技能包
npx clawhub search email

# 安裝技能包
npx clawhub install my-skill

# 發布技能包（ClawHub CLI 的發布協議不相容 SkillHub）
export SKILLHUB_REGISTRY=http://your-skillhub-host:8080
export SKILLHUB_TOKEN=YOUR_API_TOKEN
npx @astron-team/skillhub@latest publish ./my-skill
```

## Q: 如何配置 HTTPS？

A: 生產環境建議使用 Nginx 或 Traefik 作為反向代理，配置 SSL 證書。

**Nginx 配置示例**：
```nginx
server {
    listen 443 ssl;
    server_name skillhub.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
    }
}
```

## Q: 如何監控 SkillHub？

A: SkillHub 提供了多種監控方式：

- **健康檢查**：`GET /actuator/health`
- **Scanner 健康檢查**：`GET http://localhost:8000/health`
- **指標監控**：`GET /actuator/metrics`（Prometheus 格式）
- **審計日誌**：所有關鍵操作都會記錄到審計日誌
- **應用日誌**：使用 ELK 或 Loki 收集日誌

## Q: 支援多租戶嗎？

A: SkillHub 透過名稱空間實現了邏輯上的多租戶隔離。每個名稱空間相當於一個租戶，擁有獨立的成員、許可權和技能包。

如果需要物理隔離，可以為每個租戶部署獨立的 SkillHub 例項。

## Q: 如何升級 SkillHub？

A: 使用 curl 命令升級：

```bash
# 拉取最新映象並重啟
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- pull
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- down
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up

# 或直接指定版本升級
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --version v0.2.0
```

> **注意**：升級前建議先備份資料庫和物件儲存。資料庫遷移由 Flyway 自動執行。升級不會清空資料庫，已錄入的技能包不會丟失。

## Q: 為什麼管理員（admin）和普通使用者都無法建立名稱空間？

A: 較舊版本的 SkillHub 不支援建立名稱空間。該功能是在後續版本迭代中新增的。請將您的 SkillHub 升級到最新版本（latest）。
升級命令示例：
```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --version latest
```

## Q: 如何搜尋或操作指定名稱空間中的技能包（Skill）？

A: 使用 OpenClaw CLI 命令列工具時，可以透過 `<namespace>--<skill-name>` 的格式來指定名稱空間進行操作（例如搜尋、安裝）。如果在網頁端搜尋遇到問題，也可以嘗試透過先匯出技能、再匯入到目標名稱空間的方式來完成跨空間操作。

## Q: 推薦的部署方式是什麼？可以自己拉映象手動部署嗎？

A: 推薦使用官方一鍵部署指令碼，不建議自己拉取映象手動部署（手動部署容易出現登入後跳回登入頁等初始化問題）：

```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --aliyun --public-url https://skillhub.your-company.com --version latest
```

指令碼會執行一系列初始化操作，生成的執行時配置預設位於 `/tmp/skillhub-runtime/`（包含 `.env.release` 和 docker-compose 檔案）。

## Q: 部署後輸入正確的賬號密碼，卻又跳回登入頁？

A: 該現象多見於「手動部署」場景（介面異常或初始化未完成導致）。建議：

1. 改用上面的一鍵指令碼部署。
2. 必要時清空 PostgreSQL 資料卷後重建再登入。
3. 若前置了反向代理，檢查代理配置是否正確轉發。

## Q: 如何修改 admin 密碼？修改配置後不生效？

A: 環境變數在容器建立時注入，修改後必須重新建立容器才會生效；僅執行 `restart` 不會重新注入環境變數。

1. 修改執行時目錄下的 `/tmp/skillhub-runtime/.env.release`（參考倉庫 [.env.release.example](https://github.com/iflytek/skillhub/blob/main/.env.release.example)）。
2. 重新建立相關容器：

   ```bash
   docker compose \
     --env-file /tmp/skillhub-runtime/.env.release \
     -f /tmp/skillhub-runtime/compose.release.yml \
     up -d --force-recreate
   ```

3. 若此前密碼已寫入資料庫導致仍不生效，可能需要清理對應資料後重新初始化。

## Q: 修改 / 找回密碼必須使用郵箱驗證碼嗎？

A: 是的，預設透過郵箱驗證碼修改或找回密碼，因此需要先配置 SMTP。配置方法參考 [docs/19-smtp-password-reset-email-setup.md](https://github.com/iflytek/skillhub/blob/main/docs/19-smtp-password-reset-email-setup.md)。管理員也可在 `.env.release` 中進行重置。

## Q: skill 可以起中文名嗎？

A: skill name 一般使用英文，目前不支援中文名（在 OpenClaw 中使用中文 skill 名會報錯）。

## Q: 未稽核的 skill 可以下載嗎？

A: 只要擁有可檢視的許可權，一般都可以下載。

## Q: 如何隱藏或刪除登入頁的 GitHub / GitLab SSO 登入方式？

A: 修改 `application.yml`，註釋或刪除 `spring.security.oauth2.client.registration` 下的 `github` 和 `gitlab` 兩塊，並刪除對應的 `provider` 段。Spring Boot 啟動時便不會建立這兩個註冊，登入頁也不會再顯示對應入口。

## Q: SkillHub 的安全掃描（Skill Scanner）是訊飛自研的嗎？使用什麼協議？

A: SkillHub 內建安全掃描能力。其中掃描接入、任務編排、審計落庫和部署整合由訊飛團隊實現；底層掃描服務使用 Cisco 的 [cisco-ai-skill-scanner](https://github.com/cisco-ai-defense/skill-scanner)（Apache License 2.0，版權歸 Cisco）。

## Q: SkillHub 使用的 cisco-ai-skill-scanner 是哪個版本？

A: `scanner/Dockerfile` 中直接執行 `pip install cisco-ai-skill-scanner`，未鎖定版本，因此構建映象時會拉取 PyPI 上的最新版本。如需固定版本，可在二次開發時自行鎖定。

## Q: 使用 CLI `skillhub publish` 報錯 `registry returned 400` 怎麼排查？

A: 400 通常是後端校驗未透過。常見原因：

- `SKILL.md` 不在技能包根目錄；
- `SKILL.md` 的 frontmatter 缺少 `name` / `description` 或格式錯誤；
- 名稱或版本衝突（如 `error.skill.publish.nameConflict`，表示該 namespace 下已存在同名的已發布技能）——可改 `SKILL.md` 裡的 `name`、換一個 namespace，或讓管理員處理已有同名技能；
- namespace 不存在，或你不是該 namespace 的成員；
- 包內含疑似 token/secret，CLI 無法確認跳過；
- 檔案型別 / 大小 / 路徑不合規。

可用以下命令檢視服務端日誌定位：

```bash
docker logs --tail=300 <skillhub-server 容器名> 2>&1 | grep -Ei 'publish|SKILL.md|namespace|400|BadRequest'
```

## Q: 技能包的目錄結構有什麼要求？

A: 技能包根目錄必須包含一個 `SKILL.md` 檔案，且其 frontmatter 需包含 `name`、`description` 等欄位。

## Q: 發布時報“技能包校驗失敗 / malformed input”怎麼辦？

A: 該錯誤發生在 zip 解包讀取檔名階段，通常是壓縮包不是 UTF-8 編碼（例如用 Windows 自帶壓縮工具生成）或包內含中文路徑導致。請使用 UTF-8 編碼重新打包，並避免中文 / 特殊字元路徑。

## Q: 技能包能包含多少個檔案？提示檔案數超限怎麼辦？

A: 預設上限為 **100 個檔案**（這與 100MB 的大小限制是兩回事）。如需放寬，修改配置項 `skillhub.publish.max-file-count`，或在部署時用環境變數覆蓋：

```bash
SKILLHUB_PUBLISH_MAX_FILE_COUNT=500
```

修改後需重新建立容器才會生效；僅執行 `restart` 不會重新注入環境變數。注意 `compose.release.yml` 中也需引用該變數；較舊版本（如 v0.2.6）可能將該值寫死，建議升級到最新版本。

## Q: 使用 CLI（發布 / 下載等）對服務端版本有要求嗎？

A: 需要 SkillHub 服務端映象 **v0.2.7 及以上** 才支援 CLI 功能。

## Q: SkillHub 支援 MySQL 資料庫嗎？

A: 目前僅支援 PostgreSQL，暫不支援 MySQL。

## Q: SkillHub 可以用來分發 Plugin 嗎？

A: 暫不支援。

## Q: 如何檢視 SkillHub 的版本？想做定製（如修改 logo）怎麼辦？

A:

- 檢視服務端映象版本：

```bash
docker image inspect ghcr.io/iflytek/skillhub-server:latest --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
```

- 檢視 CLI 版本：`skillhub version`。
- 如需定製（如修改 logo 等），建議基於最新程式碼進行二次開發並自行構建 docker 映象。

## Q: 頁面能開啟，但登入 / 註冊介面返回 502？

A: 頁面由 `web` 容器提供，登入、註冊等介面由 `web` 轉發給 `server`（預設 `SKILLHUB_API_UPSTREAM=http://server:8080`）。出現「頁面正常但 API 502」時，通常先檢查 `server` 是否正常啟動；upstream 配置、DNS 或容器網路異常也可能返回 502。

排查順序：

```bash
# 1. 看 server 是否處於執行狀態
docker compose --env-file .env.release -f compose.release.yml ps

# 2. 看 server 啟動日誌中的第一條錯誤
docker compose --env-file .env.release -f compose.release.yml logs server | head -50
```

一條常見的啟動失敗日誌是：

```
SKILLHUB_DOWNLOAD_ANON_COOKIE_SECRET must not use the default placeholder
```

說明 `server` 讀到的仍是模板裡的佔位值。在 `.env.release` 中改成自己的隨機字串（**至少 32 個字元**）後重建容器即可：

```bash
SKILLHUB_DOWNLOAD_ANON_COOKIE_SECRET=<替換成你自己的隨機字串，至少 32 個字元>
```

啟動前可以先執行 `make validate-release-config`，它會校驗 `.env.release`，提前暴露這類佔位值和缺失項。

## Q: 改了配置為什麼不生效？

A: 兩個高頻原因：

1. **改錯了檔案**：`.env.release.example` 只是模板，Compose 實際讀取的是 `--env-file` 指定的 `.env.release`。請先 `cp .env.release.example .env.release`，然後修改 `.env.release`。
2. **只重啟沒重建**：環境變數在容器建立時注入，`restart` 不會重新注入。改完配置需要重建容器：

```bash
docker compose --env-file .env.release -f compose.release.yml up -d --force-recreate
```

## Q: SkillHub 執行時需要哪些外部依賴？

A: 必需 PostgreSQL 和 Redis；物件儲存支援 `local` 與 S3 兩種模式，由 `SKILLHUB_STORAGE_PROVIDER` 控制。`.env.release.example` 顯式配置為 `local`，但如果使用 `compose.release.yml` 時完全沒有設定該變數，Compose 的回退值是 `s3`。建議始終顯式設定；生產環境推薦使用 S3（透過 `SKILLHUB_STORAGE_S3_*` 配置）。資料庫僅支援 PostgreSQL，暫不支援 MySQL。

發布版 Compose 已內建 PostgreSQL 與 Redis，預設只繫結在 `127.0.0.1`。

## Q: 透過 OAuth（GitHub / GitLab 等）登入的賬號，如何取得管理員許可權？

A: OAuth 首次登入建立的是普通使用者。需要由已有的 `SUPER_ADMIN`（例如初始化時的 bootstrap admin）在後臺將其提升為管理員。

`USER_ADMIN` 可以管理使用者狀態，並分配除 `SUPER_ADMIN` 之外的平臺角色；但不能向任何賬號授予 `SUPER_ADMIN`，也不能修改已有 `SUPER_ADMIN` 賬號的角色。這兩類操作只有 `SUPER_ADMIN` 可以執行。

## Q: 如何批次安裝多個技能包？

A: CLI 的 `install` 一次處理一個技能包。下面兩個示例都透過 `--dir` 將技能批次安裝到同一個目標根目錄；每個技能實際位於 `$target_dir/<skill-slug>/`：

```bash
target_dir=/opt/skillhub-skills

# 逐個安裝
for skill in skill-a skill-b skill-c; do
  skillhub install "$skill" --dir "$target_dir"
done

# 或從清單檔案讀取（每行一個技能名）
xargs -a skills.txt -I {} skillhub install "{}" --dir "$target_dir"
```

自 **SkillHub Server v0.2.12** 起，公開技能支援匿名搜尋與安裝；如果配置了無效的 Bearer Token，命令會直接失敗而不再回退匿名訪問，遇到這種情況請更新憑據或先移除無效 Token。

## Q: 遇到問題怎麼辦？

A: 可以透過以下方式獲取幫助：

- **GitHub Issues**: https://github.com/iflytek/skillhub/issues
- **線上檔案**: https://iflytek.github.io/skillhub/
- **檔案**: 參考專案 README.md
- **社群討論**: https://github.com/iflytek/skillhub/discussions

## Q: 本地開發啟動失敗怎麼辦？

A: `make dev-all` 後端啟動失敗時，會顯示詳細的錯誤提示。常見問題：

### 1. Maven 依賴下載失敗（網路超時）

**症狀**：後端日誌顯示 `Could not transfer artifact` 或連線超時

**解決方案**：配置阿里雲映象

```bash
# 複製專案內建的映象配置到使用者目錄
mkdir -p ~/.m2
cp server/.mvn/settings.xml ~/.m2/settings.xml
```

或手動建立 `~/.m2/settings.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
```

參考：[阿里雲 Maven 映象配置指南](https://maven.aliyun.com/mvn/guide)

### 2. Java 版本不匹配

**症狀**：`Unsupported class file major version` 或 `java.lang.NoSuchMethodError`

**解決方案**：安裝 Java 21+

```bash
# macOS
brew install openjdk@21

# 驗證版本
java -version
```

### 3. 埠被佔用

**症狀**：`Port 8080 already in use`

**解決方案**：

```bash
# 檢視佔用埠的程式
lsof -i :8080

# 終止程式
kill -9 <PID>
```

### 4. 檢視詳細日誌

如果以上方案無法解決，檢視後端日誌：

```bash
make dev-logs SERVICE=backend
# 或直接檢視
cat .dev/server.log
```
