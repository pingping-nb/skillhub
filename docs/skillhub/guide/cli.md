# SkillHub CLI

SkillHub CLI 是 SkillHub 的第一方命令列工具，用於搜尋、安裝、管理和發布 Agent 技能包。

## 安裝

```bash
# 透過 npm 全域性安裝
npm install -g @astron-team/skillhub

# 或使用 npx 直接執行（無需安裝）
npx @astron-team/skillhub@latest version

# 或透過 Bun 全域性安裝
bun add -g @astron-team/skillhub
```

## 快速開始

```bash
# 登入
skillhub login --token sk_xxx

# 搜尋技能
skillhub search pdf

# 安裝技能到 Agent 目錄
skillhub install pdf-parser --agent codex

# 檢視已安裝技能
skillhub list

# 發布技能
skillhub publish ./my-skill --namespace myspace
```

## Registry 配置

當前生效的 registry 按以下優先順序解析：

1. `--registry <url>` 命令列引數
2. `SKILLHUB_REGISTRY` 環境變數
3. 使用者配置檔案 `~/.skillhub/config.json` 中的 `registry` 欄位
4. 預設值 `https://skill.xfyun.cn`

```bash
# 臨時使用其他 registry
skillhub search pdf --registry https://skillhub.example.com

# 透過環境變數設定（Linux/macOS）
export SKILLHUB_REGISTRY=https://skillhub.example.com
```

**Windows PowerShell:**

```powershell
$env:SKILLHUB_REGISTRY="https://skillhub.example.com"
```

**Windows CMD:**

```cmd
set SKILLHUB_REGISTRY=https://skillhub.example.com
```

## 認證

Token 按以下優先順序解析：

1. `--token <token>` 命令列引數
2. `SKILLHUB_TOKEN` 環境變數
3. `~/.skillhub/credentials.json` 中儲存的 token（按 registry 區分）

### 登入

```bash
# 使用 API token 登入
skillhub login --token sk_xxx

# 指定 registry 登入
skillhub login --token sk_xxx --registry https://skillhub.example.com
```

`login` 會驗證 token 有效性，然後將 token 儲存到 `~/.skillhub/credentials.json`，同時將 registry 寫入 `~/.skillhub/config.json`。

API Token 請求被拒絕時，CLI 會顯示服務端返回的具體原因和 `Request ID`。排查問題時可使用該 ID 對照服務端日誌；非 API Token 的授權失敗仍只顯示通用資訊。

### 檢視當前身份

```bash
skillhub whoami

# 指定 registry 檢視
skillhub whoami --registry https://skillhub.example.com

# 臨時使用其他 token
skillhub whoami --token sk_other
```

### 登出

```bash
skillhub logout

# 登出指定 registry
skillhub logout --registry https://skillhub.example.com
```

登出只刪除對應 registry 的 token，保留 registry 配置和安裝記錄。

## 搜尋

```bash
# 關鍵詞搜尋
skillhub search pdf

# 列出所有技能（空字串查詢）
skillhub search "" --limit 50

# JSON 輸出
skillhub search pdf --json
```

輸出格式：`namespace/slug  version  summary`

## 安裝技能

安裝座標支援裸 slug（預設解析到 `global`）和三種等價的顯式 namespace
形式。顯式座標與 `--namespace` 同時出現時，兩者必須一致。

```bash
# 安裝到自動探測的 Agent 目錄
skillhub install pdf-parser

# 等價的 namespace 座標
skillhub install team/my-skill
skillhub install @team/my-skill
skillhub install team--my-skill

# 顯式指定安裝範圍
skillhub install pdf-parser --scope user
skillhub install pdf-parser --scope project --agent codex

# 為裸 slug 指定 namespace
skillhub install pdf-parser --namespace myspace

# 指定版本
skillhub install pdf-parser --version 1.2.0

# 安裝到指定 Agent
skillhub install pdf-parser --agent codex

# 安裝到多個 Agent
skillhub install pdf-parser --agent codex --agent claude-code

# 安裝到自定義目錄
skillhub install pdf-parser --dir ~/.claude/skills

# 強制覆蓋已存在的安裝
skillhub install pdf-parser --force
```

### 安裝目標解析

CLI 按以下邏輯確定安裝位置：

1. 指定 `--dir`：安裝到該目錄，agent 標記為 `custom`。`--dir` 與 `--scope`、`--agent` 互斥。
2. 指定 `--scope user|project`：探測限定在該 scope 內。
   - 同時指定 `--agent <profile>`：直接安裝到該 profile 對應 scope 的 skills 目錄。
   - 未指定 `--agent`：只探測該 scope 下已存在的 skills 目錄。在互動式 user scope 下，始終額外提供 `generic` 目標（`<home>/.agents/skills/`），可單獨選擇或與已探測目標同時選擇。
   - 該 scope 下未探測到 → fallback：`--scope user` 回退到 `<home>/.agents/skills/`，`--scope project` 回退到 `<cwd>/.agents/skills/`。
3. 指定 `--agent`（無 `--scope`）：安裝到對應 Agent 的 skills 目錄（沿用現有行為，不變）。
4. 三者均未指定：
   - **互動模式**（stdin 和 stdout 都是 TTY 且未傳 `--json`）：先互動式詢問 user 還是 project scope，再按 `--scope` 規則繼續。
   - **非互動模式**：自動掃描當前目錄探測已存在的 Agent 配置目錄。1 個 → 直接安裝；多個 → 報錯；未探測到 → 回退到 `<cwd>/.agents/skills/`。

> `--dir` 不能與 `--scope` 或 `--agent` 同時使用。

### 安裝路徑

每個 Agent 有專案級和使用者級兩個 skills 目錄。`--scope user|project` 決定使用哪一個。

| Agent | 專案級路徑 | 使用者級路徑 |
|-------|-----------|-----------|
| `claude-code` | `<project>/.claude/skills/` | `~/.claude/skills/` |
| `codex` | `<project>/.codex/skills/` | `~/.codex/skills/` |
| `cursor` | `<project>/.cursor/skills/` | `~/.cursor/skills/` |
| `github-copilot` | `<project>/.github-copilot/skills/` | `~/.github-copilot/skills/` |
| `gemini-cli` | `<project>/.gemini/skills/` | `~/.gemini/skills/` |
| `windsurf` | `<project>/.windsurf/skills/` | `~/.windsurf/skills/` |
| `kiro-cli` | `<project>/.kiro/skills/` | `~/.kiro/skills/` |
| `roo` | `<project>/.roo/skills/` | `~/.roo/skills/` |
| `trae` | `<project>/.trae/skills/` | `~/.trae/skills/` |
| `trae-cn` | `<project>/.trae-cn/skills/` | `~/.trae-cn/skills/` |
| `openhands` | `<project>/.openhands/skills/` | `~/.openhands/skills/` |
| `openclaw` | `<project>/.openclaw/skills/` | `~/.openclaw/skills/` |
| `opencode` | `<project>/.opencode/skills/` | `~/.opencode/skills/` |
| `kilo` | `<project>/.kilo/skills/` | `~/.kilo/skills/` |
| _fallback_ | `<project>/.agents/skills/` | `~/.agents/skills/` |

對於自定義路徑或不在列表中的 Agent 目錄，使用 `--dir` 顯式指定安裝路徑。互動式 user scope 下會與已探測 Agent 目標一同提供 `generic` 目標；當 `--scope user|project` 找不到匹配的 agent 目錄時，CLI 會回退到上表的 `_fallback_` 行。

### 安裝後的檔案結構

```
.codex/skills/pdf-parser/
├── ...                          # 技能包解壓後的檔案
└── .skillhub/
    └── metadata.json            # 安裝後設資料
```

`metadata.json` 內容示例：

```json
{
  "registry": "https://skill.xfyun.cn",
  "namespace": "global",
  "slug": "pdf-parser",
  "version": "1.0.0",
  "agent": "codex",
  "installedAt": "2026-04-28T06:00:00.000Z"
}
```

## 本地管理

### 檢視已安裝技能

```bash
# 列出所有已安裝技能
skillhub list

# 按 Agent 過濾
skillhub list --agent codex

# 按多個 Agent 過濾
skillhub list --agent codex --agent claude-code

# 按目錄過濾
skillhub list --dir ~/.codex/skills

# JSON 輸出
skillhub list --json
```

### 刪除技能

```bash
# 裸 slug 刪除所有 namespace 中的同名本地安裝
skillhub remove pdf-parser

# 顯式 namespace 座標只刪除該 namespace
skillhub remove myspace/pdf-parser
skillhub remove @myspace/pdf-parser
skillhub remove myspace--pdf-parser

# 使用 namespace 引數進行等價的精確本地刪除
skillhub remove pdf-parser --namespace myspace

# 只刪除指定 Agent 的安裝
skillhub remove pdf-parser --agent codex

# 刪除所有目標（跳過互動確認）
skillhub remove pdf-parser --all

# 刪除遠端技能（需要認證，會彈出確認提示）
skillhub remove pdf-parser --remote --namespace myspace

# 跳過遠端刪除確認
skillhub remove pdf-parser --remote --hard --namespace myspace
```

> 引數互斥規則：
> - `--all` 不能與 `--agent` 同時使用
> - `--remote` 不能與 `--agent` 或 `--all` 同時使用
> - 非互動環境下遠端刪除必須加 `--hard`

### 重建本地清單

```bash
skillhub doctor
```

`doctor` 執行以下操作：

1. 掃描 `<cwd>/.<agent>/skills/<slug>/.skillhub/metadata.json`
2. 按 `registry + namespace + slug` 分組
3. 備份舊的 `inventory.json`（如果存在）
4. 寫入新的 `inventory.json`

如果同一技能在不同目標中存在版本衝突，該技能會被跳過並報告。

## 發布

```bash
# 發布目錄（自動打包為 zip）
skillhub publish ./my-skill --namespace myspace

# 發布已有的 zip 檔案
skillhub publish ./my-skill.zip --namespace myspace

# 指定可見性
skillhub publish ./my-skill --namespace myspace --visibility private
```

可見性選項：
- `public`（預設）— 所有人可見
- `namespace-only` — 僅 namespace 成員可見
- `private` — 僅自己可見

發布成功後會輸出技能詳情頁 URL。

## 自更新

```bash
# 檢查是否有新版本
skillhub update --check

# 執行更新
skillhub update
```

更新機制：
- 透過 npm 全域性安裝：自動執行 `npm install -g @astron-team/skillhub@latest`
- 透過 Bun 全域性安裝：自動執行 `bun add -g @astron-team/skillhub@latest`
- 透過 npx 執行：提示手動更新命令
- 未知安裝方式：提示手動更新

## 環境變數

| 變數 | 說明 | 優先順序 |
|------|------|--------|
| `SKILLHUB_REGISTRY` | 預設 registry URL | 低於 `--registry` 引數 |
| `SKILLHUB_TOKEN` | API token | 低於 `--token` 引數，高於儲存的 token |

## 本地檔案結構

```
~/.skillhub/
├── config.json           # 使用者配置（registry、defaultAgent 等）
├── credentials.json      # API tokens（按 registry 儲存，許可權 0600）
└── inventory.json        # 已安裝技能清單
```

### config.json

```json
{
  "registry": "https://skill.xfyun.cn",
  "defaultAgent": "codex",
  "lastUpdateCheckAt": "2026-04-28T06:00:00.000Z"
}
```

### credentials.json

```json
{
  "tokens": {
    "https://skill.xfyun.cn": "sk_xxx",
    "https://skillhub.example.com": "sk_yyy"
  }
}
```

### inventory.json

```json
{
  "items": [
    {
      "registry": "https://skill.xfyun.cn",
      "namespace": "global",
      "slug": "pdf-parser",
      "version": "1.0.0",
      "targets": [
        {
          "agent": "codex",
          "rootDir": "/path/to/project/.codex/skills",
          "installDir": "/path/to/project/.codex/skills/pdf-parser",
          "installedAt": "2026-04-28T06:00:00.000Z"
        }
      ]
    }
  ]
}
```

## JSON 輸出

所有命令都支援 `--json` 引數，輸出機器可讀的 JSON 格式：

```bash
skillhub search pdf --json
skillhub list --json
skillhub whoami --json
skillhub install pdf-parser --json
skillhub remove pdf-parser --json
skillhub doctor --json
```

成功響應格式：

```json
{
  "ok": true,
  ...
}
```

錯誤響應格式：

```json
{
  "ok": false,
  "message": "error message",
  "exitCode": 2,
  "details": {
    "registry": "https://skill.xfyun.cn",
    "next": "run `skillhub login`"
  }
}
```

## 退出碼

| 退出碼 | 說明 |
|--------|------|
| 0 | 成功 |
| 1 | 通用錯誤 |
| 2 | 認證失敗 |
| 3 | 網路錯誤 |
| 4 | 檔案系統錯誤 |
| 5 | 引數錯誤 |

## 命令參考

### help

```bash
skillhub help
skillhub help install
```

顯示幫助資訊。

### version

```bash
skillhub version
skillhub version --json
```

顯示 CLI 版本。

### login

```bash
skillhub login --token <token> [--registry <url>] [--json]
```

儲存 token 和 registry 配置。

### logout

```bash
skillhub logout [--registry <url>] [--json]
```

刪除指定 registry 的 token。

### whoami

```bash
skillhub whoami [--registry <url>] [--token <token>] [--json]
```

驗證當前 token 並顯示使用者資訊。

### search

```bash
skillhub search <query> [--registry <url>] [--limit <n>] [--json]
```

搜尋已發布的技能。

### install

```bash
skillhub install <coordinate> [options]
```

`<coordinate>` 支援裸 slug（`my-skill`，解析為 `global/my-skill`）以及
`team/my-skill`、`@team/my-skill`、`team--my-skill` 三種等價的顯式
namespace 形式。裸 slug 可透過 `--namespace team` 選擇非 global namespace；
顯式座標可以同時傳入相同的 `--namespace`，但衝突值會作為用法錯誤被拒絕。

選項：
- `--scope <user|project>` — 安裝範圍（不傳時：TTY 模式下互動式詢問，非 TTY 模式沿用現有探測邏輯）
- `--namespace <slug>` — 為裸 slug 指定 namespace
- `--version <v>` — 版本（預設最新版本）
- `--agent <profile>` — Agent 配置（可重複）
- `--dir <path>` — 自定義安裝目錄（與 `--scope`、`--agent` 互斥）
- `--force` — 覆蓋已存在的安裝
- `--registry <url>` — Registry URL
- `--token <token>` — API token
- `--json` — JSON 輸出

### list

```bash
skillhub list [options]
```

選項：
- `--agent <profile>` — 按 Agent 過濾（可重複）
- `--dir <path>` — 按目錄過濾
- `--registry <url>` — Registry URL
- `--json` — JSON 輸出

### remove

```bash
skillhub remove <coordinate> [options]
```

選項：
- `--agent <profile>` — 按 Agent 過濾（可重複）
- `--all` — 刪除所有目標
- `--remote` — 刪除遠端技能
- `--hard` — 跳過遠端刪除確認
- `--namespace <slug>` — 本地或遠端刪除的 namespace
- `--registry <url>` — Registry URL
- `--token <token>` — API token
- `--json` — JSON 輸出

顯式名稱空間座標（`team/my-skill`、`@team/my-skill`、`team--my-skill`）或
`--namespace team` 只刪除該 namespace 中的本地安裝。為保持相容，裸 slug
會刪除當前 registry 中所有 namespace 下的同名本地安裝。

### doctor

```bash
skillhub doctor [--json]
```

掃描專案目錄，重建本地清單。

### publish

```bash
skillhub publish <path> [options]
```

選項：
- `--namespace <slug>` — Namespace
- `--visibility <v>` — 可見性（`public` | `namespace-only` | `private`）
- `--registry <url>` — Registry URL
- `--token <token>` — API token
- `--json` — JSON 輸出

### update

```bash
skillhub update [--check] [--json]
```

檢查或執行 CLI 自更新。

## 安全說明

- Token 只儲存在使用者目錄 `~/.skillhub/credentials.json`
- 在 Linux/macOS 上，憑據檔案許可權自動設定為 `0600`
- 不會將 token 寫入任何專案本地檔案
- 遠端刪除操作需要顯式確認或 `--hard` 引數
- `remove` 命令會驗證路徑安全性，防止刪除非技能目錄

## 故障排查

### 認證失敗

```bash
# 驗證 token 是否有效
skillhub whoami

# 重新登入
skillhub login --token sk_xxx
```

### 網路錯誤

```bash
# 檢查 registry 是否可訪問
curl https://skill.xfyun.cn/api/cli/v1/skills/search?q=test&limit=1

# 使用其他 registry
skillhub search test --registry https://skillhub.example.com
```

### 安裝目錄衝突

```bash
# 使用 --force 覆蓋
skillhub install pdf-parser --force

# 或先刪除再安裝
skillhub remove pdf-parser
skillhub install pdf-parser
```

### 清單損壞

```bash
# 重建清單
skillhub doctor
```

## 本地開發驗證

如果你在本地開發 SkillHub，可以這樣驗證 CLI：

```bash
# 1. 構建 CLI
cd cli
bun install
bun run build
bun link

# 2. 啟動本地後端
cd ..
make dev-all

# 3. 配置 CLI 連線本地服務（Linux/macOS）
export SKILLHUB_REGISTRY=http://localhost:8080

# Windows PowerShell:
# $env:SKILLHUB_REGISTRY="http://localhost:8080"

# Windows CMD:
# set SKILLHUB_REGISTRY=http://localhost:8080

# 4. 測試命令
skillhub search test
skillhub install example-skill --agent codex
skillhub list
```

## 相關連結

- [SkillHub 主頁](https://skill.xfyun.cn)
- [GitHub 倉庫](https://github.com/iflytek/skillhub)
- [問題反饋](https://github.com/iflytek/skillhub/issues)

## 許可證

Apache-2.0

Copyright 2026 iFlytek Co., Ltd.
