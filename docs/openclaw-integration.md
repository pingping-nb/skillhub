# OpenClaw 整合指南

本檔案說明如何配置 ClawHub CLI 連線到 SkillHub 私有註冊中心，實現技能的搜尋、檢視和安裝。發布技能請使用第一方 SkillHub CLI。
> 不僅適用於 Openclaw，透過指定安裝目錄，可適用於其他的 CLI Coding Agent (Claude Code、OpenCode、Qcoder等) 或者 Agent 助手（Nanobot、CoPaw等）。

## 概述

SkillHub 提供 ClawHub 相容 API，覆蓋常用的只讀發現和安裝流程。透過簡單配置，您可以：

- 🔍 搜尋組織內的私有技能
- 📥 下載和安裝技能包
- ⭐ 收藏技能

當前相容邊界：

- 已驗證的 ClawHub CLI `0.23.3` 使用 `/api/v1/whoami`，與 SkillHub 相容層一致。
- ClawHub CLI 的發布協議依賴 SkillHub 未實現的上傳票據介面，因此 `clawhub publish` 和 `clawhub sync` 不屬於支援範圍。
- ClawHub CLI `0.23.3` 不會可靠地優先使用登入時儲存的私有 Registry；站點發現或預設地址可能覆蓋預期目標。每個終端會話都應設定 `CLAWHUB_REGISTRY`，或在命令中顯式傳入 `--registry`。
- canonical slug 使用 `--` 分隔 namespace 與 skill。SkillHub 會拒絕新建包含連續 `--` 的 namespace 或 skill slug，以保證新座標可無歧義解析；歷史或外部匯入的異常座標應先重新命名，再使用 ClawHub CLI。

## 快速開始

### 1. 配置 Registry 地址

為當前終端會話設定 SkillHub 註冊中心地址：

```bash
# 不依賴 login 配置的 Registry 解析順序
export CLAWHUB_REGISTRY=https://skillhub.your-company.com
```

### 2. 登入認證（可選）

對於**全域性名稱空間（@global）的公開技能（PUBLIC）**，無需登入即可下載。對於以下情況需要認證：

- 團隊名稱空間的技能（無論可見性）
- NAMESPACE_ONLY 或 PRIVATE 技能
- 收藏等需要登入的操作

```bash
# 使用 API Token 登入
npx clawhub login --token YOUR_API_TOKEN
# 如果使用 npm i -g clawhub 安裝過 clawhub，檔案中所有的 npx clawhub 命令都可以直接使用 clawhub 命令來執行

# 檢視當前登入使用者
npx clawhub whoami

# 退出當前使用者登入
npx clawhub logout

# 檢視幫助
npx clawhub --help
```

#### 獲取 API Token

1. 登入 SkillHub Web UI
2. 進入 **個人設定 → API Tokens**
3. 點選 **建立新 Token**
4. 設定 Token 名稱和許可權範圍
5. 複製生成的 Token

### 3. 搜尋/瀏覽/檢視技能

```bash
# 搜尋，顯示所有相關技能
npx clawhub search <skill-name>
# 搜尋，結果顯示前 5 個結果
npx clawhub search <skill-name> --limit 5  
# 顯示 skill 詳情
npx clawhub inspect <skill-name>
# 瀏覽最新技能
npx clawhub explore
npx clawhub explore --limit 20    # 前20個

# 示例
npx clawhub search find-skills
npx clawhub search find-skills --limit 5 
npx clawhub inspect find-skills

# 使用幫助
npx clawhub search --help
npx clawhub inspect --help
```

### 4. 安裝/更新/解除安裝技能

```bash
# 安裝
npx clawhub install <skill-name>
npx clawhub install <skill-name> --version <version number>   # 指定版本
npx clawhub install <skill-name> --force                      # 覆蓋已有
npx clawhub --dir <install-path> install <skill-name>         # 指定目錄

# 更新
npx clawhub update <skill-name>
npx clawhub update --all

# 解除安裝
npx clawhub uninstall <skill-name>

# 檢視已安裝 skills
npx clawhub list

# Claude Code 安裝 Skill 示例
npx clawhub --dir ~/.claude/skills install find-skills
CLAWHUB_WORKDIR=~/.claude/skills npx clawhub install find-skills

# 使用幫助
npx clawhub install --help
npx clawhub update --help
npx clawhub uninstall --help
npx clawhub list --help
```

### 5. 使用 SkillHub CLI 發布技能

ClawHub CLI `0.23.3` 的發布協議與 SkillHub 不相容。請使用第一方 SkillHub CLI：

```bash
export SKILLHUB_REGISTRY=https://skillhub.your-company.com
export SKILLHUB_TOKEN=YOUR_API_TOKEN
npx @astron-team/skillhub@latest publish ./my-skill --namespace global
npx @astron-team/skillhub@latest publish ./my-skill --namespace my-space
```

說明：
- 發布需要具有 `skill:publish` scope 的 API Token，以及目標 namespace 對應許可權。
- `clawhub login` 與 SkillHub CLI 不共享憑據；請為第一方 CLI 單獨設定 `SKILLHUB_TOKEN`。
- 第一方 CLI 使用獨立 namespace 引數，但仍遵循服務端 slug 校驗規則。

## API 端點說明

SkillHub 相容層提供以下端點：

| 端點 | 方法 | 說明 | 認證要求 |
|------|------|------|----------|
| `/api/v1/whoami` | GET | 獲取當前使用者資訊 | 必需 |
| `/api/v1/search` | GET | 搜尋技能 | 可選 |
| `/api/v1/resolve` | GET | 解析技能版本 | 可選 |
| `/api/v1/download/{slug}` | GET | 下載技能（重定向） | 可選* |
| `/api/v1/download` | GET | 下載技能（查詢引數） | 可選* |
| `/api/v1/skills/{slug}` | GET | 獲取技能詳情 | 可選 |
| `/api/v1/stars/{slug}` | POST | 收藏技能 | 必需 |
| `/api/v1/stars/{slug}` | DELETE | 取消收藏 | 必需 |
| `/api/v1/publish` | POST | 舊版相容發布端點；ClawHub CLI `0.23.3` 不使用 | 必需 |

說明：
- 相容層對外繼續使用 “latest” 語義，但這裡嚴格指向“最新已發布版本”
- 相容層內部實現應從統一 lifecycle projection 的 `publishedVersion` 對映，而不是自行推導“當前版本”

\* 下載端點認證要求：
- **全域性名稱空間（@global）的 PUBLIC 技能**：無需認證
- **團隊名稱空間的所有技能**：需要認證
- **NAMESPACE_ONLY 和 PRIVATE 技能**：需要認證

## 技能可見性說明

SkillHub 支援三種技能可見性級別，下載許可權規則如下：

### PUBLIC（公開）
- ✅ 任何人都可以搜尋和檢視
- ✅ **全域性名稱空間（@global）**：無需登入即可下載
- 🔒 **團隊名稱空間**：需要登入認證才能下載
- 📍 適用於組織內通用的、可公開分享的技能

### NAMESPACE_ONLY（名稱空間內可見）
- ✅ 名稱空間成員可以搜尋和檢視
- 🔒 需要登入且是名稱空間成員才能下載
- 📍 適用於團隊內部技能

### PRIVATE（私有）
- ✅ 僅所有者可以檢視
- 🔒 需要登入且是所有者才能下載
- 📍 適用於個人開發中的技能

**重要說明**：
- 全域性名稱空間（`@global`）的 PUBLIC 技能支援匿名下載，便於組織內廣泛分發
- 團隊名稱空間的所有技能（包括 PUBLIC）都需要認證，確保團隊邊界安全

## Canonical Slug 對映規則

SkillHub 內部使用 `@{namespace}/{skill}` 格式，但相容層會自動轉換為 ClawHub 風格的 canonical slug：

| SkillHub 內部座標 | Canonical Slug | 說明 |
|-------------------|----------------|------|
| `@global/my-skill` | `my-skill` | 全域性名稱空間技能 |
| `@my-team/my-skill` | `my-team--my-skill` | 團隊名稱空間技能 |

OpenClaw CLI 使用 canonical slug 格式，SkillHub 會自動處理轉換。

canonical 格式沒有轉義規則，因此 SkillHub 會拒絕新建包含連續 `--` 的 namespace 或 skill slug。若歷史或外部匯入資料繞過了該校驗，應先重新命名座標；第一方 SkillHub CLI 雖使用獨立 `--namespace` 引數，也不能繞過服務端 slug 校驗。

## 配置示例

### ClawHub CLI 環境變數配置

ClawHub CLI 透過環境變數配置：

```bash
# Registry 配置
export CLAWHUB_REGISTRY=https://skillhub.your-company.com

# 如需認證，先登入一次
clawhub login --token sk_your_api_token_here
```

### 環境變數配置

```bash
# Registry 配置
export CLAWHUB_REGISTRY=https://skillhub.your-company.com

# 可選：登入後再執行需要認證的命令
clawhub login --token sk_your_api_token_here
```

## 常見問題

### Q: 如何切換回公共 ClawHub？

```bash
# 取消設定自定義 Registry
unset CLAWHUB_REGISTRY

# ClawHub CLI 將使用預設的公共註冊中心
```

### Q: 下載技能時提示 403 Forbidden？

可能原因：
1. 技能屬於團隊名稱空間，需要登入
2. 技能是 NAMESPACE_ONLY 或 PRIVATE，需要登入
3. 您不是該名稱空間的成員
4. API Token 已過期

解決方法：
```bash
# 設定新的 Token 並重新登入
clawhub login --token YOUR_NEW_TOKEN

# 測試連線
curl https://skillhub.your-company.com/api/v1/whoami \
  -H "Authorization: Bearer YOUR_NEW_TOKEN"
```

**提示**：全域性名稱空間（@global）的 PUBLIC 技能可以匿名下載，無需認證。

### Q: 如何檢視我有權訪問的所有技能？

```bash
# 搜尋所有技能（會根據許可權過濾）
npx clawhub search ""
```

### Q: 使用 ClawHub CLI 發布為什麼失敗？

ClawHub CLI `0.23.3` 使用的上傳票據協議不在 SkillHub 相容範圍內。該錯誤不代表 API Token 已撤銷；請改用第一方 SkillHub CLI。

如果第一方 CLI 提示許可權不足：

- 發布者必須是目標名稱空間成員；`SUPER_ADMIN` 例外
- 普通成員可提交發布，是否直接發布或進入稽核由可見性和稽核規則決定
- 聯絡名稱空間管理員加入目標空間

### Q: 支援哪些 OpenClaw 版本？

SkillHub 相容層設計相容使用 ClawHub CLI 的工具。ClawHub CLI 透過 npm 分發：

```bash
# 安裝 ClawHub CLI
npm install -g clawhub

# 或使用 npx 直接執行
npx clawhub install my-skill
```

如遇到相容性問題，請提交 Issue。

## API 響應格式

### 搜尋響應示例

```json
{
  "results": [
    {
      "slug": "my-team--email-sender",
      "name": "Email Sender",
      "description": "Send emails via SMTP",
      "author": {
        "handle": "user123",
        "displayName": "John Doe"
      },
      "version": "1.2.0",
      "downloadCount": 150,
      "starCount": 25,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-03-10T14:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 版本解析響應示例

```json
{
  "slug": "my-skill",
  "version": "1.2.0",
  "downloadUrl": "/api/v1/skills/global/my-skill/versions/1.2.0/download"
}
```

### 發布響應示例

```json
{
  "id": "12345",
  "version": {
    "id": "67890"
  }
}
```

## 安全建議

1. **使用 HTTPS**：生產環境務必使用 HTTPS 連線
2. **Token 管理**：
   - 定期輪換 API Token
   - 不要在程式碼中硬編碼 Token
   - 使用環境變數或金鑰管理工具
3. **許可權最小化**：為 Token 分配最小必需許可權
4. **審計日誌**：定期檢查 SkillHub 審計日誌

## 故障排查

### 啟用除錯日誌

```bash
# 檢視詳細請求日誌
DEBUG=clawhub:* npx clawhub search my-skill

# 或使用 verbose 模式
npx clawhub --verbose install my-skill
```

### 測試連線

```bash
# 測試 Registry 連線
curl https://skillhub.your-company.com/api/v1/whoami \
  -H "Authorization: Bearer YOUR_TOKEN"

# 測試搜尋
curl "https://skillhub.your-company.com/api/v1/search?q=test"
```

## 進一步閱讀

- [SkillHub API 設計檔案](./06-api-design.md)
- [技能協議規範](./07-skill-protocol.md)
- [認證與授權](./03-authentication-design.md)
- [部署指南](./09-deployment.md)

## 支援

如有問題或建議：
- 📖 檢視完整檔案：https://zread.ai/iflytek/skillhub
- 💬 GitHub Discussions：https://github.com/iflytek/skillhub/discussions
- 🐛 提交 Issue：https://github.com/iflytek/skillhub/issues
