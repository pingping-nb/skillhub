# Scanner 系統改進建議

## 概述

本檔案記錄 Scanner 系統的改進建議，用於提升系統的可靠性、可觀測性和容錯能力。

**注意**：這些建議目前暫不實施，僅作為未來最佳化的參考。

## 改進優先順序

### 🔴 P0 - 高優先順序（防止資料不一致）

#### 1. 新增超時監控，防止版本卡死

**問題**：版本可能永久停留在 `SCANNING` 狀態

**解決方案**：

```java
// 新增定時任務，自動處理卡死的掃描任務
@Scheduled(fixedRate = 300000) // 每 5 分鐘執行一次
public void checkStuckScans() {
    List<SkillVersion> stuckVersions = skillVersionRepository
        .findByStatusAndUpdatedAtBefore(
            SkillVersionStatus.SCANNING,
            LocalDateTime.now().minusMinutes(10)
        );

    stuckVersions.forEach(version -> {
        log.warn("Scan stuck for versionId={}, auto-failing", version.getId());
        version.setStatus(SkillVersionStatus.SCAN_FAILED);
        skillVersionRepository.save(version);

        // 建立人工稽核任務
        skillRepository.findById(version.getSkillId())
            .ifPresent(skill -> reviewTaskRepository.save(
                new ReviewTask(version.getId(), skill.getNamespaceId(), version.getCreatedBy())
            ));
    });
}
```

**配置項**：

```yaml
skillhub:
  security:
    scanner:
      stuck-scan-timeout-minutes: 10  # 超過 10 分鐘自動標記失敗
```

**預期效果**：
- 防止版本永久卡死
- 自動降級到人工稽核
- 提升使用者體驗

---

### 🟡 P1 - 中優先順序（防止服務雪崩）

#### 2. 新增熔斷器，防止雪崩

**問題**：Scanner 持續故障時，大量重試請求可能導致雪崩

**解決方案**：

使用 Resilience4j 實現熔斷器：

```xml
<!-- pom.xml -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.1.0</version>
</dependency>
```

```java
// SkillScannerService.java
@CircuitBreaker(name = "scanner", fallbackMethod = "scanFallback")
public SecurityScanResponse scan(SecurityScanRequest request) {
    // 原有的掃描邏輯
    return httpClient.post(scanUrl, request);
}

private SecurityScanResponse scanFallback(SecurityScanRequest request, Exception e) {
    log.error("Scanner circuit breaker triggered, falling back to manual review", e);
    throw new ScannerUnavailableException("Scanner service unavailable, please try again later");
}
```

**配置項**：

```yaml
resilience4j:
  circuitbreaker:
    instances:
      scanner:
        failure-rate-threshold: 50  # 失敗率超過 50% 觸發熔斷
        wait-duration-in-open-state: 60s  # 熔斷後等待 1 分鐘
        sliding-window-size: 10  # 滑動視窗大小
        minimum-number-of-calls: 5  # 最小呼叫次數
        permitted-number-of-calls-in-half-open-state: 3  # 半開狀態允許的呼叫次數
```

**預期效果**：
- 快速失敗，避免長時間等待
- 保護 Scanner 服務不被打垮
- 自動恢復機制

---

#### 3. 新增重試策略最佳化

**問題**：當前重試機制可能導致請求風暴

**解決方案**：

```java
@Retry(name = "scanner", fallbackMethod = "scanFallback")
@CircuitBreaker(name = "scanner", fallbackMethod = "scanFallback")
public SecurityScanResponse scan(SecurityScanRequest request) {
    return httpClient.post(scanUrl, request);
}
```

**配置項**：

```yaml
resilience4j:
  retry:
    instances:
      scanner:
        max-attempts: 3  # 最多重試 3 次
        wait-duration: 5s  # 重試間隔 5 秒
        exponential-backoff-multiplier: 2  # 指數退避倍數
        retry-exceptions:
          - java.net.ConnectException
          - java.net.SocketTimeoutException
```

**預期效果**：
- 指數退避，避免請求風暴
- 只對特定異常重試
- 更智慧的重試策略

---

### 🟢 P2 - 低優先順序（提升可觀測性）

#### 4. 新增健康檢查端點

**問題**：無法快速判斷 Scanner 服務是否可用

**解決方案**：

```java
@RestController
@RequestMapping("/actuator/health")
public class ScannerHealthIndicator {

    private final SkillScannerService scannerService;

    @GetMapping("/scanner")
    public ResponseEntity<Map<String, Object>> scannerHealth() {
        try {
            boolean healthy = scannerService.isHealthy();
            Map<String, Object> health = Map.of(
                "status", healthy ? "UP" : "DOWN",
                "timestamp", System.currentTimeMillis()
            );
            return healthy
                ? ResponseEntity.ok(health)
                : ResponseEntity.status(503).body(health);
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of(
                "status", "DOWN",
                "error", e.getMessage(),
                "timestamp", System.currentTimeMillis()
            ));
        }
    }
}
```

```java
// SkillScannerService.java
public boolean isHealthy() {
    try {
        HttpResponse<String> response = httpClient.get(baseUrl + "/health");
        return response.statusCode() == 200;
    } catch (Exception e) {
        log.warn("Scanner health check failed", e);
        return false;
    }
}
```

**預期效果**：
- 快速判斷 Scanner 服務狀態
- 整合到監控系統
- 支援自動化健康檢查

---

#### 5. 新增詳細的指標和日誌

**問題**：缺少詳細的監控指標

**解決方案**：

```java
// 新增 Micrometer 指標
@Component
public class ScannerMetrics {

    private final MeterRegistry registry;
    private final Counter scanSuccessCounter;
    private final Counter scanFailureCounter;
    private final Timer scanDurationTimer;

    public ScannerMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.scanSuccessCounter = Counter.builder("scanner.scans.success")
            .description("Number of successful scans")
            .register(registry);
        this.scanFailureCounter = Counter.builder("scanner.scans.failure")
            .description("Number of failed scans")
            .register(registry);
        this.scanDurationTimer = Timer.builder("scanner.scan.duration")
            .description("Scan duration")
            .register(registry);
    }

    public void recordSuccess() {
        scanSuccessCounter.increment();
    }

    public void recordFailure() {
        scanFailureCounter.increment();
    }

    public Timer.Sample startTimer() {
        return Timer.start(registry);
    }
}
```

**預期效果**：
- 詳細的效能指標
- 支援 Prometheus 監控
- 便於問題排查

---

#### 6. 新增臨時檔案清理任務

**問題**：臨時檔案可能洩漏

**解決方案**：

```java
@Scheduled(cron = "0 0 2 * * ?") // 每天凌晨 2 點執行
public void cleanupOrphanedTempFiles() {
    Path tempDir = Paths.get("/tmp/skillhub-scans");
    if (!Files.exists(tempDir)) {
        return;
    }

    try (Stream<Path> files = Files.walk(tempDir)) {
        long cutoffTime = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(1);

        files.filter(Files::isRegularFile)
             .filter(path -> {
                 try {
                     return Files.getLastModifiedTime(path).toMillis() < cutoffTime;
                 } catch (IOException e) {
                     return false;
                 }
             })
             .forEach(path -> {
                 try {
                     Files.delete(path);
                     log.info("Cleaned up orphaned temp file: {}", path);
                 } catch (IOException e) {
                     log.warn("Failed to delete orphaned temp file: {}", path, e);
                 }
             });
    } catch (IOException e) {
        log.error("Failed to cleanup orphaned temp files", e);
    }
}
```

**配置項**：

```yaml
skillhub:
  security:
    scanner:
      temp-file-cleanup:
        enabled: true
        cron: "0 0 2 * * ?"  # 每天凌晨 2 點
        retention-hours: 1  # 保留 1 小時內的檔案
```

**預期效果**：
- 自動清理孤兒檔案
- 防止磁碟空間耗盡
- 定期維護

---

## 實施建議

### 階段 1：緊急修復（1-2 天）

1. 實施超時監控（P0）
2. 新增基本的健康檢查端點（P2）

### 階段 2：穩定性提升（1 周）

1. 實施熔斷器（P1）
2. 最佳化重試策略（P1）
3. 新增詳細的指標和日誌（P2）

### 階段 3：運維最佳化（2 周）

1. 新增臨時檔案清理任務（P2）
2. 完善監控告警規則
3. 編寫運維手冊

---

## 技術依賴

### 新增依賴

```xml
<!-- Resilience4j 熔斷器和重試 -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.1.0</version>
</dependency>

<!-- Micrometer 指標（Spring Boot 已包含） -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

### 配置變更

需要在 `application.yml` 中新增：
- Resilience4j 熔斷器配置
- Resilience4j 重試配置
- Scanner 超時監控配置
- 臨時檔案清理配置

---

## 測試計劃

### 單元測試

- [ ] 超時監控邏輯測試
- [ ] 熔斷器觸發和恢復測試
- [ ] 重試策略測試
- [ ] 健康檢查端點測試
- [ ] 臨時檔案清理測試

### 整合測試

- [ ] Scanner 服務宕機場景測試
- [ ] Scanner 服務響應慢場景測試
- [ ] Scanner 服務返回錯誤場景測試
- [ ] 熔斷器在高負載下的表現測試

### 效能測試

- [ ] 熔斷器對效能的影響
- [ ] 重試策略對效能的影響
- [ ] 監控指標對效能的影響

---

## 相關檔案

- [故障影響分析](./failure-impact-analysis.md)
- [運維監控指南](./monitoring-guide.md)
- [配置說明](./configuration.md)
