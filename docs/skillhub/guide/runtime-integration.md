# Runtime 整合契約

## 職責邊界

SkillHub 和 Agent Runtime 的職責分開：

| 系統 | 權威負責內容 |
|------|--------------|
| SkillHub | 技能包、版本、後設資料、合規宣告快照、下載與稽核記錄 |
| Agent Runtime | 技能實際執行、輸入輸出、模型呼叫、工具呼叫、執行 trace |

SkillHub 不執行技能，因此不記錄 Runtime trace，也不判斷一次真實執行是否合規。SkillHub 提供的是版本級事實：某個不可變技能版本在發布時包含了什麼合規宣告，以及該宣告快照的穩定摘要。

## Runtime 應記錄什麼

Runtime 在執行技能時，如果需要把執行鏈路與 SkillHub 的合規宣告關聯起來，建議記錄以下欄位：

| 欄位 | 來源 | 說明 |
|------|------|------|
| `registryUrl` | Runtime 配置 | 使用的 SkillHub 註冊中心地址 |
| `namespace` | SkillHub 座標 | 技能名稱空間，例如 `global` 或團隊 slug |
| `skillSlug` | SkillHub 座標 | 技能 slug |
| `requestedVersion` | Runtime 請求 | 使用者請求的版本、標籤或版本範圍 |
| `resolvedVersion` | SkillHub 響應 | 實際解析到的版本號 |
| `skillVersionId` | SkillHub 響應裡的版本 `id` | 不可變版本 ID，審計關聯的主鍵 |
| `complianceSnapshotDigest` | `complianceSnapshot.digest` | 該版本合規宣告快照的穩定摘要 |
| `packageDigest` | 下載或安裝流程 | 技能包內容摘要，便於確認執行內容 |
| `runtimeTraceId` | Runtime | Runtime 自己生成的執行鏈路 ID |

如果 Runtime 使用 Astron 自有 trace schema，可以把這些欄位對映成 `x-astron-*` 鍵；這屬於 Runtime 的 trace 約定，不是 SkillHub 服務端必須寫入或解析的欄位。

## 獲取版本級合規快照

第一階段不提供獨立的 compliance API。Runtime 可以透過既有版本詳情介面讀取版本 ID 和快照：

```bash
GET /api/v1/skills/{namespace}/{slug}/versions/{version}
```

響應中的關鍵欄位：

```json
{
  "id": 123,
  "version": "1.2.0",
  "complianceSnapshot": {
    "schemaVersion": "1.0",
    "digest": "sha256:8d8c...",
    "items": [
      {
        "standard": "mitre-attack",
        "version": "v19.1",
        "controlId": "T1059",
        "title": "Command and Scripting Interpreter",
        "evidence": [
          {
            "type": "packaged-file",
            "path": "references/mitre-t1059.md",
            "sha256": "sha256:..."
          }
        ]
      }
    ]
  }
}
```

Runtime 應把 `id` 和 `complianceSnapshot.digest` 一起寫入執行 trace。只記錄 digest 不夠，因為不同註冊中心或未來遷移場景下需要版本 ID 來定位完整快照。

## 推薦執行鏈路

1. Runtime 根據使用者請求解析技能座標和版本。
2. Runtime 從 SkillHub 獲取精確版本詳情。
3. Runtime 下載並校驗技能包。
4. Runtime 執行技能。
5. Runtime 在自己的 trace 中記錄：
   - SkillHub 註冊中心；
   - 技能座標；
   - 實際版本號；
   - `skillVersionId`；
   - `complianceSnapshotDigest`；
   - Runtime 自己的執行證據。

這樣審計系統可以先透過 Runtime trace 找到實際執行，再回到 SkillHub 查詢該版本發布時的合規宣告快照。

## 不建議的做法

- 不要把 `x-astron-compliance` 原文複製到 trace 後再由 Runtime 修改。
- 不要只記錄技能 slug，不記錄版本 ID；slug 指向的是技能容器，不是不可變版本。
- 不要把 SkillHub 的合規宣告當成第三方認證結果。
- 不要要求 SkillHub 記錄模型輸入輸出；這是 Runtime 的審計邊界。

## 未來可能新增的 API

如果出現明確使用方，例如 Runtime 只需要合規快照而不需要完整技能詳情，可以新增不可變版本維度的介面：

```text
GET /api/skill-versions/{skillVersionId}/compliance
```

當前階段先複用版本詳情響應，避免為尚未穩定的呼叫方提前設計多套 API。
