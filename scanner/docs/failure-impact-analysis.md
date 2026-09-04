# Scanner 介面故障影響分析

## 概述

本檔案分析 Cisco skill-scanner API 介面出現故障時對 SkillHub 系統的影響，以及當前的錯誤處理機制。

## 故障場景分類

### 場景 A：Scanner 服務完全不可用

**現象**：
- HTTP 連線超時
- 服務宕機
- 網路不通

**影響**：
- ❌ **技能包發布流程中斷**
- ❌ 技能版本狀態卡在 `SCANNING`
- ⚠️ 使用者無法繼續發布新版本

### 場景 B：Scanner 服務響應慢

**現象**：
- 掃描超時（預設 5 分鐘 read timeout）

**影響**：
- ⚠️ 發布流程變慢
- ⚠️ Redis Stream 訊息堆積
- ⚠️ 可能觸發重試機制

### 場景 C：Scanner 返回錯誤響應

**現象**：
- HTTP 4xx/5xx 錯誤

**影響**：
- ❌ 掃描任務失敗
- ✅ 自動降級到人工稽核流程

## 錯誤處理機制（當前實現）

### 處理流程

```
發布技能包
    ↓
triggerScan() → 建立 SecurityAudit + 傳送 Redis 訊息
    ↓
版本狀態 → SCANNING
    ↓
ScanTaskConsumer 消費訊息
    ↓
呼叫 securityScanner.scan()
    ↓
┌─────────────────────────────────────┐
│ 如果 Scanner 介面失敗：              │
│                                     │
│ 1. 丟擲 SecurityScanException       │
│ 2. AbstractStreamConsumer 捕獲異常  │
│ 3. 呼叫 markFailed()                │
│ 4. 版本狀態 → SCAN_FAILED           │
│ 5. 自動建立 ReviewTask              │
│ 6. 清理臨時檔案                      │
│ 7. 重試機制（最多 3 次）             │
└─────────────────────────────────────┘
```

### 關鍵程式碼位置

**錯誤處理邏輯**：
- `ScanTaskConsumer.markFailed()` - `server/skillhub-app/src/main/java/com/iflytek/skillhub/stream/ScanTaskConsumer.java:104-119`

```java
@Override
protected void markFailed(ScanTaskPayload payload, String error) {
    try {
        skillVersionRepository.findById(payload.versionId)
                .filter(version -> version.getStatus() == SkillVersionStatus.SCANNING)
                .ifPresent(version -> {
                    version.setStatus(SkillVersionStatus.SCAN_FAILED);  // ← 標記失敗
                    skillVersionRepository.save(version);
                    skillRepository.findById(version.getSkillId())
                            .ifPresent(skill -> reviewTaskRepository.save(
                                    new ReviewTask(payload.versionId, skill.getNamespaceId(), version.getCreatedBy())  // ← 降級到人工稽核
                            ));
                });
    } finally {
        cleanupTempPath(payload.skillPath);  // ← 清理臨時檔案
    }
}
```

## 具體影響總結

| 故障型別 | 使用者體驗 | 系統行為 | 資料一致性 | 恢復方式 |
|---------|---------|---------|-----------|---------|
| **Scanner 宕機** | ❌ 發布失敗，顯示掃描失敗 | ✅ 自動降級到人工稽核 | ✅ 版本狀態正確更新 | 自動恢復 |
| **網路超時** | ⚠️ 等待 5 分鐘後失敗 | ✅ 重試 3 次後降級 | ✅ 狀態一致 | 自動重試 |
| **Scanner 返回 5xx** | ❌ 掃描失敗 | ✅ 降級到人工稽核 | ✅ 狀態一致 | 自動恢復 |
| **Scanner 返回 4xx** | ❌ 掃描失敗 | ✅ 降級到人工稽核 | ✅ 狀態一致 | 需修復請求 |
| **Redis Stream 故障** | ❌ 訊息丟失 | ❌ 版本卡在 SCANNING | ⚠️ 需手動修復 | 需運維介入 |

## 潛在問題和風險

### 🔴 高風險問題

#### 1. 版本狀態卡死

**場景**：如果 Redis Stream 消費者未啟動，或訊息丟失

**影響**：版本永遠停留在 `SCANNING` 狀態

**後果**：使用者無法繼續發布，需要運維手動修復資料庫

**排查方法**：
```sql
-- 查詢卡在 SCANNING 狀態超過 10 分鐘的版本
SELECT id, skill_id, version, status, created_at
FROM skill_versions
WHERE status = 'SCANNING'
  AND created_at < NOW() - INTERVAL 10 MINUTE;
```

#### 2. 臨時檔案洩漏

**場景**：如果 `markFailed()` 或 `markCompleted()` 未執行

**影響**：`/tmp/skillhub-scans/` 目錄持續增長

**後果**：磁碟空間耗盡

**排查方法**：
```bash
# 檢查臨時檔案目錄大小
du -sh /tmp/skillhub-scans/

# 查詢超過 1 小時的臨時檔案
find /tmp/skillhub-scans/ -type f -mmin +60
```

### 🟡 中風險問題

#### 3. 重試風暴

**場景**：Scanner 持續返回 5xx 錯誤

**影響**：大量重試請求打滿 Scanner 服務

**後果**：Scanner 雪崩，影響其他技能包掃描

#### 4. 稽核佇列堆積

**場景**：Scanner 長期不可用，所有掃描失敗

**影響**：所有技能包都降級到人工稽核

**後果**：稽核員工作量激增

## 當前實現的優缺點

### ✅ 優點

- 有基本的錯誤處理和降級機制
- 失敗後自動建立人工稽核任務
- 有重試機制（最多 3 次）
- 會清理臨時檔案

### ❌ 不足

- 缺少熔斷器，可能導致雪崩
- 缺少超時監控，版本可能卡死
- 缺少健康檢查端點
- 缺少詳細的錯誤日誌和指標

## 相關檔案

- [運維監控指南](./monitoring-guide.md)
- [改進建議](./improvement-recommendations.md)
- [配置說明](./configuration.md)
