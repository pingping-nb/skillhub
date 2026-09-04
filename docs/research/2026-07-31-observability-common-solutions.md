# Java / Spring 通用日誌關聯與鏈路追蹤方案調研

調研時間：2026-07-31
適用基線：SkillHub，Spring Boot 3.2.3、Java 21、Logback、Micrometer Actuator

## 結論

當前 Java/Spring 生態已經基本收斂到以下組合：

1. 使用 W3C `traceparent` / `tracestate` 作為跨程式傳播協議。
2. Spring 應用內使用 Micrometer Observation/Tracing，底層橋接 OpenTelemetry。
3. 雲原生或需要廣覆蓋自動插樁時使用 OpenTelemetry Java Agent。
4. 使用 OTLP 把 Trace 發往 Collector，再由 Collector 路由到 Tempo、Jaeger、Zipkin、
   SkyWalking 或商業後端。
5. 日誌只消費當前上下文中的 `traceId` / `spanId`，業務程式碼不操作 MDC。

Spring Cloud Sleuth、手寫 MDC/TID、TLog/TTL 和廠商 Agent 仍能見到，但不應作為
SkillHub 新機制的協議核心。

## 常見方案比較

| 方案 | 常見使用場景 | 優點 | 主要缺口 |
|---|---|---|---|
| Filter + MDC + TaskDecorator | 單體應用、只要求按 ID 查日誌 | 簡單、無採集端 | 沒有真實 Span；容易漏執行緒/客戶端邊界；手寫傳播易串號 |
| Micrometer Tracing + OTel bridge | Spring Boot 3.x 應用內建觀測 | Spring 官方路徑；自動日誌關聯；便於自定義基礎設施 Observation | 覆蓋依賴 Spring 已觀測的元件；執行緒池仍要正確配置上下文傳播 |
| OpenTelemetry Java Agent | Kubernetes、統一運維、需要 JDBC/Redis/HTTP 等廣覆蓋 | OTel 官方對 Spring Boot 的預設建議；零程式碼；覆蓋面最大 | 需要部署 Agent；必須實測啟動/CPU/記憶體開銷；自定義持久化任務邊界仍需擴充套件 |
| OpenTelemetry Spring Boot Starter | Native Image、不能掛 Agent、需要應用 YAML 配置 | OTel SDK 原生整合；適合 Agent 不可用場景 | OTel 官方不把它作為普通 Spring Boot 的預設選擇；需要單獨管理 OTel BOM |
| SkyWalking/Elastic/Pinpoint 等 Agent | 已統一採購或部署特定 APM 的企業 | 自動插樁成熟、開箱 UI | 協議和後端繫結更強；不適合作為開源產品內部 API |
| Spring Cloud Sleuth | Spring Boot 2.x 歷史專案 | 舊生態成熟 | 官方明確不支援 Spring Boot 3.x，核心已遷移到 Micrometer Tracing |

## 官方事實

### Spring Boot

- Spring Boot 3.2.3 Actuator 為 Micrometer Tracing 提供依賴管理和自動配置。
- OTel 組合使用 `micrometer-tracing-bridge-otel`；OTLP 使用
  `opentelemetry-exporter-otlp`。
- 啟用 Micrometer Tracing 後，Spring Boot 預設把 `traceId`、`spanId` 放入 MDC，並
  支援透過 `logging.pattern.correlation` 固定日誌格式。
- Spring Boot 3.2.3 預設產生 W3C 上下文，並可消費 W3C、B3、B3 Multi；新設計應只
  產生 W3C，相容消費策略可單獨配置。
- 自動 HTTP 傳播依賴 Spring 自動配置的 HTTP Client Builder；自行 `new` 客戶端會
  繞過傳播。
- Spring Framework 6.1 提供 `ContextPropagatingTaskDecorator`，用於恢復日誌和
  Observation 上下文；官方同時提醒大量極小任務會有傳播開銷。

### OpenTelemetry

- OTel 官方把 Java Agent 列為普通 Spring Boot 應用的預設零程式碼方案，因為它比
  Spring Boot Starter 提供更多開箱插樁。
- Starter 主要面向 Native Image、Agent 啟動開銷不滿足要求、已有其他 Java Agent，
  或需要透過 Spring 配置檔案管理 OTel 的場景。
- Java Agent 覆蓋 Spring Web MVC、JDBC、Lettuce、Java Executors、Logback 等
  SkillHub 關鍵邊界。
- Agent 的 Logback MDC 預設鍵為 `trace_id`、`span_id`、`trace_flags`；Micrometer
  預設鍵為 `traceId`、`spanId`。若支援兩種執行模式，必須統一日誌欄位，不能讓查詢方
  感知兩套命名。
- OTel 官方要求在目標部署環境實測 Agent 開銷，沒有通用的固定開銷數字；取樣率、
  JDBC/Redis Span 數量和資源限制都會影響結果。

### W3C Trace Context

- `traceparent` / `tracestate` 是廠商中立的傳播協議。
- Header 必須按標準校驗；無效上下文應丟棄並建立新 Trace。
- Trace Context 不得攜帶使用者身份、IP、Token 或其他敏感資訊。
- 公網呼叫方可偽造 sampled 標誌，因此取樣和費用控制必須由服務端約束。

## 開源專案觀察

- OpenTelemetry Demo 的 Java 服務直接在映象中掛載
  `opentelemetry-javaagent.jar`，透過標準 `OTEL_*` 配置連線 Collector，代表
  雲原生 Agent 路徑。
- Spring Petclinic Microservices 使用 Spring Boot tracing starter 和 Zipkin 後端，
  代表 Spring 原生整合路徑。後端選擇不同，但應用側仍依賴 Spring 觀測抽象。
- RuoYi-Cloud-Plus 預留 SkyWalking Java Agent 和 OAP/UI，代表廠商 Agent 路徑；
  適用於組織已統一使用 SkyWalking 的情況，不適合作為 SkillHub 的內部協議。

## 對 SkillHub 的候選結論

應用程式碼的穩定邊界應是 Spring 的 Observation/Tracing 抽象與 W3C 協議，而不是某個
日誌或 APM 產品：

```text
HTTP / Executor / Scheduler / Reliable Task boundary
                      │
              Observability interceptor
                      │
         Micrometer Observation / Tracing facade
                      │
             OpenTelemetry bridge + W3C
                      │
          optional OTLP exporter / Collector
```

候選主執行模式：

- 應用內使用 Micrometer Tracing + OpenTelemetry bridge，保證 Spring Boot 3.2.3
  原生整合、統一 MDC 欄位和自定義基礎設施 Observation。
- OTLP Exporter 預設關閉；開啟後只負責非同步匯出，不改變請求結果。
- Java Agent 作為高階部署模式，用於獲得 JDBC、Redis、第三方 HTTP Client 等更廣
  自動插樁。Agent 與應用內自動插樁不得同時啟用，除非原型證明不會產生重複 Span。
- 無 Trace SDK/Agent 時仍保留 `requestId` 日誌關聯；Trace 是增強能力，不是業務前置條件。

最終選擇仍需原型驗證：同一請求的 Span 是否重複、執行緒池上下文是否串號、Collector
中斷是否影響延遲、日誌欄位是否一致、關閉 tracing 後業務行為是否完全不變。

## 參考資料

- [Spring Boot 3.2.3 Tracing](https://docs.spring.io/spring-boot/docs/3.2.3/reference/html/actuator.html#actuator.micrometer-tracing)
- [Spring Boot current Tracing](https://docs.spring.io/spring-boot/reference/actuator/tracing.html)
- [Spring Framework 6.1 ContextPropagatingTaskDecorator](https://docs.spring.io/spring-framework/docs/6.1.4/javadoc-api/org/springframework/core/task/support/ContextPropagatingTaskDecorator.html)
- [OpenTelemetry Java Agent](https://opentelemetry.io/docs/zero-code/java/agent/)
- [OpenTelemetry Spring Boot Starter](https://opentelemetry.io/docs/zero-code/java/spring-boot-starter/)
- [OpenTelemetry Java supported libraries](https://opentelemetry.io/docs/zero-code/java/agent/supported-libraries/)
- [OpenTelemetry Java Agent performance](https://opentelemetry.io/docs/zero-code/java/agent/performance/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Spring Cloud Sleuth end-of-line notice](https://docs.spring.io/spring-cloud-sleuth/docs/current/reference/html/)
- [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo)
- [Spring Petclinic Microservices](https://github.com/spring-petclinic/spring-petclinic-microservices)
- [RuoYi-Cloud-Plus](https://github.com/dromara/RuoYi-Cloud-Plus)
