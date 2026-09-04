# SkillHub 日誌關聯與鏈路追蹤建設方案

> 日期：2026-07-31
>
> 狀態：Accepted（2026-07-31，按本文分階段實施和驗證）
>
> 關聯：GitHub Issue #597
> 適用基線：Spring Boot 3.2.3、Java 21、Logback、Micrometer Actuator

## 1. 背景

SkillHub 已經使用 `X-Request-Id` 關聯 API 響應、業務日誌和審計記錄，但目前仍存在以下問題：

- 部分應用服務和 DTO 直接讀取 SLF4J MDC，可觀測性實現洩漏到了業務程式碼。
- `X-Request-Id` 接受任意客戶端輸入，沒有統一的長度和字元約束。
- `@Async` 執行緒池沒有顯式傳播請求和 Trace 上下文，非同步日誌可能丟失關聯資訊。
- 當前沒有標準分散式 Trace，無法透過一個 ID 串聯 SkillHub、Scanner 等服務呼叫。
- 日誌欄位尚未形成適合 Elasticsearch/Kibana 查詢的穩定結構。

本方案用最小建設成本建立通用日誌關聯與鏈路追蹤基礎設施。它不負責建設完整的企業
可觀測性平臺，也不把日誌、Trace 或 Metrics 邏輯寫入業務處理器。

Issue #597 中“搜尋索引可靠非同步交付”應作為獨立問題處理，不屬於本文範圍。

## 2. 建設目標

一期需要實現：

1. 每個 HTTP 請求都有合法的 `request.id`。
2. 啟用 Tracing 時，日誌包含標準 `trace.id` 和 `span.id`。
3. `otel-sdk` 模式使用 W3C `traceparent` / `tracestate` 傳播 Trace Context。
4. 業務程式碼不直接讀寫 MDC，也不直接依賴 OpenTelemetry 或 SkyWalking API。
5. 現有 Spring `@Async` 執行器能夠正確傳播並清理上下文。
6. 日誌以結構化 JSON 輸出到 stdout，可由 Filebeat/Fluent Bit 採集到
   Elasticsearch/Kibana。
7. Trace 可以選擇透過 OTLP Collector 接入 SkyWalking。
8. Collector、SkyWalking、Elasticsearch 或日誌採集器不可用時，SkillHub 業務繼續執行。
9. SkillHub 應用配置只能啟用一個應用內 Tracer；`external-agent` 模式下唯一外部
   Agent 由部署引數和發布檢查保證。

本方案按多個小階段、小提交實施和驗證，全部透過後再統一建立一個替代 PR。

## 3. 非目標

一期不建設：

- 搜尋索引可靠佇列、重試、死信和重放。
- 多租戶差異化取樣和執行時動態取樣。
- Spring Cloud Config、Nacos 或可寫 Actuator 配置端點。
- 應用內 OTLP 熔斷器或自定義重試框架。
- 審計日誌歸檔、物理隔離和 WORM 儲存。
- 通用 PII/DLP 檢測平臺。
- Prometheus/Grafana/Kibana 告警模板和容量規劃平臺。
- Spring Boot 2.x 或 Java 17 相容。
- 在業務類上增加 Trace 註解或要求業務開發者操作 Span。

## 4. 總體架構

```text
HTTP request
    │
    ├─ RequestIdFilter
    │     └─ request.id
    │
    └─ Micrometer Observation / Tracing
          ├─ MDC correlation
          │     └─ JSON stdout
          │           └─ Filebeat / Fluent Bit
          │                 └─ Elasticsearch / Kibana
          │
          └─ OpenTelemetry Bridge
                └─ OTLP
                      └─ OpenTelemetry Collector
                            └─ SkyWalking OAP
```

穩定邊界是：

- 應用內使用 Micrometer Observation/Tracing。
- `otel-sdk` 模式跨程式使用 W3C Trace Context。
- Trace 匯出使用 OTLP。
- 日誌使用 ECS 風格欄位。
- SkyWalking、Elasticsearch 和 Kibana 都是部署介面卡，不進入業務模型。

## 5. 執行模式

透過一個啟動期配置選擇執行模式：

```yaml
skillhub:
  observability:
    tracing-mode: ${SKILLHUB_TRACING_MODE:none}
```

允許值和確定行為：

| 模式 | Micrometer Tracer | OTLP Exporter | 外部 Agent | 無 Agent/endpoint 時 |
|------|-------------------|---------------|------------|---------------------|
| `none` | NOOP | 無 | 不支援 | 只有 `request.id` |
| `otel-sdk` | OTel Bridge | 配置 endpoint 時建立 | 不支援 | 仍建立程式內 Trace，但不匯出 |
| `external-agent` | NOOP | 無 | 可選 | 記錄警告並退化為只有 `request.id` |

執行模式是啟動期不變數，不支援熱切換。

必須保證：

- `none` 和 `external-agent` 不建立應用內 OTel Span。
- `otel-sdk` 不支援同時啟用 SkyWalking、OTel 或其他外部 Tracing Agent；應用只能校驗
  自身 endpoint/mode 衝突，不能可靠識別任意 JVM Agent。
- `external-agent` 不建立 OTLP Exporter。
- SkillHub 配置能夠識別的衝突應在啟動時失敗；任意 Java Agent 無法被應用可靠識別，因此
  部署檢查和原型測試還必須驗證實際 JVM 引數中只有一個 Tracer。

一期實現並驗證三種模式的應用上下文互斥邊界和日誌關聯。`external-agent` 只驗證
SkyWalking Agent 接管 Trace 時應用內 OTel Tracer/Exporter 不工作；“只掛載一個外部
Agent”屬於部署驗收項。SkyWalking 特有高階能力不進入 SkillHub 核心程式碼。

## 6. 關聯欄位契約

### 6.1 對外日誌欄位

日誌輸出統一使用：

| 欄位 | 必需性 | 含義 |
|------|--------|------|
| `request.id` | HTTP 請求或顯式任務上下文中存在 | SkillHub API、響應和審計關聯 ID |
| `trace.id` | 當前存在有效 Trace 時 | 分散式 Trace ID |
| `span.id` | 當前 Tracer 能提供時 | 當前呼叫節點 ID |
| `service.name` | 始終存在 | 固定為 `skillhub` |
| `service.version` | 部署時提供 | 發布版本或映象對應 Commit |
| `service.environment` | 部署時提供 | 當前部署環境 |

`request.id` 與 `trace.id` 不能合併：

- `request.id` 屬於 SkillHub API 契約，可出現在響應和審計記錄中。
- `trace.id` 屬於可選的分散式追蹤上下文，可能被取樣或關閉。

啟動日誌以及沒有顯式任務上下文的後臺維護日誌允許不包含 `request.id`。

### 6.2 內部欄位對映

日誌基礎設施負責欄位對映，業務程式碼不感知具體 MDC 鍵：

| 來源 | 內部欄位 | 輸出欄位 |
|------|----------|----------|
| SkillHub Request Context | `requestId` | `request.id` |
| Micrometer OTel Bridge | `traceId` | `trace.id` |
| Micrometer OTel Bridge | `spanId` | `span.id` |
| SkyWalking Logback Toolkit 事件轉換器 | `tid` | `trace.id` |

SkyWalking Agent 是否能穩定提供獨立 `span.id` 以實際原型結果為準。無法穩定提供時允許只
輸出 `trace.id`，不得解析不穩定的內部字串格式。

External Agent 模式透過 SkyWalking 官方 Logback Toolkit 從當前日誌事件讀取 `tid`；
這不是業務程式碼讀取 MDC，也不能假定 `tid` 一定存在於非同步日誌執行緒的 MDC 中。日誌編碼器
只讀取允許的關聯欄位，不得把整個 MDC Map 自動寫入 JSON。

## 7. Request ID

### 7.1 輸入規則

客戶端可以傳入 `X-Request-Id`，但必須同時滿足：

- 長度為 1–64 個字元。
- 首字元是字母或數字。
- 其餘字元只允許字母、數字、`.`、`_`、`:`、`-`。

建議校驗表示式：

```regex
^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$
```

請求頭缺失、為空或不合法時，服務端生成 UUID。響應始終返回最終採用的
`X-Request-Id`。

### 7.2 程式碼邊界

新增通用 `RequestIdAccessor` 和對應的 Request ID Scope：

- Filter 負責解析、校驗、建立和清理 Request ID 上下文。
- 獨立 ThreadLocal Scope 是 Request ID 的程式內權威來源。
- 為該 Scope 註冊 Micrometer `ThreadLocalAccessor`，由
  `ContextPropagatingTaskDecorator` 捕獲、恢復和清理。
- Scope 同步維護日誌所需的 MDC 映象，但讀取方不能把 MDC 當作權威來源。
- API 響應工廠透過該抽象讀取 Request ID。
- 審計編排透過該抽象或明確引數讀取 Request ID。
- 應用服務、Controller 和 DTO 不再直接呼叫 `MDC.get()`。
- MDC 只作為日誌介面卡，不再作為業務上下文的權威來源。

## 8. Tracing 配置

`skillhub-app` 使用 Spring Boot 3.2.3 管理的依賴版本：

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

基礎配置：

```yaml
management:
  tracing:
    sampling:
      probability: ${SKILLHUB_TRACING_SAMPLING_PROBABILITY:0.1}
    baggage:
      enabled: false
    propagation:
      type: W3C
  otlp:
    tracing:
      timeout: ${SKILLHUB_OTLP_TIMEOUT:5s}
      compression: ${SKILLHUB_OTLP_COMPRESSION:gzip}
```

基礎配置不得為 OTLP endpoint 提供預設地址。只有 `otel-sdk` 部署顯式設定以下標準
Spring Boot 配置時才建立 Exporter：

```bash
MANAGEMENT_OTLP_TRACING_ENDPOINT=http://otel-collector:4318/v1/traces
```

一期沿用 OpenTelemetry 1.31 的預設 BatchSpanProcessor 有界佇列和丟棄策略，不增加應用內
重試、熔斷或自定義佇列實現。

## 9. 日誌輸出

### 9.1 輸出模式

- 本地開發預設使用可讀的文字日誌。
- `SKILLHUB_LOG_FORMAT=json` 啟用 ECS 風格 JSON stdout。
- JSON 編碼器顯式輸出標準欄位和三個關聯欄位，不啟用“輸出全部 MDC”。
- JSON ConsoleAppender 外包一層 Logback AsyncAppender，初始佇列容量為 1024，並允許透過
  `SKILLHUB_LOG_ASYNC_QUEUE_SIZE` 調整。
- AsyncAppender 使用非阻塞策略；佇列耗盡時日誌可能丟失，審計事實不依賴該通道。
- 異常使用 `error.type`、`error.message`、`error.stack_trace`。
- 佇列容量保持可配置，預設值在原型壓測後固定，不在設計階段猜測。
- 異常和佇列丟棄行為必須在測試中驗證。

示例：

```json
{
  "@timestamp": "2026-07-31T10:10:10.123Z",
  "log.level": "INFO",
  "service.name": "skillhub",
  "service.version": "0.2.15",
  "service.environment": "test",
  "request.id": "req-123",
  "trace.id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span.id": "00f067aa0ba902b7",
  "log.logger": "com.iflytek.skillhub...",
  "message": "..."
}
```

應用只輸出 stdout，不直接依賴 Elasticsearch SDK，也不直接寫 Elasticsearch。

### 9.2 審計邊界

`audit_log` 資料庫記錄仍是審計事實來源。stdout 日誌不能代替審計記錄，審計留存和歸檔
不在本方案中處理。

## 10. 上下文傳播

### 10.1 Spring 非同步執行器

為現有 `skillhubEventExecutor` 配置 Spring Framework 6.1 的
`ContextPropagatingTaskDecorator`：

- 提交任務時捕獲 Request ID 和 Trace Context。
- 執行任務時恢復上下文。
- 執行完成後在 `finally` 中清理。
- `CallerRunsPolicy` 觸發時也必須保持正確的巢狀作用域。

測試必須重複複用同一工作執行緒，證明不同請求之間不會串號。

### 10.2 訊息佇列與長生命週期後臺執行緒

Redis Stream 消費迴圈和 Reclaimer 不繼承應用啟動執行緒或任意請求的 MDC。Producer 透過
通用訊息 Observation 把 W3C Trace Context 與受控 Request ID 注入 transport metadata；
Consumer/Reclaimer 逐條提取、建立 Scope，並在處理結束後清理。Scanner HTTP 呼叫自然成為
Consumer Span 的子呼叫。

上下文不寫入 `ScanTask` 或搜尋業務 payload，也不改變可靠任務狀態機。普通定時任務沒有
上游 carrier，仍建立獨立執行上下文；長期延遲任務使用穩定任務 ID 或 Span Link，不維持
超長父 Span。

### 10.3 HTTP 出站

一期只管理兩類 HTTP Client：

- 內部 Scanner Client：使用 Spring 管理且帶 Observation 的 Builder，傳播 W3C Trace
  Context。
- 其他現有 Client：GitHub、GitLab、內建 Skill 公網下載和 S3 Client 均不在一期新增
  Trace Context 傳播。

後續新增 Client 必須明確選擇內部或外部配置，不能依賴全域性 Host 正則或在業務程式碼中手工
刪除 Header。

## 11. SkyWalking 與 Elasticsearch 接入

### 11.1 OTel SDK 模式

推薦鏈路：

```text
SkillHub
  → OTLP/HTTP
  → OpenTelemetry Collector
  → OTLP
  → SkyWalking OAP
```

Collector 用於協議適配和後端路由，不是 SkillHub 的啟動依賴。

SkyWalking 10.3 的 OTLP Trace 會轉換為 Zipkin Trace，並透過 Zipkin Query/Lens UI 查詢。
它不等價於 SkyWalking Java Agent 的原生拓撲、慢 SQL 和 Profiling 能力，部署檔案必須
明確該差異。原型報告必須記錄實際使用的 Maven 依賴、Collector、OAP 和 Agent 版本及
查詢結果。

### 11.2 External Agent 模式

需要 SkyWalking 原生能力時：

- 使用 `external-agent`。
- 不配置 SkillHub OTLP endpoint。
- 由部署環境掛載並啟動 SkyWalking Java Agent。
- 使用 SkyWalking 官方 Logback Toolkit 提供 Trace ID。
- 日誌基礎設施將 `tid` 對映為 `trace.id`。

### 11.3 日誌鏈路

```text
SkillHub JSON stdout
  → Filebeat / Fluent Bit
  → Elasticsearch
  → Kibana
```

Kibana 使用 `trace.id` 查詢日誌，SkyWalking 使用同一個 Trace ID 查詢呼叫鏈。

## 12. 實施步驟

### 階段一：Request ID 與日誌邊界

1. 增加 Request ID 校驗。
2. 建立 `RequestIdAccessor`。
3. 移除應用服務、Controller、DTO 對 MDC 的直接讀取。
4. 增加允許欄位明確的結構化日誌配置。
5. 增加 Request ID 和日誌欄位測試。

可觀察結果：

- 非法 Request ID 被替換。
- API 響應和審計記錄仍使用同一 Request ID。
- 業務類不再 import `org.slf4j.MDC`。

### 階段二：Micrometer + OTel

1. 增加 Tracing Bridge 和 OTLP Exporter 依賴。
2. 增加 `none`、`otel-sdk`、`external-agent` 模式。
3. 設定 W3C、關閉 baggage、配置取樣率。
4. 保證無 endpoint 時不會產生網路連線。
5. 保證每個模式只存在一個實際 Tracer。

可觀察結果：

- `none` 模式只有 `request.id`。
- `otel-sdk` 模式日誌出現標準 Trace 欄位。
- `external-agent` 模式不會產生應用內 OTel Trace。

### 階段三：傳播邊界

1. 為 `skillhubEventExecutor` 增加上下文傳播。
2. 驗證執行緒複用、巢狀任務和 `CallerRunsPolicy`。
3. 讓內部 Scanner Client 使用 Spring 管理且可觀測的 Client Builder。
4. 驗證外部 HTTP Client 不傳送 Trace Context。

### 階段四：部署示例與遠端驗證

1. 提供最小 OTel Collector 配置示例。
2. 補充 SkyWalking OTLP 與 Agent 模式差異。
3. 將待測分支合入 `big-main`，記錄合入後的精確 Commit SHA。
4. 構建繫結 `big-main` SHA 的測試映象。
5. 在共享測試機使用獨立容器、網路、資料卷和動態埠執行三個原型。
6. 生成中文測試報告並儲存在本地私有目錄，不提交開源倉庫。

每個階段使用獨立的小提交併保留在同一實現分支；前一階段的範圍測試透過後再進入下一
階段。公開 Issue 和 PR 統一在階段五建立。

### 階段五：社群交付（最後執行）

該階段必須在遠端驗證全部透過後執行：

1. 建立新的可觀測性建設 Issue，說明它承接 #597 中的“通用日誌關聯與鏈路追蹤”部分。
2. 搜尋索引可靠非同步交付繼續作為獨立問題，不混入新的可觀測性 Issue。
3. 從經過驗證的實現分支建立新的 PR，並關聯新 Issue。
4. PR 只包含公開程式碼、配置、自動化測試和公開部署說明；不得包含測試機地址、憑證、
   私有埠、原始遠端日誌或本地中文測試報告。
5. 在 #597、#644 及其他被替代的關聯項中回覆：
   - 原問題是否真實存在。
   - 為什麼不採用原 PR 的實現。
   - 新方案的邊界和主要改動。
   - 已完成的自動化及遠端驗證摘要。
   - 新 Issue 和替代 PR 的連結。
6. 確認維護者需要的資訊完整後，關閉已被替代的 PR；不在驗證完成前搶先關閉。
7. #597 等關聯 Issue 只根據剩餘問題是否已有明確承接決定關閉、縮小範圍或繼續保留，
   不因替代 PR 建立而自動關閉。
8. 新 PR 透過 Review 和 CI 後，確認 PR Head 仍等於已驗證的功能 SHA，且該 SHA 可從已
   測試的 `big-main` SHA 到達；滿足後才允許更新 `main`。
9. 如果 Review 或 CI 修復改變了程式碼、配置或測試指令碼，則原驗證證據失效：先將新 SHA
   合入 `big-main`，重新構建映象並完成受影響的遠端驗證，再更新 `main`。

## 13. 驗證方案

### 13.1 自動化測試

至少覆蓋：

- 未傳 Request ID 時自動生成。
- 合法 Request ID 被保留。
- 空值、超長值和非法字元被替換。
- Filter 正常、異常退出後都清理上下文。
- API 響應、審計和日誌中的 Request ID 一致。
- JSON 只輸出允許的關聯欄位。
- Trace 取樣率在測試中設為 `1.0` 後可穩定斷言。
- `@Async` 執行緒恢復父上下文。
- 連續複用同一執行緒執行不同請求時不串號。
- `CallerRunsPolicy` 下上下文正確恢復。
- `none`、`otel-sdk`、`external-agent` 的 Spring Context 互斥。
- 未配置 OTLP endpoint 時不建立網路匯出。
- 內部 Scanner 請求攜帶 `traceparent`。
- Redis Stream Producer/Consumer 保持同一 Trace 和 Request ID，處理結束後執行緒不串號。
- 重試發布和 Reclaimer 重新消費仍能恢復訊息關聯上下文。
- 外部 HTTP 請求不攜帶 `traceparent`。

### 13.2 遠端原型

#### 原型 A：none

- 不部署 Collector。
- SkillHub 正常啟動並完成核心 Smoke Test。
- 日誌存在 `request.id`，不存在偽造的 Trace 欄位。

#### 原型 B：otel-sdk

- SkillHub → Collector → SkyWalking 跑通。
- JSON 日誌進入 Elasticsearch/Kibana。
- Kibana 與 SkyWalking 能用同一 `trace.id` 查詢。
- Collector 停止後 SkillHub API 和非同步任務繼續工作。

#### 原型 C：external-agent

- SkyWalking Java Agent 提供原生 Trace。
- 應用內 OTel Exporter 不工作。
- 日誌能用 SkyWalking Trace ID 關聯。
- 不產生雙 Trace、重複 Span 或兩個衝突的 Trace ID。

### 13.3 遠端測試場景

- HTTP 成功、4xx、5xx 和未認證請求。
- Scanner 成功、超時和失敗。
- 非同步事件正常執行和丟擲異常。
- Redis Stream 正常消費、失敗重試、Pending Reclaim 和重複投遞。
- 併發請求重複使用執行緒池。
- Collector 啟動、停止和恢復。
- 日誌採集器停止或消費變慢。
- 取樣率 `0.0`、`0.1` 和 `1.0`。
- 容器收到 SIGTERM 後日誌和 Trace 的關閉行為。
- 日誌中不出現 Authorization、Cookie、Token、密碼和完整請求體。

## 14. 驗收標準

以下條件全部滿足後，一期才算完成：

- [ ] 三種模式行為與本文一致。
- [ ] 業務程式碼不再直接讀取或寫入 MDC。
- [ ] Request ID 校驗、響應和審計關聯測試透過。
- [ ] 日誌欄位符合約定，且不輸出完整 MDC。
- [ ] Spring 非同步執行器上下文傳播和隔離測試透過。
- [ ] Redis Stream 訊息上下文傳播、重試、Reclaimer 和隔離測試透過。
- [ ] 內外部 HTTP 傳播邊界測試透過。
- [ ] 無 OTLP endpoint 時不存在外部連線嘗試。
- [ ] Collector 中斷不影響 SkillHub 業務結果。
- [ ] OTel SDK 與 SkyWalking Agent 不會同時產生 Trace。
- [ ] `make test-backend-app` 透過。
- [ ] `make typecheck-web` 和 `make lint-web` 透過。
- [ ] 基於 `big-main` 合入後精確 SHA 構建的遠端三個原型透過。
- [ ] 中文測試報告儲存在本地私有目錄。
- [ ] 新的可觀測性 Issue 和替代 PR 已建立並互相關聯。
- [ ] #597、#644 等關聯項已獲得清晰回覆，被替代的舊 PR 已關閉。
- [ ] 關聯 Issue 已根據剩餘範圍分別關閉、縮小範圍或保留，且狀態理由清楚。
- [ ] 新 PR Head 與已驗證功能 SHA 一致，且可從已測試的 `big-main` SHA 到達。
- [ ] 透過驗證後才允許更新 `main`。

## 15. 回滾

出現問題時：

1. 將 `SKILLHUB_TRACING_MODE` 改為 `none`。
2. 刪除 `MANAGEMENT_OTLP_TRACING_ENDPOINT`。
3. 將 `SKILLHUB_LOG_FORMAT` 改為 `text`。
4. 保留 Request ID 和原有文字日誌能力。
5. 透過滾動重啟恢復，不進行執行時模式切換。

Tracing 和結構化日誌關閉後不得影響 SkillHub 的業務狀態、資料庫狀態或任務執行語義。

## 16. 已知限制

- 10% Head Sampling 下，全量日誌中的部分 `trace.id` 在 SkyWalking 中沒有對應 Trace。
- SkyWalking OTLP 模式的展示能力弱於原生 Java Agent。
- 日誌佇列在背壓時可能丟棄日誌，這是保護業務執行緒的預期行為。
- External Agent 提供哪些 MDC 欄位取決於具體 Agent 和版本。
- 一期只處理通用關聯和傳播，不保證搜尋索引非同步交付可靠性。

## 17. 參考資料

- [Spring Boot 3.2.3 Tracing](https://docs.spring.io/spring-boot/docs/3.2.3/reference/html/actuator.html#actuator.micrometer-tracing)
- [Micrometer Tracing](https://docs.micrometer.io/tracing/reference/)
- [OpenTelemetry Java OTLP Exporter](https://opentelemetry.io/docs/languages/java/exporters/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [SkyWalking OpenTelemetry Trace](https://skywalking.apache.org/docs/main/v10.3.0/en/setup/backend/otlp-trace/)
- [SkyWalking Logback Toolkit](https://skywalking.apache.org/docs/skywalking-java/next/en/setup/service-agent/java-agent/application-toolkit-logback-1.x/)
- [Elastic ECS Tracing Fields](https://www.elastic.co/docs/reference/ecs/ecs-tracing)
- [方案調研](./research/2026-07-31-observability-common-solutions.md)
