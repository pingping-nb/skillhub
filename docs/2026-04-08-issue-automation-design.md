# Issue 自動分診 MVP 設計

## 目標

透過自動將 GitHub issue 分診到三個佇列中，降低維護者負擔：

- `triage/deferred`：低優先順序 issue，會隨著時間推移逐步上浮
- `triage/core`：高優先順序或高風險 issue，需要 core maintainer 接手
- `triage/agent-ready`：高優先順序、低風險 issue，適合作為後續 agent 執行候選

本 MVP 版本還不會自動修復 issue。它聚焦在評分、路由、打標籤，以及讓
backlog 持續流動。

當前版本支援兩種執行模式：

- 僅規則分診
- 規則 + 相容 OpenAI 的 LLM 輔助

## 為什麼這樣拆分

最初的方案把優先順序和執行難度混在同一個決策裡。實踐上，如果把它們拆開，
系統會更容易調參：

- `Priority`：這個 issue 現在是否值得投入時間？
- `Route`：一旦值得處理，應該由誰來接手？

這樣一來，高價值但高難度的 issue 仍然可以保持高優先順序，同時繼續路由到
`triage/core`。

## 輸入

自動化會讀取 issue 的實時標題、正文、標籤、評論和時間戳。

結構化的 issue 表單欄位來自：

- [bug_report.yml](../.github/ISSUE_TEMPLATE/bug_report.yml)
- [feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml)
- [reward-task.yml](../.github/ISSUE_TEMPLATE/reward-task.yml)

## 評分模型

每個 issue 會沿四個維度評分：

- `impact`（1-5）：對使用者和工作流的影響
- `urgency`（1-5）：發布時間壓力、功能損壞情況或重複討論程度
- `effort`（1-5）：預估改動規模和協作成本
- `confidence`（1-5）：issue 描述的完整性和可執行程度

優先順序計算公式如下：

```text
priority = impact * 0.45 + urgency * 0.35 + age_boost + engagement_boost
```

其中：

- `age_boost`：基於 SLA 的升級機制
  - 第 7-9 天：預熱階段，最低提升到 `priority/p2`
  - 第 10-13 天：強制移出 `triage/deferred`，最低提升到 `priority/p1`
  - 第 14 天及以後：在下一次 triage/rescore 時，將該 issue 視為已違反 SLA，
    並至少提升到 `priority/p0`
- `engagement_boost`：由評論壓力和獎勵金額共同決定，上限為 +1.0

在 MVP 中，`effort` 不會直接降低優先順序，它隻影響路由。

## LLM 輔助分診

配置後，工作流可以呼叫相容 OpenAI 的 chat completions API。

LLM 不會替代規則引擎。它只用於輔助：

- 生成 issue 摘要
- 對軟性分數做微調
- 生成 `needs-info` 的追問問題
- 為維護者提供更好的判斷依據
- 為 `triage/core` 生成 maintainer 交接摘要

硬性門檻仍然由規則控制：

- 缺失必填資訊
- auth、schema、migration、SDK 或公共契約變更等高風險區域
- 最終是否可以提升到 `triage/agent-ready`

issue 正文和評論都視為不可信輸入。工作流會：

- 在傳送給模型前截斷過長的正文和評論
- 明確告訴模型，issue 文字是資料而不是指令
- 使用嚴格的 JSON 協議校驗模型輸出
- 如果 provider 呼叫失敗或 JSON 校驗失敗，則回退到僅規則模式

### 模式

- `off`：僅規則
- `shadow`：呼叫 LLM 並展示其建議，但最終仍沿用僅規則的路由和標籤
- `assist`：允許 LLM 對軟性分數做最多 `+/-1` 的微調，然後重新應用硬性門檻

### 何時使用 LLM

工作流只會在 issue 看起來存在歧義或價值較高時呼叫 LLM，例如：

- `triage/needs-info`
- `triage/core`
- 靠近路由閾值的 issue
- 低置信度案例
- 正文很長或討論很多的 issue
- 需要更多判斷的 feature 或 reward issue

## 路由規則

1. `triage/needs-info`
   當缺少必填欄位或 `confidence <= 2` 時觸發。

2. `triage/deferred`
   當 `priority < 3.6`、issue 不受資訊缺失阻塞、且 issue 年齡仍低於 SLA
   升級底線時觸發。

3. `triage/core`
   當 `priority >= 3.6` 且滿足以下任一條件時觸發：
   - issue 阻塞了 OpenClaw/ClawHub 核心工作流，例如 install、publish、
     update、sync 或基於 namespace 的發布
   - `effort >= 4`
   - `confidence <= 3`
   - 存在高風險關鍵詞或會影響契約的欄位

4. `triage/agent-ready`
   當 `priority >= 3.6`、`effort <= 3`、`confidence >= 4`，且不存在高風險
   訊號時觸發。

在 `assist` 模式下，LLM 建議可以對 `impact`、`urgency`、`effort` 和
`confidence` 各自最多調整 1 分。規則引擎隨後會重新計算優先順序和路由。

涉及 OpenClaw/ClawHub 核心工作流的 issue 是進入 `triage/core` 的硬性門檻；
LLM 輔助不會放寬這一規則。

## 受管標籤

自動化負責管理以下標籤字首：

- `triage/`
- `priority/`
- `effort/`
- `risk/`

當前使用的具體標籤有：

- `triage/needs-info`
- `triage/deferred`
- `triage/core`
- `triage/agent-ready`
- `priority/p0`
- `priority/p1`
- `priority/p2`
- `priority/p3`
- `effort/s`
- `effort/m`
- `effort/l`
- `risk/high`

其餘所有標籤都保持不變。

另外，自動化還識別一個不由其管理的人工操作標籤：

- `triage-manual`：凍結該 issue 的自動分診更新

## 工作流

### 1. Issue 分診

檔案：[issue-triage.yml](../.github/workflows/issue-triage.yml)

觸發條件：

- `issues.opened`
- `issues.edited`
- `issues.reopened`
- 當評論包含 `/retriage` 時觸發 `issue_comment.created`
- `workflow_dispatch`

執行動作：

- 拉取 issue 和評論
- 計算分數和路由
- 更新或建立受管標籤
- 更新或建立一條分診評論，其中同時包含人類可讀的判斷理由和隱藏的機器狀態
- 可選呼叫相容 OpenAI 的 provider，併合並結果

### 2. Deferred Backlog 重新評分

檔案：
[issue-backlog-rescore.yml](../.github/workflows/issue-backlog-rescore.yml)

觸發條件：

- 每 6 小時一次
- `workflow_dispatch`

執行動作：

- 列出所有帶有 `triage/deferred` 標籤的 open issue
- 結合年齡和參與度加成重新計算優先順序
- 決定將每個 issue 升級還是保留
- 原地更新分診評論
- 當 issue 內容未變化時複用快取的 LLM 結果

試執行說明：

- 當前定時 rescore 只掃描 `triage/deferred` 佇列中的 issue
- 這可以保證低優先順序 backlog 不會在 `deferred` 中閒置超過第 10 天
- 一旦某個 issue 已經從 `deferred` 中升級出去，之後第 14 天的進一步升級
  依賴新的 triage 事件或手動 `/retriage`
- 在試執行階段，14 天規則應被視為運營層面的 SLA 目標，而不是倉庫範圍內的
  硬性計時器

## 指令碼

新的 GitHub 自動化指令碼位於
[`.github/scripts`](/Users/wowo/workspace/skillhub/.github/scripts)：

- [github.ts](/Users/wowo/workspace/skillhub/.github/scripts/github.ts)：精簡版
  GitHub REST 客戶端
- [issue-triage-config.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-triage-config.ts)：
  標籤、閾值和關鍵詞規則
- [issue-llm-config.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-llm-config.ts)：
  LLM 模式、環境變數和呼叫啟發式
- [issue-llm-provider.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-llm-provider.ts)：
  相容 OpenAI 的 chat completions 客戶端
- [issue-llm-evaluator.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-llm-evaluator.ts)：
  prompt 構造、JSON 校驗和快取 key 生成
- [issue-triage-lib.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-triage-lib.ts)：
  解析、評分、路由和評論渲染
- [issue-triage-merge.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-triage-merge.ts)：
  有界合併和硬性門檻重應用
- [issue-triage.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-triage.ts)：
  單 issue 入口
- [issue-backlog-rescore.ts](/Users/wowo/workspace/skillhub/.github/scripts/issue-backlog-rescore.ts)：
  deferred 佇列重新評分入口

## 配置

設定以下 GitHub 倉庫變數和 secret，即可啟用 LLM 輔助分診：

倉庫變數：

- `ISSUE_TRIAGE_LLM_MODE`
- `ISSUE_TRIAGE_LLM_BASE_URL`
- `ISSUE_TRIAGE_LLM_MODEL`
- `ISSUE_TRIAGE_LLM_TIMEOUT_MS` 可選
- `ISSUE_TRIAGE_LLM_TEMPERATURE` 可選
- `ISSUE_TRIAGE_LLM_MAX_COMMENTS` 可選
- `ISSUE_TRIAGE_LLM_MAX_COMMENT_CHARS` 可選
- `ISSUE_TRIAGE_LLM_MAX_BODY_CHARS` 可選

倉庫 secret：

- `ISSUE_TRIAGE_LLM_API_KEY`

建議的第一輪上線方式：

- `ISSUE_TRIAGE_LLM_MODE=shadow`
- 先觀察幾天分診評論
- 等 LLM 建議看起來穩定後，再切換到 `assist`

相容 OpenAI 的變數示例：

```text
ISSUE_TRIAGE_LLM_MODE=shadow
ISSUE_TRIAGE_LLM_BASE_URL=https://your-provider.example.com/v1
ISSUE_TRIAGE_LLM_MODEL=gpt-4.1-mini
```

## 推出計劃

### Phase 1：當前階段

- 啟用 triage 和 backlog rescore
- 觀察幾周的 issue 流量後微調閾值
- 允許維護者透過 `triage-manual` 凍結特定 issue 的自動化處理
- 如果使用 LLM，從 `shadow` 模式開始

### Phase 2：Maintainer 交接

為 `triage/core` issue 增加 issue-brief 生成器，輸出內容包括：

- 復現提示
- 可能涉及的模組
- 風險備註
- 驗證清單

這些輸出可以直接用於本地程式設計 agent 會話，以及現有的並行 worktree 流程。

當前 MVP 已經會在 `triage/core` issue 的分診評論中直接嵌入一個
`Maintainer Brief` 區塊。該摘要包括：

- 簡潔的 issue 摘要
- issue 為什麼被升級到 core
- 復現路徑或操作路徑備註
- 疑似相關模組或工作流負責人
- 風險提示
- 驗證清單

### Phase 3：自託管 Issue Agent

增加一個自託管 runner，監聽 `triage/agent-ready`，並執行：

- 建立隔離的分支和 worktree
- 執行解決 issue 的 agent
- 執行最小相關測試集
- 開啟一個 draft PR

在這個階段，以下場景仍應保留硬性阻斷：

- auth 和許可權變更
- 安全敏感變更
- schema 或 migration 相關工作
- 公共 API、SDK 或 CLI 契約變更

## 待調優問題

- 參與度加成是否只看評論數就夠了，還是也應該拉取 reactions
- reward issue 是否應比當前 MVP 獲得更強的價值加成
- `agent-ready` 是否應要求 `effort <= 2`，而不是 `<= 3`
- 某些區域（如 `scanner`）是否應預設視為高風險
- 某些團隊是否應長期保持 `shadow` 模式，只把 `assist` 用在更窄的倉庫子集上
