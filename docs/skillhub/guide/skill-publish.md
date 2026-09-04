# Skill 發布與版本管理

## 功能描述

Skill 發布是 SkillHub 的核心功能。開發者可以將本地開發的 Agent 技能包一鍵上傳到註冊中心，系統會自動處理版本管理、後設資料提取、檔案索引等工作。

![概念圖](/diagrams/skill-publish-concept.png)

**解決的問題**：

傳統方式下，團隊成員透過 Git 倉庫或檔案共享來分發技能包。這種方式存在幾個痛點：

- **版本混亂**：不同版本散落在各處，難以追蹤
- **許可權失控**：無法精細控制誰能訪問哪些技能包
- **發現困難**：新成員不知道團隊已有哪些可用技能

SkillHub 提供了類似 npm 的發布體驗，但增加了企業級的許可權控制和稽核機制。

**核心特性**：

- **語義化版本**：支援 `major.minor.patch` 版本號規範
- **標籤系統**：`latest`、`beta`、`stable` 等自定義標籤
- **多版本共存**：同一技能包可以保留多個歷史版本
- **版本解析**：智慧解析版本選擇器（如 `^1.2.0`、`~2.0.0`）
- **檔案瀏覽**：線上瀏覽技能包內的檔案結構
- **下載分發**：支援按版本、按標籤下載

## 使用場景

**場景一：開發者發布新技能**

你剛完成了一個 Claude Code 技能包，想讓團隊其他成員也能使用。

![操作截圖](/screenshots/homepage.png)

**場景二：版本迭代**

技能包需要修復 bug 或新增新功能，發布新版本並保持向後相容。

**場景三：Beta 測試**

新功能還不穩定，先發布 `beta` 標籤讓少數人測試，穩定後再推廣到 `latest`。

**場景四：版本回滾**

發現新版本有嚴重問題，需要將 `latest` 標籤指向上一個穩定版本。

## 使用步驟

1. **準備技能包**

確保技能包符合 SkillHub 規範：
- 包含 `skill.md`（技能描述）
- 包含 `package.json` 或 `SKILL.md`（後設資料）
- 檔案結構清晰，無敏感資訊

2. **使用 CLI 發布（推薦）**

```bash
# 配置 SkillHub 註冊中心
export SKILLHUB_REGISTRY=http://localhost:8080
export SKILLHUB_TOKEN=YOUR_API_TOKEN

# 發布到預設名稱空間
npx @astron-team/skillhub@latest publish ./my-skill

# 發布到指定名稱空間
npx @astron-team/skillhub@latest publish ./my-skill --namespace my-team
```

> ClawHub CLI 的發布與同步協議與 SkillHub 不相容。發布請使用上面的 SkillHub CLI。

3. **使用 Web UI 發布**

訪問 `http://localhost:3000/dashboard/publish`，選擇名稱空間、上傳 zip 檔案、選擇可見性後點選「發布」。

4. **使用 REST API 發布**

```bash
POST /api/v1/skills/{namespace}/publish
Content-Type: multipart/form-data

file: skill-package.zip
visibility: PUBLIC
```

![流程圖](/diagrams/skill-publish-flow.png)

5. **安全掃描**

發布後，[Skill Scanner](/guide/scanner) 會自動掃描技能包，檢測潛在的安全風險。掃描結果會顯示在技能包詳情頁。

6. **等待稽核**（如果名稱空間開啟了稽核）

團隊管理員會收到稽核通知，稽核透過後技能包正式發布。

7. **發布成功**

技能包可以透過搜尋發現，其他人可以透過 CLI 或 Web UI 下載使用。

## 合規宣告

技能作者可以在 `SKILL.md` frontmatter 中新增 `x-astron-compliance`，宣告該技能版本與某些合規標準、控制項或安全知識庫條目的對映關係。

```yaml
---
name: incident-response-helper
description: Helps analysts draft incident response steps.
x-astron-compliance:
  - standard: mitre-attack
    version: "v19.1"
    controlId: T1059
    title: Command and Scripting Interpreter
    evidence:
      - type: packaged-file
        path: references/mitre-t1059.md
      - type: external-url
        url: https://attack.mitre.org/techniques/T1059/
---
```

需要注意：

- 這是“作者宣告”，不是 SkillHub 或第三方機構的合規認證。
- SkillHub 會校驗欄位結構、重複項、包內證據路徑和外部 URL 格式。
- 發布成功後，宣告會被固化為當前版本的 `complianceSnapshot`，並生成穩定摘要 `digest`。
- 後續版本如果新增、刪除或修改合規宣告，稽核頁會展示差異。
- 搜尋 `mitre-attack`、`T1059` 或宣告標題時，可以命中對應技能。

欄位說明：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `standard` | 是 | 標準或框架標識，例如 `mitre-attack`、`nist-csf`、`soc2` |
| `version` | 是 | 標準版本 |
| `controlId` | 是 | 控制項、技術編號或條款 ID |
| `title` | 否 | 控制項名稱，建議填寫，便於稽核和搜尋 |
| `evidence` | 否 | 證據列表，支援包內檔案和外部 URL |

## API 介面

**發布技能包**：
```bash
POST /api/v1/skills/{namespace}/publish
Content-Type: multipart/form-data

# 引數
file: MultipartFile (必需)
visibility: PUBLIC | PRIVATE | INTERNAL (可選，預設 PUBLIC)
```

**引數說明**：
| 引數 | 型別 | 說明 |
|------|------|------|
| namespace | string | 名稱空間 slug（路徑引數） |
| file | MultipartFile | 技能包 zip 檔案 |
| visibility | enum | 可見性級別：PUBLIC（公開）、PRIVATE（私有）、INTERNAL（內部） |

**獲取 Skill 詳情**：
```bash
GET /api/v1/skills/{namespace}/{slug}
```

**列出版本**：
```bash
GET /api/v1/skills/{namespace}/{slug}/versions?page=0&size=20
```

**獲取版本詳情**：
```bash
GET /api/v1/skills/{namespace}/{slug}/versions/{version}
```

**下載特定版本**：
```bash
GET /api/v1/skills/{namespace}/{slug}/versions/{version}/download
```

**按標籤下載**：
```bash
GET /api/v1/skills/{namespace}/{slug}/tags/{tagName}/download
```

**版本解析**：
```bash
GET /api/v1/skills/{namespace}/{slug}/resolve?version=^1.2.0
```

## 注意事項

> **版本號規範**：SkillHub 使用語義化版本（Semantic Versioning）。版本號格式為 `major.minor.patch`，例如 `1.2.3`。

- **首次發布**：版本號建議從 `0.1.0` 或 `1.0.0` 開始
- **標籤管理**：`latest` 標籤會自動指向最新的穩定版本
- **稽核流程**：如果名稱空間開啟了稽核，新版本需要等待管理員批准
- **檔案大小限制**：單個技能包不超過 100MB（可配置）
- **命名規範**：Skill slug 支援小寫字母、數字、連字元和 Unicode 字元
- **版本不可變**：已發布的版本不能修改，只能發布新版本
