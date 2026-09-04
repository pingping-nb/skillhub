# Hermes Agent 整合指南

本檔案說明如何把 SkillHub 中的技能安裝到 [NousResearch Hermes Agent](https://github.com/NousResearch/hermes-agent)，並在 Hermes 中發現、載入、更新和移除這些技能。

本文中的 “Hermes” 特指 `NousResearch/hermes-agent`，不適用於其他同名專案。

## 已驗證範圍

| 元件 | 已驗證版本 | 說明 |
|------|------------|------|
| SkillHub Server | `v0.2.13` | 公開或自託管 registry |
| SkillHub CLI | `0.1.8` | npm 包 `@astron-team/skillhub` |
| Hermes Agent | `0.18.2` | 上游 tag [`v2026.7.7.2`](https://github.com/NousResearch/hermes-agent/tree/v2026.7.7.2) |

驗證日期：2026-07-17。

Hermes 0.18.2 使用相容 [Agent Skills](https://agentskills.io/) 的 `SKILL.md` 格式，並遞迴掃描 `$HERMES_HOME/skills/`。SkillHub CLI 可以透過 `--dir` 把完整技能包解壓到指定目錄。因此，當前相容鏈路不需要格式轉換、Hermes 專用 CLI profile 或服務端適配：

```text
SkillHub registry
  -> skillhub install --dir <Hermes 技能目錄>
  -> <Hermes 技能目錄>/<skill-slug>/SKILL.md
  -> Hermes 發現並按需載入
```

> Hermes 0.18.2 沒有原生 SkillHub registry source。本指南使用 SkillHub CLI 負責搜尋、下載和本地安裝，Hermes 負責發現和執行技能。

## 前置條件

1. 已安裝並初始化 Hermes Agent。
2. 已安裝 SkillHub CLI：

```bash
npm install -g @astron-team/skillhub

skillhub version
hermes version
```

3. 技能包根目錄包含有效的 `SKILL.md`，其中至少有 `name` 和 `description` frontmatter。

以下示例使用 Bash/zsh。Windows 使用者可使用同一目錄結構，將預設 Hermes 主目錄替換為 `$HOME\.hermes`，並按 PowerShell 語法設定變數。

## 快速開始

### 1. 配置 SkillHub registry

設定公開或自託管 SkillHub 地址：

```bash
export SKILLHUB_REGISTRY=https://skillhub.your-company.com
```

公開且允許匿名下載的技能可以跳過登入。訪問團隊名稱空間、受限技能或私有部署時，先儲存 API Token：

```bash
skillhub login \
  --registry "$SKILLHUB_REGISTRY" \
  --token YOUR_API_TOKEN

skillhub whoami --registry "$SKILLHUB_REGISTRY"
```

請使用佔位 Token 演示，不要把真實 Token 寫入 `SKILL.md`、指令碼或版本庫。

### 2. 搜尋技能

```bash
skillhub search "pdf" --registry "$SKILLHUB_REGISTRY"
```

記錄結果中的 namespace、slug 和所需版本。下面以 `my-team/my-skill` 為例：

```bash
export SKILLHUB_NAMESPACE=my-team
export SKILLHUB_SKILL=my-skill
```

### 3. 安裝到 Hermes 主技能目錄

設定當前 Hermes profile 的主目錄。預設 profile 通常是 `~/.hermes`；如果使用自定義 `HERMES_HOME` 或命名 profile，請指向實際 profile 目錄：

```bash
export HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
export HERMES_SKILLHUB_DIR="$HERMES_HOME/skills/skillhub/$SKILLHUB_NAMESPACE"
```

安裝技能：

```bash
skillhub install "$SKILLHUB_SKILL" \
  --namespace "$SKILLHUB_NAMESPACE" \
  --dir "$HERMES_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY"
```

SkillHub CLI 會保留技能包中的 `SKILL.md`、`references/`、`scripts/`、`templates/`、`assets/` 等檔案，並額外寫入 `.skillhub/metadata.json` 記錄安裝來源。目錄結構類似：

```text
$HERMES_HOME/skills/
└── skillhub/
    └── my-team/
        └── my-skill/
            ├── SKILL.md
            ├── references/          # 可選
            ├── scripts/             # 可選
            └── .skillhub/
                └── metadata.json
```

按 namespace 分目錄可以減少不同名稱空間中同 slug 技能的檔案路徑衝突。Hermes 會遞迴掃描這些層級。

### 4. 在 Hermes 中驗證和載入

先確認 Hermes 發現了技能：

```bash
hermes skills list --source local --enabled-only
```

然後啟動 Hermes，在會話中使用由技能 `name` 規範化得到的斜槓命令：

```bash
hermes
```

```text
/my-skill
```

也可以在自然語言請求中明確要求 Hermes 使用該技能。Hermes 列表顯示 `SKILL.md` frontmatter 中的原始 `name`，斜槓命令會把它轉為小寫、把空格和下劃線替換為連字元、移除其他非 `a-z0-9-` 字元，併合並重復連字元。例如 `PDF_Tools` 對應 `/pdf-tools`。該命令不一定與 SkillHub slug 相同。

已經執行的會話未立即顯示新技能時，執行 `/reload-skills` 或重新啟動會話。

## 更新技能

SkillHub CLI 0.1.8 使用同一安裝命令加 `--force` 覆蓋本地技能。省略 `--version` 會解析最新已發布版本；也可以顯式固定版本：

```bash
skillhub install "$SKILLHUB_SKILL" \
  --namespace "$SKILLHUB_NAMESPACE" \
  --dir "$HERMES_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY" \
  --force

# 固定版本示例
skillhub install "$SKILLHUB_SKILL" \
  --namespace "$SKILLHUB_NAMESPACE" \
  --version 1.2.0 \
  --dir "$HERMES_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY" \
  --force
```

覆蓋前請先審查新版本，因為 `--force` 會替換現有技能目錄。更新後重新執行：

```bash
skillhub list \
  --dir "$HERMES_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY"

hermes skills list --source local --enabled-only
```

> `skillhub update` 更新的是 SkillHub CLI 自身，不會更新已安裝技能。已安裝技能使用 `skillhub install ... --force` 重新整理。

## 移除技能

先列出同一 registry 中的全部安裝，確認沒有其他需要保留的同 slug 技能：

```bash
skillhub list \
  --registry "$SKILLHUB_REGISTRY"
```

再移除本地安裝：

```bash
skillhub remove "$SKILLHUB_SKILL" \
  --registry "$SKILLHUB_REGISTRY"
```

SkillHub CLI 會同時刪除技能目錄和本地 inventory 記錄。當前版本的本地 `remove` 僅按 registry 和 slug 匹配，不按 namespace 或目錄過濾；同一 registry 下所有 namespace、所有安裝目錄中的相同 slug 都會被移除。如果未過濾的 `skillhub list` 中存在需要保留的匹配項，請不要執行該命令；按 namespace 或目錄精確移除需要後續 CLI 能力支援。

移除後，使用 `/reload-skills`、重啟 Hermes 會話，或執行以下命令確認技能已消失：

```bash
hermes skills list --source local --enabled-only
```

## 可選：使用共享的 external skill 目錄

如果多個 Agent 共用 `~/.agents/skills`，可以把 SkillHub 技能安裝到共享目錄，而不是 Hermes 主目錄：

```bash
export SHARED_SKILLHUB_DIR="$HOME/.agents/skills/skillhub/$SKILLHUB_NAMESPACE"

skillhub install "$SKILLHUB_SKILL" \
  --namespace "$SKILLHUB_NAMESPACE" \
  --dir "$SHARED_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY"
```

然後把共享根目錄合併到 `$HERMES_HOME/config.yaml`，不要覆蓋已有的 `skills` 配置：

```yaml
skills:
  external_dirs:
    - ~/.agents/skills
```

Hermes 會把 external skill 與本地技能一起列出和載入。不要依賴本地技能覆蓋 external skill：Hermes 0.18.2 會拒絕載入本地技能目錄與 `external_dirs` 之間存在歧義的 `skill_view` 匹配；請改名或移除其中一個衝突副本。

> `external_dirs` 不是隻讀邊界。只要 Hermes 程式擁有寫許可權，Hermes 的技能管理工具就可能修改其中的檔案。共享目錄需要只讀保護時，請使用檔案系統許可權或隔離的 Hermes profile。

## 相容性與安全邊界

- **格式相容不等於執行時完全相容。** Hermes 能讀取 `SKILL.md` 和配套檔案，但技能引用的 Agent 專用工具、MCP server、命令、環境變數或平臺能力仍需逐項驗證。
- **Hermes 將此路徑識別為 local skill。** 透過 SkillHub CLI 複製到本地的技能不會經過 Hermes Skills Hub 的 community 安裝掃描。安裝前應檢視 SkillHub 安全報告並審查技能內容，必要時使用 Hermes 的終端隔離能力。
- **保留多檔案包。** 不要把多檔案 SkillHub 技能改成 Hermes 0.18.2 的直接 URL 安裝；該版本的 URL source 只保證單個 `SKILL.md`，而 SkillHub CLI 會解壓完整包。
- **避免名稱衝突。** 檔案路徑按 namespace 隔離仍不能解決斜槓命令衝突；同一 Hermes profile 內應保持規範化後的命令名唯一。例如 `PDF Tools` 和 `pdf_tools` 都會變成 `/pdf-tools`。
- **保護憑證。** Token 只用於 SkillHub registry 訪問，不應寫進技能包。需要執行時 secret 的技能應遵循 Hermes 的環境變數和安全設定方式。

## 常見問題

### Hermes 列表中沒有新技能

依次檢查：

1. 當前會話的 `HERMES_HOME` 是否與安裝時一致。
2. 最終路徑下是否存在 `<skill-directory>/SKILL.md`。
3. `SKILL.md` 是否包含有效的 `name` 和 `description`。
4. `platforms` 等 frontmatter 是否排除了當前作業系統。
5. 執行 `/reload-skills` 或啟動新會話後是否出現。

```bash
skillhub list --dir "$HERMES_SKILLHUB_DIR" --registry "$SKILLHUB_REGISTRY"
hermes skills list --source local
```

### 安裝提示 `skill already installed`

已有目錄預設不會被覆蓋。先審查目標版本，再增加 `--force`：

```bash
skillhub install "$SKILLHUB_SKILL" \
  --namespace "$SKILLHUB_NAMESPACE" \
  --dir "$HERMES_SKILLHUB_DIR" \
  --registry "$SKILLHUB_REGISTRY" \
  --force
```

### 提示 `registry unreachable` 或下載失敗

- 核對 `SKILLHUB_REGISTRY` 是否是 SkillHub 根地址。
- 先執行同一 registry 的 `skillhub search` 判斷 registry 是否可達。
- 檢查代理、DNS、證書和自託管服務狀態。
- 短暫網路錯誤可以在確認服務正常後重試；不要透過關閉 TLS 校驗繞過證書問題。

### 技能已列出但執行失敗

檢查技能引用的工具名稱、shell 命令、指令碼直譯器、依賴包、MCP server、環境變數和作業系統限制。此類問題屬於具體技能的執行時相容性，不代表 `SKILL.md` 發現鏈路失敗。

### 能否直接執行 `hermes skills install` 安裝 SkillHub 座標？

Hermes 0.18.2 沒有 SkillHub registry source，不能直接解析 SkillHub 的 namespace/slug。請使用本指南中的 `skillhub install --dir ...`。如果未來需要 Hermes 內原生搜尋、安裝、更新和安全掃描，應單獨設計 Hermes source adapter，並重新定義協議和驗收範圍。

## 升級後的迴歸檢查

升級 SkillHub CLI 或 Hermes 後，至少重新驗證：

1. `skillhub install --dir` 仍生成 `<slug>/SKILL.md` 並保留配套檔案。
2. `hermes skills list --source local --enabled-only` 能發現技能。
3. `/skill-name` 能載入 `SKILL.md` 並暴露配套檔案路徑；再透過 `skill_view(name, file_path)` 讀取一個實際引用檔案，或執行技能使用的指令碼/資產驗證其執行時路徑。
4. `skillhub install --force` 能覆蓋更新且 inventory 正常。
5. `skillhub remove` 後 Hermes 不再發現該技能。

上游參考：[Hermes Skills System（v0.18.2）](https://github.com/NousResearch/hermes-agent/blob/v2026.7.7.2/website/docs/user-guide/features/skills.md)。
