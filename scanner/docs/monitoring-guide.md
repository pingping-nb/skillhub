# Scanner 運維監控指南

## 概述

本檔案提供 Scanner 服務的運維監控指南，包括關鍵指標、告警規則和故障排查方法。

## 關鍵監控指標

### 1. 版本狀態監控

#### SCANNING 狀態的版本數量

```sql
-- 查詢當前處於 SCANNING 狀態的版本數量
SELECT COUNT(*) as scanning_count
FROM skill_versions
WHERE status = 'SCANNING';
```

**告警閾值**：
- ⚠️ 警告：> 10 個版本
- 🔴 嚴重：> 50 個版本

#### SCAN_FAILED 狀態的版本數量

```sql
-- 查詢最近 1 小時內掃描失敗的版本數量
SELECT COUNT(*) as failed_count
FROM skill_versions
WHERE status = 'SCAN_FAILED'
  AND updated_at > NOW() - INTERVAL 1 HOUR;
```

**告警閾值**：
- ⚠️ 警告：> 5 個版本/小時
- 🔴 嚴重：> 20 個版本/小時

#### 卡死的掃描任務

```sql
-- 查詢卡在 SCANNING 狀態超過 10 分鐘的版本
SELECT id, skill_id, version, status, created_at, updated_at
FROM skill_versions
WHERE status = 'SCANNING'
  AND updated_at < NOW() - INTERVAL 10 MINUTE
ORDER BY updated_at ASC;
```

**告警閾值**：
- 🔴 嚴重：任何超過 10 分鐘的 SCANNING 狀態

### 2. Redis Stream 監控

#### 訊息堆積情況

```bash
# 檢視 scan 佇列的訊息堆積情況
redis-cli XPENDING skillhub:scan:requests skillhub-scanners

# 檢視佇列長度
redis-cli XLEN skillhub:scan:requests
```

**告警閾值**：
- ⚠️ 警告：佇列長度 > 100
- 🔴 嚴重：佇列長度 > 500

#### 消費者狀態

```bash
# 檢視消費者組資訊
redis-cli XINFO GROUPS skillhub:scan:requests

# 檢視消費者資訊
redis-cli XINFO CONSUMERS skillhub:scan:requests skillhub-scanners
```

**檢查項**：
- 消費者是否線上
- 是否有長時間未確認的訊息

### 3. 臨時檔案監控

#### 磁碟空間使用

```bash
# 檢查臨時檔案目錄大小
du -sh /tmp/skillhub-scans/

# 檢查 /tmp 分割槽剩餘空間
df -h /tmp
```

**告警閾值**：
- ⚠️ 警告：/tmp 剩餘空間 < 5GB
- 🔴 嚴重：/tmp 剩餘空間 < 1GB

#### 孤兒檔案清理

```bash
# 查詢超過 1 小時的臨時檔案（可能是孤兒檔案）
find /tmp/skillhub-scans/ -type f -mmin +60

# 清理孤兒檔案（謹慎操作）
find /tmp/skillhub-scans/ -type f -mmin +60 -delete
```

### 4. Scanner 服務健康檢查

#### HTTP 健康檢查

```bash
# 檢查 Scanner 服務是否可用
curl -f http://localhost:8000/health || echo "Scanner service is down"

# 檢查響應時間
time curl -s http://localhost:8000/health > /dev/null
```

**告警閾值**：
- ⚠️ 警告：響應時間 > 5 秒
- 🔴 嚴重：服務不可用

#### 掃描成功率

```sql
-- 計算最近 1 小時的掃描成功率
SELECT
    COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'SCAN_FAILED' THEN 1 END) as failed_count,
    ROUND(
        COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END) * 100.0 /
        NULLIF(COUNT(*), 0),
        2
    ) as success_rate
FROM skill_versions
WHERE updated_at > NOW() - INTERVAL 1 HOUR
  AND status IN ('PENDING_REVIEW', 'SCAN_FAILED');
```

**告警閾值**：
- ⚠️ 警告：成功率 < 80%
- 🔴 嚴重：成功率 < 50%

## Prometheus 告警規則示例

```yaml
groups:
  - name: scanner_alerts
    interval: 30s
    rules:
      # Scanner 服務不可用
      - alert: ScannerServiceDown
        expr: up{job="skill-scanner"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Scanner service is down"
          description: "Scanner service has been down for more than 2 minutes"

      # 掃描失敗率過高
      - alert: ScannerHighFailureRate
        expr: rate(scanner_failures_total[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Scanner failure rate > 50%"
          description: "Scanner failure rate is {{ $value | humanizePercentage }} in the last 5 minutes"

      # 版本卡在 SCANNING 狀態
      - alert: ScanStuckTooLong
        expr: skillhub_scanning_versions{status="SCANNING"} > 0
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Versions stuck in SCANNING state"
          description: "{{ $value }} versions have been in SCANNING state for more than 10 minutes"

      # 臨時檔案磁碟空間不足
      - alert: TempFilesDiskUsage
        expr: node_filesystem_avail_bytes{mountpoint="/tmp"} < 1e9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Temp files disk usage high"
          description: "Only {{ $value | humanize1024 }}B available in /tmp"

      # Redis Stream 訊息堆積
      - alert: ScanQueueBacklog
        expr: redis_stream_length{stream="skillhub:scan:requests"} > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Scan queue backlog"
          description: "{{ $value }} messages pending in scan queue"
```

## 故障排查手冊

### 問題 1：版本卡在 SCANNING 狀態

**症狀**：
- 使用者反饋技能包一直在掃描中
- 資料庫中版本狀態為 SCANNING 超過 10 分鐘

**排查步驟**：

1. 檢查 Redis Stream 消費者是否線上
```bash
redis-cli XINFO CONSUMERS skillhub:scan:requests skillhub-scanners
```

2. 檢查是否有對應的訊息
```bash
redis-cli XPENDING skillhub:scan:requests skillhub-scanners
```

3. 檢查應用日誌
```bash
kubectl logs -l app=skillhub-backend --tail=100 | grep "versionId=<VERSION_ID>"
```

**解決方案**：

如果確認訊息丟失或消費者異常，手動修復版本狀態：

```sql
-- 將卡死的版本標記為 SCAN_FAILED
UPDATE skill_versions
SET status = 'SCAN_FAILED', updated_at = NOW()
WHERE id = <VERSION_ID> AND status = 'SCANNING';

-- 建立人工稽核任務
INSERT INTO review_tasks (skill_version_id, namespace_id, requester_id, created_at)
SELECT id, (SELECT namespace_id FROM skills WHERE id = skill_id), created_by, NOW()
FROM skill_versions
WHERE id = <VERSION_ID>;
```

### 問題 2：Scanner 服務不可用

**症狀**：
- 所有掃描任務失敗
- HTTP 連線超時

**排查步驟**：

1. 檢查 Scanner 服務狀態
```bash
# Docker 環境
docker ps | grep scanner

# Kubernetes 環境
kubectl get pods -l app=skill-scanner
```

2. 檢查 Scanner 日誌
```bash
# Docker 環境
docker logs skill-scanner --tail=100

# Kubernetes 環境
kubectl logs -l app=skill-scanner --tail=100
```

3. 檢查網路連通性
```bash
curl -v http://localhost:8000/health
```

**解決方案**：

- 重啟 Scanner 服務
- 檢查配置是否正確（API key、base URL 等）
- 檢查資源限制（CPU、記憶體）

### 問題 3：臨時檔案佔滿磁碟

**症狀**：
- /tmp 分割槽空間不足
- 掃描任務失敗，日誌顯示 "No space left on device"

**排查步驟**：

1. 檢查磁碟使用情況
```bash
df -h /tmp
du -sh /tmp/skillhub-scans/
```

2. 查詢大檔案
```bash
find /tmp/skillhub-scans/ -type f -size +100M -exec ls -lh {} \;
```

3. 查詢孤兒檔案
```bash
find /tmp/skillhub-scans/ -type f -mmin +60
```

**解決方案**：

```bash
# 清理超過 1 小時的臨時檔案
find /tmp/skillhub-scans/ -type f -mmin +60 -delete

# 清理空目錄
find /tmp/skillhub-scans/ -type d -empty -delete
```

### 問題 4：Redis Stream 訊息堆積

**症狀**：
- 掃描任務延遲嚴重
- Redis Stream 佇列長度持續增長

**排查步驟**：

1. 檢查佇列長度
```bash
redis-cli XLEN skillhub:scan:requests
```

2. 檢查消費者數量和狀態
```bash
redis-cli XINFO CONSUMERS skillhub:scan:requests skillhub-scanners
```

3. 檢查應用例項數量
```bash
kubectl get pods -l app=skillhub-backend
```

**解決方案**：

- 增加應用例項數量（水平擴充套件）
- 檢查 Scanner 服務效能
- 臨時禁用掃描功能，清空佇列後再啟用

## 日常巡檢清單

### 每日檢查

- [ ] 檢查 SCANNING 狀態的版本數量
- [ ] 檢查 SCAN_FAILED 狀態的版本數量
- [ ] 檢查 Scanner 服務健康狀態
- [ ] 檢查 /tmp 磁碟空間使用情況

### 每週檢查

- [ ] 檢查掃描成功率趨勢
- [ ] 檢查 Redis Stream 訊息堆積情況
- [ ] 清理孤兒臨時檔案
- [ ] 檢查告警規則是否觸發

### 每月檢查

- [ ] 審查掃描失敗的原因分佈
- [ ] 評估 Scanner 服務效能
- [ ] 最佳化告警閾值
- [ ] 更新運維檔案

## 相關檔案

- [故障影響分析](./failure-impact-analysis.md)
- [改進建議](./improvement-recommendations.md)
- [配置說明](./configuration.md)
