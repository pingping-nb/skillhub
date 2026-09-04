# 可觀測性開發者接入指南

本文說明 SkillHub 程式碼如何接入統一的日誌關聯和鏈路追蹤標準。
開發者不需要直接操作 MDC、OpenTelemetry SDK 或 SkyWalking API。

## 1. 統一標準

| 資訊 | 來源 | 日誌欄位 | 傳播方式 |
|---|---|---|---|
| 請求關聯 ID | `RequestIdFilter` / `RequestIdAccessor` | `request.id` | `X-Request-Id` |
| 分散式 Trace ID | Micrometer Tracing | `trace.id` | W3C `traceparent` |
| Span ID | Micrometer Tracing | `span.id` | 當前 Trace Scope |

`request.id` 是 SkillHub 的請求/審計關聯標識，不等同於 `trace.id`。
請求沒有鏈路追蹤時仍應保留 `request.id`。

## 2. 執行模式

透過 `SKILLHUB_TRACING_MODE` 選擇一種模式，修改後重啟應用：

- `none`：預設模式。無應用內 OTel SDK 和 OTLP 匯出，只保留 `request.id`。
- `otel-sdk`：使用 Micrometer Tracing + OTel Bridge；配置
  `MANAGEMENT_OTLP_TRACING_ENDPOINT` 後才向 Collector 匯出。
- `external-agent`：應用內 Tracer 為 NOOP，由部署環境提供唯一的外部 Agent。
  SkillHub 只能校驗自身配置，不能識別任意 JVM Agent；唯一 Agent 是部署檢查項。

`none`/`external-agent` 不能配置 OTLP endpoint；`otel-sdk` 與外部 Tracing Agent
不得在同一程式中疊加。

## 3. 開發者接入方式

### 3.1 普通 HTTP 請求

不需要增加程式碼。`RequestIdFilter` 會生成或校驗 `X-Request-Id`，並在請求結束時清理
執行緒上下文。Micrometer Tracing 負責在 `otel-sdk` 模式下建立 HTTP Observation 和 Trace。

業務程式碼不要：

- `MDC.put` / `MDC.remove` 寫入請求關聯欄位；
- 手工解析或拼接 `traceparent`；
- 在日誌中輸出完整 MDC Map。

### 3.2 Spring 非同步任務

優先使用已有的 `skillhubEventExecutor`：

```java
@Async("skillhubEventExecutor")
public void handleEvent(SkillPublishedEvent event) {
    // 直接記錄日誌即可，request.id/trace.id/span.id 會按提交時的上下文恢復
}
```

新增 Spring 管理的執行緒池時，注入統一的
`ContextPropagatingTaskDecorator`，不要自己複製 MDC：

```java
@Bean
ThreadPoolTaskExecutor myExecutor(
        ContextPropagatingTaskDecorator contextDecorator
) {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setTaskDecorator(contextDecorator);
    executor.initialize();
    return executor;
}
```

該裝飾器負責捕獲、恢復和清理 `RequestIdAccessor` 與 OTel Observation Scope。

### 3.3 內部 HTTP 服務

內部服務呼叫必須使用 Spring 管理的 `WebClient.Builder`，這樣 `otel-sdk` 模式下會
自動傳播 W3C Trace Context：

```java
@Bean
HttpClient scannerClient(
        WebClient.Builder builder
) {
    return new WebClientHttpClient(builder.build());
}
```

Scanner 是當前已接入的內部客戶端。新增內部客戶端時，應補一個測試，斷言請求包含合法
的 `traceparent`。

### 3.4 外部 HTTP 服務

面向使用者配置的 GitLab、第三方 API 等外部服務不要複用內部觀測 Builder，也不要手工
刪除 Header。使用明確不接入 SkillHub Observation 的客戶端，並補測試斷言請求不包含
`traceparent`。

### 3.5 Redis Stream 和定時任務

Redis Stream 已透過 `MessageObservationSupport` 接入通用訊息傳播：

- Producer 把 `traceparent`、`tracestate` 和受控的 `skillhub.request_id` 寫入 Stream
  transport metadata，不修改 `ScanTask` 等業務物件；
- `AbstractStreamConsumer` 逐條提取上下文並建立 `CONSUMER` Observation，在 `finally`
  中恢復執行緒原狀態；
- Consumer 內部呼叫 Scanner 時，Spring 管理的 `WebClient` 自動建立同一 Trace 的子 Span；
- 重試發布發生在當前 Consumer Scope 內，新訊息繼續攜帶關聯上下文；Reclaimer 處理原訊息
  時重新從訊息提取，不繼承 Reclaimer 執行緒的上下文；
- `none` 和 `external-agent` 模式仍傳播 Request ID；應用保證完整 W3C Trace 的模式是
  `otel-sdk`，外部 Agent 的跨 Stream Trace 能力取決於對應 Agent 外掛。

新增 Redis Stream Consumer 應繼承 `AbstractStreamConsumer`，新增 Producer 應呼叫
`MessageObservationSupport.observePublish`。其他訊息中介軟體只實現自身 carrier 的
`MessageCarrierAdapter`；傳播核心不依賴 Redis、Redisson 或 `Map`。不要在業務 DTO、MDC
或日誌程式碼中複製上下文。

普通 `@Scheduled` 任務沒有上游訊息 carrier，仍是獨立後臺邊界；需要長期任務關聯時應使用
穩定任務 ID，而不是把任意歷史 HTTP Span 保持為超長父 Span。

## 4. 可擴充套件點

| 擴充套件需求 | 應擴充套件的位置 | 不應修改的位置 |
|---|---|---|
| 新增請求關聯來源 | `RequestIdFilter` / `RequestIdAccessor` | 業務 Controller、DTO |
| 新增執行緒上下文 | `RequestIdThreadLocalAccessor` / `ContextRegistry` | 每個任務的 `MDC` 程式碼 |
| 新增 Tracing 後端 | Micrometer Bridge / Collector 配置 | 業務服務 |
| 新增日誌欄位 | `SkillHubEcsEncoder` 白名單 | “輸出全部 MDC” |
| 新增內部 HTTP 客戶端 | Spring `WebClient.Builder` + propagation test | URL 正則刪 Header |
| 新增外部 HTTP 客戶端 | 獨立客戶端構建入口 + no-propagation test | 依賴全域性預設行為 |
| 新增訊息佇列邊界 | `MessageObservationSupport` + `MessageCarrierAdapter` | 業務 DTO、手工 MDC/OTel API |

## 5. 接入驗收清單

新增一個執行邊界或客戶端時，至少補充：

1. `none` 模式下業務結果不變；
2. `otel-sdk` 模式下內部呼叫的 `traceparent` 合法；
3. 外部呼叫不攜帶 `traceparent`；
4. 執行緒複用後上下文被清理，不發生串號；
5. 日誌只出現 `request.id`、`trace.id`、`span.id` 等白名單欄位；
6. Collector 不可用時不影響業務結果。
7. 訊息 Producer/Consumer 使用同一 Trace，Request ID 不串號，重試和 Reclaimer 不丟關聯。

執行後端驗證使用：

```bash
make test-backend-app
```

部署級變更再執行：

```bash
make staging
```
