# Compliance Metadata 設計方案

狀態：第一階段已落地發布校驗和版本級 snapshot 固化；詳情展示、稽核 diff、搜尋 facet 和 Runtime trace 整合仍按本文後續階段推進。

## 1. 背景

Issue #556 提出的方向是讓 SkillHub 支援“可標準對映、可審計引用”的技能後設資料。它參考了兩個不同型別的開源倉庫：

- `mukul975/Anthropic-Cybersecurity-Skills`：大量 `SKILL.md` 在 frontmatter 中宣告 MITRE ATT&CK、NIST CSF 等標準對映，並透過 `references/standards.md` 等檔案補充證據。
- `calesthio/OpenMontage`：透過 pipeline manifest、artifact schema、checkpoint 和 review gate 證明垂直工作流的可恢復、可稽核和可追蹤。

這兩個倉庫給 SkillHub 的啟發不同：

- 標準對映應該進入 skill 協議和版本事實，而不是隻作為 UI 標籤。
- 執行時 trace 應由執行方記錄，SkillHub 不應承擔 Agent Runtime 的執行事實。

需要注意：`compliance` 不是當前已經被廣泛應用的 `SKILL.md` 標準欄位。SkillHub 現有協議檔案已經約定 `x-astron-*` 作為平臺私有擴充套件名稱空間。因此第一階段應使用 `x-astron-compliance`，先解決 SkillHub 自己的治理和審計需求；未來如果 OpenSkills / Agent Skills 生態形成公開欄位，再透過相容讀取 `compliance` 或遷移工具對齊。

因此本方案採用職責分離：

> SkillHub 負責“這個技能版本宣告瞭什麼合規能力”；Agent Runtime 負責“這次執行實際用了哪個技能版本”。兩者透過 `skillVersionId + complianceSnapshotDigest` 關聯。

這裡的 compliance 是作者隨技能包提交的宣告型後設資料。SkillHub 第一階段只驗證欄位結構、取值格式、
包內證據檔案是否存在、外部證據 URL 是否是合法 HTTP(S) URL，並生成不可變快照摘要；它不驗證外部標準內容是否真實適用，
也不代表第三方審計、認證透過或平臺背書。

## 2. 職責邊界

### 2.1 SkillHub 職責

SkillHub 是技能註冊中心和後設資料權威源，負責：

- 解析 `SKILL.md` frontmatter 中的 `x-astron-compliance` 欄位。
- 發布時校驗 compliance 後設資料和證據引用。
- 將規範化結果固化為技能版本級 snapshot。
- 在已有技能詳情、版本詳情、稽核和搜尋能力中投影 compliance 資訊。
- 記錄 SkillHub 內部發生的發布、稽核、compliance 變更審計。
- 為未來 Agent Runtime 引用提供穩定的 `skillVersionId` 和 `complianceSnapshotDigest`。

### 2.2 Agent Runtime 職責

Agent Runtime，例如 Astron、Claude Code、Codex、OpenClaw 或其他執行方，負責：

- 實際載入和執行技能。
- 生成 execution trace。
- 記錄本次執行使用的 skill coordinate、skill version、`skillVersionId` 和 `complianceSnapshotDigest`。
- 記錄執行時輸入輸出摘要、審批 gate、執行結果、錯誤和執行時策略。

SkillHub 不記錄 Agent 每次執行，也不實現 Agent execution trace。

## 3. 非目標

第一階段不做以下內容：

- 不新增獨立 compliance 查詢 API。
- 不實現 Astron execution trace。
- 不新增複雜 facet / 聚合搜尋。
- 不引入外部審計系統整合。
- 不把 `compliance` 當作已經存在的上游通用標準欄位。
- 不為了 compliance 過早新建複雜表結構，除非後續效能或查詢需求明確。

## 4. 協議草案

建議在 `SKILL.md` frontmatter 中先支援 SkillHub/Astron 私有擴充套件欄位 `x-astron-compliance`：

```yaml
---
name: incident-response-helper
description: Guide analysts through incident response triage and evidence collection.
version: "1.2.0"
x-astron-compliance:
  - standard: mitre-attack
    version: "v19.1"
    controlId: T1059
    title: Command and Scripting Interpreter
    evidence:
      - type: packaged-file
        path: references/standards.md
      - type: external-url
        url: https://attack.mitre.org/techniques/T1059/
---
```

欄位含義：

| 欄位 | 含義 |
|---|---|
| `standard` | 標準名稱，例如 `mitre-attack`、`nist-csf`、`soc2`、`hipaa` |
| `version` | 標準版本，例如 `v19.1`、`2.0` |
| `controlId` | 標準控制項、技術編號或條款 ID |
| `title` | 人類可讀名稱 |
| `evidence` | 證據列表 |
| `evidence.type` | `packaged-file` 或 `external-url` |
| `evidence.path` | 技能包內證據檔案路徑，僅 `packaged-file` 使用 |
| `evidence.url` | 外部證據連結，僅 `external-url` 使用 |

未來相容策略：

- 寫入規範：第一階段只推薦作者寫 `x-astron-compliance`。
- 讀取相容：如果後續生態出現公開 `compliance` 欄位，解析器可以同時讀取 `compliance` 和 `x-astron-compliance`，但需要定義衝突優先順序。
- 對外展示：UI 和審計報告仍統一展示為“Compliance Metadata”，不暴露內部欄位名字首給普通使用者。

## 5. 版本級 Snapshot

發布時，SkillHub 將 compliance 規範化為版本級 snapshot，並寫入版本後設資料。

第一階段優先複用：

```text
skill_version.parsed_metadata_json
```

建議結構：

```json
{
  "frontmatter": {
    "name": "incident-response-helper",
    "description": "Guide analysts through incident response triage and evidence collection.",
    "version": "1.2.0",
    "x-astron-compliance": []
  },
  "complianceSnapshot": {
    "schemaVersion": "1.0",
    "items": [
      {
        "standard": "mitre-attack",
        "version": "v19.1",
        "controlId": "T1059",
        "title": "Command and Scripting Interpreter",
        "evidence": [
          {
            "type": "packaged-file",
            "path": "references/standards.md",
            "sha256": "..."
          },
          {
            "type": "external-url",
            "url": "https://attack.mitre.org/techniques/T1059/"
          }
        ]
      }
    ],
    "digest": "sha256:..."
  }
}
```

`digest` 用於未來執行時 trace 或外部審計引用。第一階段只生成並寫入
`parsed_metadata_json`，不新增獨立 endpoint；後續再透過既有詳情或版本詳情投影給前端。

## 6. 分步執行計劃

### Phase 1：協議和領域模型

目標：先把 `x-astron-compliance` 欄位定義清楚，並放在領域層。

建議新增位置：

```text
server/skillhub-domain/src/main/java/com/iflytek/skillhub/domain/skill/metadata/
```

候選物件：

```text
ComplianceMapping
ComplianceEvidence
ComplianceEvidenceType
ComplianceMetadataService
ComplianceSnapshot
```

設計要求：

- `SkillMetadataParser` 繼續只負責解析 frontmatter，不承擔 compliance 業務校驗。
- `ComplianceMetadataService` 負責提取、規範化、校驗 compliance。
- 不在 controller 中做 compliance 校驗。
- 使用已有 `x-astron-*` 私有擴充套件名稱空間，不新增未驗證的公開欄位。

### Phase 2：發布時解析和校驗

目標：技能發布時能識別並校驗 compliance。

接入點：

```text
SkillPackageValidator
SkillPublishService
SkillVersion.parsedMetadataJson
```

基礎校驗規則：

- `x-astron-compliance` 缺失時相容舊技能。
- `x-astron-compliance` 存在時必須是陣列。
- 每個 mapping 必須是物件。
- `standard`、`version`、`controlId` 必填。
- `title` 可選，但應有長度限制。
- `evidence` 可選；提供時必須是陣列。
- 同一版本內不允許重複 `standard + version + controlId`。
- mapping 數量、evidence 數量和字串長度要有上限。

證據校驗規則：

- `packaged-file.path` 必須存在於技能包。
- `packaged-file.path` 不允許 `../` 路徑逃逸。
- `external-url.url` 只允許 `http` / `https`。
- 包內證據檔案應計算 `sha256` 並寫入 snapshot。

錯誤資訊要求：

- 使用現有 i18n 機制。
- 不在領域服務中散落不可翻譯的長英文錯誤字串。

### Phase 3：固化版本級 Snapshot

目標：每個技能版本都有不可變 compliance snapshot。

實現要求：

- 發布成功後生成規範化 `complianceSnapshot`。
- snapshot 內容和 digest 與該 `SkillVersion` 繫結。
- 後續詳情、稽核、搜尋均讀取 snapshot，不重新解釋最新原始碼。
- snapshot 為空時也要有確定行為，避免舊技能受影響。

第一階段不強制新建表。後續出現結構化過濾、統計或效能瓶頸時，再考慮：

- `jsonb` GIN index；
- `skill_version_compliance_mapping` 表；
- 搜尋 projection 表擴充套件。

### Phase 4：已有介面投影，不新增獨立 API

目標：讓前端和稽核能看到 compliance，但不發布猜測性 public API。

建議：

- 在已有技能詳情或版本詳情 response 中增加 compliance projection。
- 稽核詳情中帶出當前版本 compliance snapshot。
- 不新增以下 endpoint：

```text
GET /api/skills/{namespace}/{slug}/versions/{version}/compliance
GET /api/skills/{namespace}/{slug}/versions/{version}/metadata
```

後續只有出現明確使用方時再新增獨立 API，例如：

- Agent Runtime 只需要拉 compliance snapshot，不需要完整技能詳情。
- 企業審計系統按 `skillVersionId` 拉取合規宣告。
- 前端需要單獨比較兩個版本的 compliance diff。
- 完整 detail payload 效能不可接受。

如果後續需要獨立 API，優先考慮按不可變版本 ID 設計：

```text
GET /api/skill-versions/{skillVersionId}/compliance
```

### Phase 5：輕量搜尋

目標：先提升可發現性，不直接做複雜 facet。

後續階段：

- 在搜尋檔案重建時，將 snapshot 中的 `standard`、`controlId`、`title` 加入搜尋文字。
- 使用者搜尋 `T1059`、`mitre-attack`、`nist-csf` 時能命中對應技能。

更後續再考慮：

- 按 standard filter。
- 按 controlId filter。
- compliance coverage 聚合。
- 獨立索引或結構化 projection。

### Phase 6：稽核和審計

目標：只記錄 SkillHub 自己發生的事實。

稽核展示：

- 當前版本 compliance snapshot。
- 與上一發布版本的 diff：
  - 新增 mapping；
  - 刪除 mapping；
  - 修改 mapping；
  - evidence 變化；
  - digest 變化。

審計記錄：

- 發布時記錄 compliance digest。
- 稽核透過 / 拒絕時記錄 compliance diff 摘要。
- evidence 變化作為風險資訊進入 audit detail。

不記錄：

- Agent 執行輸入輸出。
- Astron trace。
- runtime 呼叫結果。

### Phase 7：檔案

目標：讓技能作者、平臺維護者和 Agent Runtime 接入方都理解邊界。

需要更新的檔案：

- `docs/07-skill-protocol.md`：實現穩定後補充正式 `x-astron-compliance` 協議。
- 使用者檔案：說明如何在 `SKILL.md` 中宣告 `x-astron-compliance`。
- 管理員檔案：說明發布校驗、稽核 diff、審計記錄。
- 整合檔案：說明 Runtime 如何引用 `skillVersionId + complianceSnapshotDigest`。

檔案必須明確：

> SkillHub 只提供版本級 compliance snapshot。執行時 trace 由 Agent Runtime 記錄，並可引用 SkillHub 的 `skillVersionId` 和 `complianceSnapshotDigest`。

### Phase 8：測試

單元測試：

- 無 `x-astron-compliance` 的舊技能正常發布。
- 合法 `x-astron-compliance` 正常解析。
- `standard` 缺失失敗。
- `version` 缺失失敗。
- `controlId` 缺失失敗。
- 重複 `standard + version + controlId` 失敗。
- `packaged-file.path` 不存在失敗。
- `packaged-file.path` 路徑逃逸失敗。
- `external-url.url` scheme 非法失敗。
- digest 穩定生成。

發布鏈路測試：

- 上傳含 `x-astron-compliance` 的技能包成功。
- 上傳非法 `x-astron-compliance` 的技能包失敗。
- 發布後 `parsedMetadataJson` 包含 `complianceSnapshot`。
- snapshot digest 與內容一致。

搜尋測試：

- 搜標準名能命中。
- 搜 controlId 能命中。
- 無 compliance 的舊技能不受影響。

稽核測試：

- 新版本新增 compliance。
- 新版本刪除 compliance。
- 新版本修改 evidence。
- 稽核詳情能看到 diff。

## 7. 推薦 PR 拆分

### PR 1：協議、解析、校驗、快照

範圍：

- domain metadata service；
- package validator；
- publish snapshot；
- `parsedMetadataJson` 結構；
- 單元測試和發布鏈路測試。

不包含：

- UI；
- 搜尋 facet；
- 獨立 API；
- Agent trace。

### PR 2：詳情頁和稽核展示

範圍：

- 既有 response 增加 compliance projection；
- 技能詳情展示；
- 稽核 diff 展示；
- 前端測試。

### PR 3：輕量搜尋

範圍：

- 搜尋檔案增加 compliance keywords；
- 搜尋測試。

不做複雜 facet。

### PR 4：檔案和 Runtime 整合契約

範圍：

- 使用者檔案；
- 管理員檔案；
- Runtime 引用方式；
- `skillVersionId + complianceSnapshotDigest` 契約說明。

不實現 Astron trace。

## 8. 最終架構原則

1. SkillHub 不執行技能，因此不記錄執行 trace。
2. SkillHub 是 skill metadata 和 version snapshot 的權威源。
3. Agent Runtime 是 execution trace 的權威源。
4. 合規審計透過 `skillVersionId + complianceSnapshotDigest` 把兩邊事實關聯起來。
5. 第一階段不發布猜測性 API；先透過已有詳情和版本投影滿足內部使用。
6. 先做穩定協議和可驗證快照，再做 UI、搜尋和外部整合。
