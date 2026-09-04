# Scanner 配置說明

## 概述

本檔案詳細說明 SkillHub Scanner 的所有配置項，包括基礎配置、分析器配置、策略配置和運維配置。

## 配置檔案位置

- **開發環境**：`server/skillhub-app/src/main/resources/application-local.yml`
- **測試環境**：`server/skillhub-app/src/main/resources/application-test.yml`
- **生產環境**：`server/skillhub-app/src/main/resources/application.yml`
- **Kubernetes**：`deploy/k8s/configmap.yaml` 和 `deploy/k8s/secret.yaml`

## 完整配置示例

```yaml
skillhub:
  security:
    scanner:
      # 基礎配置
      enabled: ${SKILLHUB_SECURITY_SCANNER_ENABLED:true}
      base-url: ${SKILLHUB_SECURITY_SCANNER_URL:http://localhost:8000}
      mode: ${SKILLHUB_SECURITY_SCANNER_MODE:local}
      read-timeout-ms: ${SKILLHUB_SECURITY_SCANNER_READ_TIMEOUT:900000}

      # 分析器配置
      analyzers:
        behavioral: ${SKILLHUB_SCANNER_USE_BEHAVIORAL:false}
        llm: ${SKILLHUB_SCANNER_USE_LLM:false}
        llm-provider: ${SKILLHUB_SCANNER_LLM_PROVIDER:anthropic}
        llm-consensus-runs: ${SKILLHUB_SCANNER_LLM_CONSENSUS_RUNS:3}
        meta: ${SKILLHUB_SCANNER_USE_META:true}
        ai-defense: ${SKILLHUB_SCANNER_USE_AI_DEFENSE:false}
        ai-defense-api-key: ${SKILLHUB_SCANNER_AI_DEFENSE_API_KEY:}
        virus-total: ${SKILLHUB_SCANNER_USE_VIRUS_TOTAL:false}
        trigger: ${SKILLHUB_SCANNER_USE_TRIGGER:false}

      # 策略配置
      policy:
        preset: ${SKILLHUB_SCANNER_POLICY_PRESET:balanced}
        custom-policy-path: ${SKILLHUB_SCANNER_CUSTOM_POLICY_PATH:}
        fail-on-severity: ${SKILLHUB_SCANNER_FAIL_ON_SEVERITY:high}

    stream:
      # Keep this greater than scanner.read-timeout-ms.
      reclaim-min-idle: ${SKILLHUB_SCAN_STREAM_RECLAIM_MIN_IDLE:PT16M}
```

## 配置項詳解

### 1. 基礎配置

#### `enabled`

- **型別**：Boolean
- **預設值**：`true`
- **環境變數**：`SKILLHUB_SECURITY_SCANNER_ENABLED`
- **說明**：是否啟用安全掃描功能
- **影響**：
  - `true`：技能包發布時會觸發安全掃描
  - `false`：僅允許 `PRIVATE` 技能跳過掃描；`PUBLIC` / `NAMESPACE_ONLY` 發布會失敗並提示必須啟用 Scanner

**示例**：

```yaml
# 僅本地私有技能除錯：禁用掃描
enabled: false

# 公共或名稱空間可見發布：啟用掃描
enabled: true
```

---

#### `base-url`

- **型別**：String (URL)
- **預設值**：`http://localhost:8000`
- **環境變數**：`SKILLHUB_SECURITY_SCANNER_URL`
- **說明**：Scanner 服務的基礎 URL
- **格式**：`http(s)://host:port`

**示例**：

```yaml
# 本地開發
base-url: http://localhost:8000

# Kubernetes 內部服務
base-url: http://skill-scanner:8000

# 外部服務
base-url: https://scanner.example.com
```

---

#### `mode`

- **型別**：String (Enum)
- **可選值**：`local` | `upload`
- **預設值**：`local`
- **環境變數**：`SKILLHUB_SECURITY_SCANNER_MODE`
- **說明**：掃描模式
  - `local`：Scanner 直接訪問本地檔案系統（適用於 Scanner 和 SkillHub 在同一主機）
  - `upload`：透過 HTTP 上傳 ZIP 檔案（適用於 Scanner 和 SkillHub 分離部署）

**示例**：

```yaml
# Docker Compose 環境（Scanner 獨立容器，無共享發布目錄）
mode: upload

# Kubernetes 環境（獨立 Pod）
mode: upload
```

#### 掃描超時與併發

- `SKILLHUB_SECURITY_SCANNER_READ_TIMEOUT`：服務端等待單次掃描的毫秒數，預設 15 分鐘。
- `SKILLHUB_SCAN_STREAM_RECLAIM_MIN_IDLE`：未確認任務允許被恢復的等待時間，應大於掃描超時，預設 16 分鐘。
- `SKILLHUB_SCANNER_MAX_CONCURRENT_SCANS`：Scanner 容器內的最大併發掃描數，預設 `1`；超出的請求返回 HTTP 503，由待處理訊息稍後重試。
- `SKILLHUB_SCANNER_HARD_TIMEOUT_SECONDS`：Scanner 單次工作的硬上限，預設 930 秒。超時後程式以狀態碼 `124` 退出，由 Compose/Kubernetes 重啟；預設關係為服務端等待 900 秒 < Scanner 硬上限 930 秒 < Redis 恢復等待 960 秒。程式退出會使同容器內其他掃描稍後重試，因此建議保持預設併發數 `1`。

Scanner 超時或暫時不可用（包括 429、5xx）時，版本不會進入 `SCAN_FAILED`。任務保留為待處理，版本保持 `SCANNING`，待 Scanner 恢復後自動繼續。確定性的 4xx 包校驗錯誤仍採用有限次數重試，最終可以進入 `SCAN_FAILED`。某個包若穩定觸發 Scanner 內部 500，會保持 `SCANNING` 等待 Scanner 修復，而不會被誤判為包本身不合格。

---

### 2. 分析器配置

#### `analyzers.behavioral`

- **型別**：Boolean
- **預設值**：`false`
- **環境變數**：`SKILLHUB_SCANNER_USE_BEHAVIORAL`
- **說明**：是否啟用行為分析引擎
- **功能**：檢測可疑的執行時行為（如檔案系統訪問、網路請求等）

---

#### `analyzers.llm`

- **型別**：Boolean
- **預設值**：`false`
- **環境變數**：`SKILLHUB_SCANNER_USE_LLM`
- **說明**：是否啟用 LLM 分析引擎
- **功能**：使用大語言模型進行程式碼語義分析
- **依賴**：需要配置 `llm-provider`

---

#### `analyzers.llm-provider`

- **型別**：String (Enum)
- **可選值**：`anthropic` | `openai` | `azure`
- **預設值**：`anthropic`
- **環境變數**：`SKILLHUB_SCANNER_LLM_PROVIDER`
- **說明**：LLM 提供商
- **依賴**：需要在 Scanner 服務中配置對應的 API Key

**示例**：

```yaml
# 使用 Anthropic Claude
llm-provider: anthropic

# 使用 OpenAI GPT
llm-provider: openai

# 使用 Azure OpenAI
llm-provider: azure
```

---

#### `analyzers.llm-consensus-runs`

- **型別**：Integer
- **預設值**：`3`
- **範圍**：`1-10`
- **環境變數**：`SKILLHUB_SCANNER_LLM_CONSENSUS_RUNS`
- **說明**：LLM 共識執行次數（多次執行取共識結果，提高準確性）
- **效能影響**：值越大，掃描時間越長，但準確性越高

---

#### `analyzers.meta`

- **型別**：Boolean
- **預設值**：`true`
- **環境變數**：`SKILLHUB_SCANNER_USE_META`
- **說明**：是否啟用後設資料分析引擎
- **功能**：檢查 package.json、依賴版本、許可證等後設資料

---

#### `analyzers.ai-defense`

- **型別**：Boolean
- **預設值**：`false`
- **環境變數**：`SKILLHUB_SCANNER_USE_AI_DEFENSE`
- **說明**：是否啟用 AI Defense 引擎
- **功能**：使用 AI Defense API 進行高階威脅檢測
- **依賴**：需要配置 `ai-defense-api-key`

---

#### `analyzers.ai-defense-api-key`

- **型別**：String (Secret)
- **預設值**：空字串
- **環境變數**：`SKILLHUB_SCANNER_AI_DEFENSE_API_KEY`
- **說明**：AI Defense API Key
- **安全**：應透過 Kubernetes Secret 或環境變數注入，不要硬編碼

---

#### `analyzers.virus-total`

- **型別**：Boolean
- **預設值**：`false`
- **環境變數**：`SKILLHUB_SCANNER_USE_VIRUS_TOTAL`
- **說明**：是否啟用 VirusTotal 引擎
- **功能**：使用 VirusTotal API 檢測已知惡意檔案

---

#### `analyzers.trigger`

- **型別**：Boolean
- **預設值**：`false`
- **環境變數**：`SKILLHUB_SCANNER_USE_TRIGGER`
- **說明**：是否啟用觸發器分析引擎
- **功能**：檢測可疑的觸發器模式（如定時任務、事件監聽等）

---

### 3. 策略配置

#### `policy.preset`

- **型別**：String (Enum)
- **可選值**：`strict` | `balanced` | `permissive`
- **預設值**：`balanced`
- **環境變數**：`SKILLHUB_SCANNER_POLICY_PRESET`
- **說明**：安全策略預設
  - `strict`：嚴格模式，任何可疑行為都會標記為不安全
  - `balanced`：平衡模式，只標記高風險行為
  - `permissive`：寬鬆模式，只標記明確的惡意行為

**示例**：

```yaml
# 生產環境：使用嚴格模式
preset: strict

# 開發環境：使用寬鬆模式
preset: permissive
```

---

#### `policy.custom-policy-path`

- **型別**：String (File Path)
- **預設值**：空字串
- **環境變數**：`SKILLHUB_SCANNER_CUSTOM_POLICY_PATH`
- **說明**：自定義策略檔案路徑（覆蓋 preset）
- **格式**：YAML 檔案

**示例**：

```yaml
# 使用自定義策略
custom-policy-path: /etc/skillhub/scanner-policy.yaml
```

---

#### `policy.fail-on-severity`

- **型別**：String (Enum)
- **可選值**：`critical` | `high` | `medium` | `low`
- **預設值**：`high`
- **環境變數**：`SKILLHUB_SCANNER_FAIL_ON_SEVERITY`
- **說明**：掃描失敗的嚴重級別門檻
  - `critical`：只有發現 critical 級別的問題才標記為不安全
  - `high`：發現 high 或 critical 級別的問題標記為不安全
  - `medium`：發現 medium、high 或 critical 級別的問題標記為不安全
  - `low`：發現任何級別的問題都標記為不安全

**示例**：

```yaml
# 生產環境：high 及以上標記為不安全
fail-on-severity: high

# 測試環境：只有 critical 標記為不安全
fail-on-severity: critical
```

---

## 環境變數配置

### Docker Compose

```yaml
# docker-compose.yml
services:
  skillhub-backend:
    environment:
      - SKILLHUB_SECURITY_SCANNER_ENABLED=true
      - SKILLHUB_SECURITY_SCANNER_URL=http://skill-scanner:8000
      - SKILLHUB_SECURITY_SCANNER_MODE=upload
      - SKILLHUB_SCANNER_USE_BEHAVIORAL=false
      - SKILLHUB_SCANNER_USE_LLM=false
      - SKILLHUB_SCANNER_USE_META=true
      - SKILLHUB_SCANNER_POLICY_PRESET=balanced
      - SKILLHUB_SCANNER_FAIL_ON_SEVERITY=high
```

### Kubernetes ConfigMap

```yaml
# deploy/k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: skillhub-config
data:
  SKILLHUB_SECURITY_SCANNER_ENABLED: "true"
  SKILLHUB_SECURITY_SCANNER_URL: "http://skill-scanner:8000"
  SKILLHUB_SECURITY_SCANNER_MODE: "upload"
  SKILLHUB_SCANNER_USE_BEHAVIORAL: "false"
  SKILLHUB_SCANNER_USE_LLM: "false"
  SKILLHUB_SCANNER_USE_META: "true"
  SKILLHUB_SCANNER_POLICY_PRESET: "balanced"
  SKILLHUB_SCANNER_FAIL_ON_SEVERITY: "high"
```

### Kubernetes Secret

```yaml
# deploy/k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: skillhub-secrets
type: Opaque
stringData:
  SKILLHUB_SCANNER_AI_DEFENSE_API_KEY: "your-api-key-here"
```

---

## 配置最佳實踐

### 1. 開發環境配置

```yaml
skillhub:
  security:
    scanner:
      enabled: true  # 預設啟用；PUBLIC/NAMESPACE_ONLY 發布依賴掃描
      base-url: http://localhost:8000
      mode: upload
      analyzers:
        meta: true  # 只啟用後設資料分析
      policy:
        preset: permissive  # 使用寬鬆策略
        fail-on-severity: critical
```

### 2. 測試環境配置

```yaml
skillhub:
  security:
    scanner:
      enabled: true  # 測試環境啟用掃描
      base-url: http://skill-scanner:8000
      mode: upload
      analyzers:
        behavioral: true
        meta: true
        llm: false  # LLM 分析較慢，測試環境可選
      policy:
        preset: balanced
        fail-on-severity: high
```

### 3. 生產環境配置

```yaml
skillhub:
  security:
    scanner:
      enabled: true  # 生產環境必須啟用掃描
      base-url: http://skill-scanner:8000
      mode: upload  # 使用上傳模式，更安全
      analyzers:
        behavioral: true
        llm: true  # 啟用 LLM 分析，提高準確性
        llm-provider: anthropic
        llm-consensus-runs: 3
        meta: true
        ai-defense: true  # 啟用高階威脅檢測
        virus-total: true
        trigger: true
      policy:
        preset: strict  # 使用嚴格策略
        fail-on-severity: high
```

---

## 效能調優

### 掃描速度 vs 準確性

| 配置 | 掃描時間 | 準確性 | 適用場景 |
|-----|---------|-------|---------|
| 只啟用 meta | ~5 秒 | 低 | 開發環境 |
| meta + behavioral | ~15 秒 | 中 | 測試環境 |
| meta + behavioral + llm | ~60 秒 | 高 | 生產環境 |
| 全部啟用 | ~120 秒 | 最高 | 高安全要求 |

### 推薦配置

```yaml
# 快速掃描（開發環境）
analyzers:
  meta: true

# 標準掃描（測試環境）
analyzers:
  behavioral: true
  meta: true

# 深度掃描（生產環境）
analyzers:
  behavioral: true
  llm: true
  meta: true
  ai-defense: true
```

---

## 故障排查

### 問題 1：Scanner 連線失敗

**檢查配置**：

```bash
# 檢查 base-url 是否正確
curl -f $SKILLHUB_SECURITY_SCANNER_URL/health

# 檢查網路連通性
ping skill-scanner
```

### 問題 2：掃描超時

**調整配置**：

```yaml
# 減少 LLM 共識執行次數
analyzers:
  llm-consensus-runs: 1  # 從 3 降到 1

# 或禁用 LLM 分析
analyzers:
  llm: false
```

### 問題 3：掃描失敗率高

**調整策略**：

```yaml
# 降低嚴重級別門檻
policy:
  fail-on-severity: critical  # 從 high 改為 critical

# 或使用寬鬆策略
policy:
  preset: permissive  # 從 strict 改為 permissive
```

---

## 相關檔案

- [故障影響分析](./failure-impact-analysis.md)
- [運維監控指南](./monitoring-guide.md)
- [改進建議](./improvement-recommendations.md)
- [Scanner 服務檔案](../README.md)
