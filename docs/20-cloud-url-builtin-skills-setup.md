# 雲端儲存連結內建 Skills 配置指南

本文說明如何透過倉庫內 manifest 配置 SkillHub 內建 Skills，以及應用啟動時這些 Skills 如何從雲端儲存同步到 `@global` 空間。

適用場景：

- 希望 SkillHub 新部署例項預設帶有一批官方內建 Skills。
- 希望內建內容的來源、許可證和修改可以在開源倉庫中審查。
- 內建 Skill 包已經上傳到官方可控的雲端儲存域名。

## 1. 方案概覽

內建 Skill 的審查後原始碼維護在倉庫的 `builtin-skills/skills/` 中，但執行時不直接讀取這些
目錄。發布流程先生成確定性 zip 並上傳雲端儲存；應用啟動時根據 manifest 中的 URL 下載製品，
再透過 SkillHub 現有發布鏈路發布到 `@global`。

流程：

```text
維護審查後原始碼 -> 校驗與打包 -> 上傳不可變製品 -> 更新 manifest -> 構建/部署 SkillHub 映象 -> 應用 ready -> 下載並校驗 zip -> 發布到 @global
```

核心檔案：

```text
builtin-skills/catalog.json
builtin-skills/evals.json
builtin-skills/skills/<slug>/
scripts/build-builtin-skills.py
server/skillhub-app/src/main/resources/builtin-skills/manifest.json
```

manifest 需要維護四個欄位：

- `slug`：Skill 在 `@global` 下的 slug。
- `version`：期望同步的 Skill 版本。
- `url`：Skill zip 包的雲端儲存 HTTPS 連結。
- `sha256`：發布製品的 SHA-256，小寫 64 位十六進位制字串。

## 2. Manifest 配置

manifest 檔案格式如下：

```json
{
  "skills": [
    {
      "slug": "skillhub-hello",
      "version": "1.0.0",
      "url": "https://bjcdn.openstorage.cn/aicontest/2026-06-11/f8a59af3-30d4-4031-80f6-ebff74b05195.zip",
      "sha256": "acb591ed0891e735c364b955f5b94b2b9ce567c1d9e347312cebfbfde2d93f57"
    }
  ]
}
```

可以配置多個 Skills，也可以為同一個 `slug` 配置多個版本：

```json
{
  "skills": [
    {
      "slug": "skillhub-hello",
      "version": "1.0.0",
      "url": "https://bjcdn.openstorage.cn/<path-to-builtin-skill-zip>/skillhub-hello-1.0.0.zip",
      "sha256": "<sha256-of-skillhub-hello-1.0.0.zip>"
    },
    {
      "slug": "skillhub-hello",
      "version": "1.1.0",
      "url": "https://bjcdn.openstorage.cn/<path-to-builtin-skill-zip>/skillhub-hello-1.1.0.zip",
      "sha256": "<sha256-of-skillhub-hello-1.1.0.zip>"
    },
    {
      "slug": "skillhub-guide",
      "version": "1.0.0",
      "url": "https://bjcdn.openstorage.cn/<path-to-builtin-skill-zip>/skillhub-guide-1.0.0.zip",
      "sha256": "<sha256-of-skillhub-guide-1.0.0.zip>"
    }
  ]
}
```

配置要求：

- `skills` 必須是陣列。
- 每一項必須同時填寫 `slug`、`version`、`url`、`sha256`。
- `slug` 必須符合 SkillHub slug 規則。
- `sha256` 必須是小寫 64 位十六進位制字串，並與 URL 返回的原始 zip 位元組一致。
- 同一個 `slug + version` 重複出現時，只處理第一條，後續重複項會被跳過。
- manifest 最多處理前 100 條 entries。
- 同一個 `slug` 的多個版本建議按從舊到新的順序排列；執行時按 manifest 檔案順序處理，不做自動版本排序。

## 3. Skill 包要求

manifest 中的 `url` 必須指向 zip 包。zip 包需要滿足 SkillHub Skill 包協議：

- zip 可以在根目錄直接包含 `SKILL.md`，也可以包含一個單獨的頂層 Skill 目錄，並在該目錄下包含 `SKILL.md`。
- `SKILL.md` frontmatter 中必須包含合法的 `name`、`description`、`version` 等後設資料。
- `SKILL.md` 中的 `name` 經過 slug 歸一化後，必須等於 manifest 中的 `slug`。
- `SKILL.md` 中的 `version` 必須等於 manifest 中的 `version`。
- 包內容仍會經過 SkillHub 現有發布校驗，包括檔案數量、檔案大小、副檔名、檔案型別等規則。

示例：

```text
skillhub-hello-1.0.0.zip
├── SKILL.md
├── LICENSE.txt
├── NOTICE.md
└── scripts/
    └── check.js
```

同樣支援標準單目錄 Skill 包：

```text
skillhub-hello-1.0.0.zip
└── skillhub-hello/
    ├── SKILL.md
    ├── LICENSE.txt
    └── NOTICE.md
```

如果 zip 中存在多個頂層目錄，或在多個目錄中同時出現 `SKILL.md`，同步器會跳過該項並記錄錯誤，避免誤選入口。

## 4. URL 安全限制

內建 Skill 同步由後端在啟動時主動下載遠端檔案，因此 URL 有嚴格限制。

首版只允許：

- `https://` 協議。
- host 為 `bjcdn.openstorage.cn`。
- host 為 `bjcdn.openstorage.cn` 的子域名，例如 `assets.bjcdn.openstorage.cn`。
- 預設 HTTPS 埠，或顯式 `:443`。

以下 URL 會被跳過：

- `http://...`
- 非 `bjcdn.openstorage.cn` 及其子域名。
- 帶 userinfo 的 URL，例如 `https://user:pass@bjcdn.openstorage.cn/file.zip`。
- 非 443 埠，例如 `https://bjcdn.openstorage.cn:8443/file.zip`。
- `localhost`、IP 地址、IPv6 literal 等 host。
- 需要 HTTP redirect 才能拿到檔案的連結。

如果某一項 URL 不符合規則，SkillHub 會記錄日誌並跳過該項，不會阻塞應用啟動。

## 5. 啟動同步流程

應用 ready 後同步器會在後臺執行一次，不阻塞應用 ready。

詳細流程：

1. 檢查 `skillhub.builtin-skills.enabled` 是否開啟。
2. 讀取 `classpath:builtin-skills/manifest.json`。
3. 查詢 `@global` 名稱空間是否存在；如果不存在，跳過同步。
4. 確保系統發布者 `builtin-skill-publisher` 存在，並且該賬號帶有系統賬號標記。
5. 如果該使用者 ID 已被非系統賬號佔用，直接跳過本次內建 Skill 同步，不授予 `@global` 許可權。
6. 如果系統發布者還不是 `@global` 成員，則建立 `OWNER` 成員記錄；已有成員記錄不會自動改角色。
7. 按 manifest 順序處理每一個 item。
8. 下載前先檢查 `@global/{slug}` 和目標版本是否已經存在；如果已經確定應跳過，則不發起遠端下載。
9. 只有需要發布新 Skill 或新版本時，才下載對應 zip 包。
10. 對下載到的原始 zip 位元組計算 SHA-256，並與 manifest 的 `sha256` 比較；不一致時停止處理該項。
11. 解包並校驗 Skill 入口 `SKILL.md`。
12. 校驗 manifest 中的 `slug`、`version` 與包內後設資料一致。
13. 發布前再次檢查是否已存在同名 Skill 或同版本，處理併發啟動場景。
14. 需要發布時呼叫現有 `SkillPublishService.publishFromEntries(...)`。
15. 發布完成後，該 Skill 位於 `@global/{slug}`，可見性為 `PUBLIC`。

同步邏輯不會直接寫資料庫 seed 資料。它複用現有發布服務，因此會保留現有的包校驗、物件儲存寫入、版本記錄、latest version 更新、事件和搜尋索引同步。

## 6. 冪等與衝突處理

內建 Skill 同步支援重複啟動和多次部署。

冪等鍵：

```text
@global/{slug} + version
```

行為說明：

| 場景 | 行為 |
|---|---|
| `@global/{slug}` 不存在 | 發布 manifest 中的 Skill |
| `@global/{slug}` 已存在，owner 是 `builtin-skill-publisher`，但目標版本不存在 | 發布新版本 |
| 同版本已存在且已發布 | 下載前跳過 |
| 同版本已存在但不是 `PUBLISHED` | 下載前跳過並記錄日誌 |
| `@global/{slug}` 已被其他 owner 建立或發布 | 下載前跳過並記錄 warning |

這意味著內建同步不會接管使用者或管理員已經建立的同 slug Skill；即使該 Skill 仍處於待審、未發布或已拒絕狀態，也會跳過對應 manifest item。
同版本已存在時，同步器不會重新下載遠端 zip，也不會驗證遠端物件內容是否發生漂移。

如果多例項同時啟動，可能出現多個例項同時嘗試發布同一個內建版本。同步器會在發布失敗後重新查詢目標版本；如果發現同版本已經以相同內容發布成功，則視為併發場景下的正常跳過。

## 7. 開關配置

內建 Skill 同步預設開啟。

Spring 配置項：

```yaml
skillhub:
  builtin-skills:
    enabled: true
```

環境變數：

```dotenv
SKILLHUB_BUILTIN_SKILLS_ENABLED=true
```

如需禁用啟動同步：

```dotenv
SKILLHUB_BUILTIN_SKILLS_ENABLED=false
```

禁用後，應用 ready 後不會讀取 manifest，也不會下載或發布任何內建 Skill。

## 8. 維護流程

新增一個內建 Skill 的推薦步驟：

1. 將固定到上游 commit 的審查後原始碼加入 `builtin-skills/skills/<slug>/`。
2. 在包內保留 `LICENSE.txt`、`NOTICE.md`，在 catalog 和 evals 中登記後設資料與迴歸用例。
3. 執行 `make test-builtin-skills`，確認包結構、來源、許可證和確定性構建門禁透過。
4. 執行 `make build-builtin-skills`，從 `builtin-skills/dist/artifacts.json` 讀取製品雜湊。
5. 上傳 zip 到 `bjcdn.openstorage.cn` 或其子域名下的不可變路徑。
6. 在 `server/skillhub-app/src/main/resources/builtin-skills/manifest.json` 中新增一項，同時填寫製品 URL 和 `artifacts.json` 中對應的 SHA-256。
7. 本地或測試環境啟動 SkillHub，檢視後端日誌確認同步結果。
8. 在 Web UI 或 API 中確認 `@global/{slug}` 已公開可見。

更新一個已有內建 Skill 的推薦步驟：

1. 不要覆蓋已經發布過的舊版本 zip 內容。
2. 在 `SKILL.md` 中提升 `version`。
3. 重新打包並上傳新的 zip 檔案。
4. 在 manifest 中新增一條同 `slug`、新 `version` 的記錄。
5. 保留舊版本記錄，除非產品明確不再需要該舊版本在新例項中預置。

不推薦：

- 修改舊版本 zip 內容但保持同一個 `version`。
- 把 URL 指向會發生內容變化的臨時物件。
- 使用需要登入、簽名跳轉或重定向的下載連結。

## 9. 日誌與排查

啟動時可以透過後端日誌觀察同步結果。

常見日誌含義：

| 日誌含義 | 處理建議 |
|---|---|
| manifest not found | 確認 `builtin-skills/manifest.json` 是否被打進 classpath |
| publisher account id already exists but is not a system account | `builtin-skill-publisher` 已被普通賬號佔用；需要人工處理賬號衝突後再啟用內建同步 |
| slug, version, url, and sha256 are required | 檢查 manifest item 是否缺欄位或欄位不是字串 |
| slug is invalid | 檢查 slug 是否符合 SkillHub slug 規則 |
| sha256 must be 64 lowercase hexadecimal characters | 使用 `builtin-skills/dist/artifacts.json` 中對應製品的 SHA-256 |
| URL is not allowed | 檢查 URL 是否為 HTTPS、host 是否為 `bjcdn.openstorage.cn` 或其子域名 |
| package download failed | 檢查雲端儲存物件是否存在、是否返回 HTTP 200、是否超時 |
| package checksum mismatch | 雲端物件與 manifest 固定的製品不一致；不要繼續解包或發布，檢查是否上傳錯誤或物件被覆蓋 |
| package must contain SKILL.md | 檢查 zip 是否存在唯一可識別的 `SKILL.md` 入口 |
| manifest version does not match package version | 檢查 manifest `version` 和 `SKILL.md version` 是否一致 |
| slug already belongs to another user | 說明 `@global/{slug}` 已被非內建發布者建立或發布，內建同步不會覆蓋 |
| published fingerprint differs | 併發發布異常後發現同一內建版本已存在但內容不同，需要人工確認是否發生了版本衝突 |

如果某個 manifest item 失敗，後續 item 仍會繼續處理，應用可用狀態不受影響。

## 10. 驗收檢查

配置或新增內建 Skill 後，建議至少完成以下檢查：

- `make test-builtin-skills` 透過，且 15 個迴歸用例都有對應包。
- manifest JSON 格式合法。
- 每個 item 都包含 `slug`、`version`、`url`、`sha256`。
- 每個 `sha256` 都與 URL 下載到的原始 zip 位元組一致。
- URL 使用 `https://bjcdn.openstorage.cn/...` 或可信子域名。
- zip 根目錄直接包含 `SKILL.md`，或只有一個頂層 Skill 目錄且該目錄包含 `SKILL.md`。
- `SKILL.md name` 歸一化後的 slug 與 manifest `slug` 一致。
- `SKILL.md version` 與 manifest `version` 一致。
- 啟動日誌沒有該 item 的 warning 或 error。
- Web UI 中可以看到 `@global/{slug}`。
- Skill 可被匿名或登入使用者按公開 Skill 規則發現。
