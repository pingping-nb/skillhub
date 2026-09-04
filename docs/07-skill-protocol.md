# skillhub 技能包協議

## 8.1 OpenSkills 互操作邊界

skillhub 的目標是客戶端可互操作：skillhub CLI 安裝的技能可以被 Claude Code / OpenSkills 相容客戶端發現和使用，反之亦然。

### 互操作層（skillhub CLI 必須相容）

- SKILL.md 格式（frontmatter + markdown body）
- 技能包目錄結構約定（SKILL.md + references/ + scripts/ + assets/）
- 四級目錄優先順序：`.agents/skills` → `~/.agents/skills` → `.claude/skills` → `~/.claude/skills`（與 OpenSkills/Claude 一致）。詳見 §8.4。
- 目錄名作為 lookup key：安裝後的目錄名等於 `skill.slug`（即 SKILL.md 的 `name` 欄位），客戶端透過目錄名發現技能
- AGENTS.md `<skill>` 描述塊格式：skillhub CLI 生成的 AGENTS.md 索引區塊與 OpenSkills 格式相容

### 服務端職責邊界

- 服務端返回技能後設資料（name, description, version），不返回 `location`
- `location` 是客戶端本地安裝路徑，由 CLI 根據安裝目錄計算生成，寫入 AGENTS.md
- 服務端不生成、不修改 AGENTS.md，這是客戶端職責

### skillhub 私有擴充套件（不影響互操作）

- `<skills_system>` / `<available_skills>` 區塊格式：skillhub CLI 可自定義，但必須保證 `<skill>` 節點格式與 OpenSkills 一致
- progressive disclosure（按需載入技能內容）：skillhub CLI 自行實現
- `.astron/metadata.json`：skillhub 私有後設資料，其他客戶端可忽略

## 8.2 SKILL.md 規範

服務端必須相容的格式：

```yaml
---
name: my-skill              # 必需，kebab-case
description: When to use    # 必需，1-2 句話
---

# Markdown 正文（技能指令內容）
```

解析規則：
- `name` 和 `description` 為必需欄位，缺失則校驗失敗
- `name` 對映為 `skill.slug`（首次發布時），後續版本不可變更
- `description` 對映為 `skill.summary`
- frontmatter 完整解析結果存入 `skill_version.parsed_metadata_json`

平臺擴充套件欄位（可選，`x-astron-` 字首）：

```yaml
---
name: my-skill
description: When to use
x-astron-category: code-review
x-astron-runtime: claude-code        # 預留
x-astron-min-version: "1.0"          # 預留
x-astron-compliance:                 # 可選，平臺私有合規後設資料
  - standard: mitre-attack
    version: "v19.1"
    controlId: T1059
    title: Command and Scripting Interpreter
    evidence:
      - type: packaged-file
        path: references/standards.md
---
```

> 合規後設資料先按 SkillHub/Astron 私有擴充套件實現，欄位名採用 `x-astron-compliance`。
> 當前支援發布校驗、版本級 `complianceSnapshot` 固化、詳情展示、稽核 diff 和輕量搜尋投影。
> 這些資訊表示“技能作者宣告的合規對映”，SkillHub 校驗證據引用的格式和可追溯性，
> 但不等同於第三方認證或平臺背書。設計邊界、分階段實現和 Runtime 職責劃分見
> [24-compliance-metadata-design.md](24-compliance-metadata-design.md)。

`x-astron-compliance` 的穩定欄位如下：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `standard` | 是 | 合規標準、框架或知識庫標識，例如 `mitre-attack`、`nist-csf`、`soc2` |
| `version` | 是 | 標準版本或適用版本，例如 `v19.1`、`2.0` |
| `controlId` | 是 | 控制項、技術編號或條款 ID，例如 `T1059`、`PR.AA-01` |
| `title` | 否 | 人類可讀的控制項名稱 |
| `evidence` | 否 | 證據列表，指向包內檔案或外部 URL |

`evidence` 支援兩類：

| `type` | 欄位 | 說明 |
|--------|------|------|
| `packaged-file` | `path` | 指向技能包內的證據檔案。路徑必須在包內，不能路徑逃逸。 |
| `external-url` | `url` | 指向外部證據材料。URL 必須使用允許的安全 scheme。 |

發布校驗規則：

- 沒有 `x-astron-compliance` 的舊技能繼續正常發布。
- `x-astron-compliance` 存在時必須是陣列。
- `standard`、`version`、`controlId` 必填。
- 同一技能版本內不允許重複 `standard + version + controlId`。
- `packaged-file.path` 必須存在於上傳包內，且不能使用 `../` 等方式逃逸包目錄。
- 合法合規宣告會被規範化為版本級 `complianceSnapshot`，並生成穩定 `digest`。

Runtime 整合邊界：

- SkillHub 是技能後設資料和版本級 `complianceSnapshot` 的權威源。
- Agent Runtime 是執行 trace 的權威源。
- Runtime 如需在執行鏈路中記錄合規上下文，應引用 SkillHub 返回的不可變版本 `id`
  和 `complianceSnapshot.digest`，而不是複製或改寫 SkillHub 的宣告內容。
- SkillHub 當前不記錄 Agent 執行輸入輸出、Runtime trace 或實際呼叫結果。

## 8.3 技能包目錄結構

```
my-skill/
├── SKILL.md              # 主入口檔案（必需）
├── references/           # 參考資料（可選）
├── scripts/              # 指令碼（可選）
└── assets/               # 靜態資源（可選）
```

校驗規則：
- 根目錄必須包含規範入口檔案 `SKILL.md`；上傳時服務端相容 `skill.md`、`Skill.md` 等大小寫變體，並在內部歸一化為 `SKILL.md`
- 檔案型別白名單：`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.js`, `.cjs`, `.mjs`, `.ts`, `.py`, `.sh`, `.png`, `.jpg`, `.svg`
- 單檔案大小限制：1MB（可配置）
- 總包大小限制：10MB（可配置）
- 檔案數量限制：100 個（可配置）

## 8.4 客戶端安裝目錄約定

skillhub CLI 遵循以下目錄優先順序，與 OpenSkills/Claude 保持互操作：

| 優先順序 | 路徑 | 說明 |
|--------|------|------|
| 1 | `./.agents/skills/` | 專案級，universal 模式 |
| 2 | `~/.agents/skills/` | 全域性級，universal 模式 |
| 3 | `./.claude/skills/` | 專案級，Claude 預設 |
| 4 | `~/.claude/skills/` | 全域性級，Claude 預設 |

安裝後目錄名等於 `skill.slug`（SKILL.md 的 `name` 欄位），確保其他相容客戶端可透過目錄名發現。

## 8.5 與 AGENTS.md 的關係

- skillhub CLI 安裝技能後，透過 `sync` 命令在 AGENTS.md 中生成 `<skill>` 描述塊
- `<skill>` 塊包含 `name`、`description`、`location`（本地安裝路徑），格式與 OpenSkills 一致
- `location` 由 CLI 根據實際安裝路徑計算，不由服務端提供
- 服務端不直接生成或修改 AGENTS.md，這是客戶端職責

## 8.6 客戶端本地後設資料檔案（skillhub 私有實現）

以下為 skillhub CLI 的私有實現細節，不屬於互操作協議的一部分。其他客戶端可忽略此檔案。

CLI 安裝後在本地寫入 `.astron/metadata.json`：

```json
{
  "source": "skillhub",
  "sourceType": "registry",
  "registryUrl": "https://skills.example.com",
  "namespace": "@ai-platform-team",
  "skillSlug": "code-review",
  "version": "1.2.0",
  "installedAt": "2026-03-11T10:00:00Z",
  "sha256": "abc123..."
}
```

## 8.7 版本解析規則

skillhub 自有 CLI 支援完整 namespace 座標：

```
install @team/my-skill              → 最新已發布版本（實現上通常由 `latest_version_id` / published pointer 解析）
install @team/my-skill@1.2.0        → 精確版本
install @team/my-skill@latest        → 等同於不帶版本號（系統保留標籤，只讀）
install @team/my-skill@beta          → beta 標籤（自定義標籤）
install my-skill                     → 等同於 @global/my-skill
```

ClawHub CLI 透過相容層使用 canonical slug：

```
clawhub install my-skill             → @global/my-skill 的最新版本
clawhub install team-name--my-skill  → @team-name/my-skill 的最新版本
clawhub install my-skill@1.2.0       → @global/my-skill 的精確版本
```

## 8.8 座標對映與 ClawHub CLI 相容

skillhub 內部使用 `@{namespace_slug}/{skill_slug}` 座標，ClawHub CLI 使用單一 slug。對映規則詳見 `00-product-direction.md` 1.1 節。

安裝後的本地目錄名始終使用 `skill.slug`（不含 namespace 字首），確保與 OpenSkills/Claude 相容客戶端的互操作性。

| skillhub 座標 | ClawHub canonical slug | 本地安裝目錄名 |
|---|---|---|
| `@global/my-skill` | `my-skill` | `my-skill/` |
| `@team-name/my-skill` | `team-name--my-skill` | `my-skill/` |

注意：不同 namespace 下同名 skill 安裝到本地時會產生目錄衝突。skillhub CLI 應在安裝時檢測衝突並提示使用者選擇安裝目錄或使用別名。
