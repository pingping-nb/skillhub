# 通用可觀測性決策圖

目標：為 SkillHub 建立獨立、通用、可插拔的日誌關聯、指標和鏈路追蹤基礎設施。
當前實現覆蓋 HTTP、SkillHub 管理的執行緒池、Redis Stream 和明確接入的內部 HTTP Client；
普通定時任務沒有上游 carrier，仍是獨立後臺邊界。Redis Stream 上下文只進入 transport
metadata，不進入業務模型和業務載荷。

邊界：

- Servlet Filter、執行器裝飾器、訊息 Observation 和明確接入的 Client Builder 負責
  建立/恢復上下文。
- Redis Stream Producer 注入、Consumer/Reclaimer 逐條提取；定時任務不繼承任意請求。
- 業務程式碼不讀寫 MDC，不負責建立通用 Span，也不負責統計任務生命週期指標。
- 使用 W3C Trace Context；日誌後端、Metrics 後端和 Trace Exporter 均可替換。
- 上下文是有長度限制的基礎設施後設資料，不進入業務 payload。
- Collector、Exporter 或 Metrics 後端不可用時，主業務和任務核心繼續工作。

必須滿足的不變數：

- 每個已納入本期的執行邊界都正確建立作用域並在 `finally` 清理，執行緒複用不得串號。
- 日誌穩定輸出 `requestId`、`traceId`、`spanId`（存在時）；任務執行資源標識不由本期
  可觀測性自動生成。
- Trace 與 Metrics 可關閉、可替換；關閉後不得改變業務行為。
- 指標只使用低基數維度，業務 ID 不進入標籤。
- 採集端不可用必須非同步、限時、限佇列並 fail-open。

## #1：可觀測性是否與業務和任務狀態機徹底分離？

Blocked by: 無
Type: Grilling

### Question

可觀測性是否只透過通用執行邊界和生命週期訊號接入，不進入業務處理器？

### Answer

已確認。可靠任務核心只發布通用生命週期訊號；可觀測性攔截器把執行資源標識加入日誌、
Span 和指標。搜尋處理器只處理搜尋，不認識 MDC、OpenTelemetry 或 Prometheus。

## #2：通用關聯身份和傳播協議是什麼？

Blocked by: #1
Type: Research

### Question

如何區分現有 `X-Request-Id`、W3C `traceId/spanId` 和執行資源標識，並跨 HTTP、執行緒池
邊界傳播？

### Answer

已確定：

- `requestId` 是 SkillHub 的請求/審計關聯標識，不冒充分散式 Trace。
- `traceId/spanId` 由 Tracer 生成，跨程式只使用 W3C `traceparent/tracestate`。
- 定時任務或可靠任務的執行資源 ID 只作為當前執行作用域屬性，不進入業務 payload。
- HTTP、執行緒池和訊息 carrier 的注入/提取位於基礎設施層；訊息上下文是 transport
  metadata，不是任務業務欄位。
- 不傳播任意 MDC Map；baggage 預設關閉，任何允許項都必須低敏、限長、顯式配置。
- 無效或不可信的公網 Trace Context 按 W3C 規則丟棄，服務端控制取樣。

常見方案和候選組合見
[Java / Spring 通用日誌關聯與鏈路追蹤方案調研](./research/2026-07-31-observability-common-solutions.md)。

## #3：採用 Micrometer Observation、OpenTelemetry API/SDK 還是 Java Agent？

Blocked by: #2
Type: Research

### Question

哪種組合最適配 Spring Boot 3.2.3，並同時支援無 Collector 執行、可選 OTLP 和穩定日誌關聯？

### Answer

已選擇三模式：

- `none`：不建立應用內 OTel SDK 或 Exporter，只保留 Request ID。
- `otel-sdk`：使用 Micrometer Tracing + OTel Bridge；配置 OTLP endpoint 時才匯出。
- `external-agent`：應用內使用 NOOP Tracer，由部署環境提供唯一的外部 Agent。

應用程式碼只依賴 Micrometer/Observation 邊界，不依賴 OTel SDK 或 SkyWalking API。
自動配置測試已證明三種模式互斥，錯誤的 endpoint/mode 組合會在啟動時失敗。

## #4：如何證明上下文傳播、日誌輸出和故障降級正確？

Blocked by: #3
Type: Prototype

### Question

驗證執行緒複用隔離、巢狀作用域、非同步任務邊界、訊息傳播、取樣、Exporter 超時、
Collector 中斷、佇列打滿和關閉觀測能力等場景。排程任務驗證不繼承請求上下文；
Redis Stream 驗證逐條注入、提取和清理。

### Answer

本地原型已證明：

- Request ID Scope 線上程複用、巢狀 Scope、異常退出和 `CallerRunsPolicy` 下均能恢復並
  清理。
- Micrometer 手工 Span 和 Observation 均能隨 `skillhubEventExecutor` 傳播。
- Redis Stream Producer/Consumer 透過通用訊息 Observation 傳播 W3C Trace Context 和
  受控 Request ID，Reclaimer 從原訊息重新提取。
- Scanner 使用 Spring 管理的 `WebClient.Builder` 傳播 W3C `traceparent`。
- 面向使用者配置的 GitLab 外部 Client 不傳播 Trace Context。
- `none / otel-sdk / external-agent` 的應用上下文和 Exporter 條件符合設計。
- `@Scheduled` 保持獨立後臺執行邊界；Redis Stream/Reclaimer 不繼承執行緒上下文，而是
  從每條訊息的 transport metadata 恢復。

Collector 中斷、日誌背壓、取樣率和關閉行為仍由 `big-main` 精確 SHA 映象的遠端原型驗證。

## #5：如何形成可部署閉環？

Blocked by: #4
Type: Research

### Question

確定 stdout 格式、可選 JSON、Prometheus 或 OTLP Metrics、Trace Exporter、暴露邊界、
低基數告警和運維檔案。

### Answer

已確定最小交付：

- 文字日誌用於本地開發，ECS 風格 JSON stdout 用於部署環境。
- JSON 日誌只輸出白名單關聯欄位，透過有界非阻塞 AsyncAppender 保護業務執行緒。
- Trace 可經 OTLP Collector 路由到 SkyWalking；需要 SkyWalking 原生能力時改用唯一的
  Java Agent。
- Prometheus 繼續作為可選 Metrics 後端，不是本期鏈路關聯的前置條件。

部署配置和三模式操作說明寫入 `docs/09-deployment.md`；遠端實測結果只儲存在本地私有
中文報告中。
