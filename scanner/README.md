# Skill Scanner

本目錄提供 Cisco skill-scanner 的本地 Docker 構建上下文，用於 `make dev-all` 開發流程。

開發流程會將 `cisco-ai-skill-scanner` 構建到本地容器中，並在 `http://localhost:8000` 上暴露服務。

## 快速開始

### 環境變數

Scanner 服務的可選環境變數：

- `SKILL_SCANNER_LLM_API_KEY` - LLM API 金鑰
- `SKILL_SCANNER_LLM_BASE_URL` - LLM API 基礎 URL
- `SKILL_SCANNER_LLM_MODEL` - LLM 模型名稱

### 啟動服務

```bash
# 啟動所有服務（包括 Scanner）
make dev-all

# 檢查 Scanner 服務狀態
curl http://localhost:8000/health
```

## 檔案

- **[配置說明](./docs/configuration.md)** - 詳細的配置項說明和最佳實踐
- **[故障影響分析](./docs/failure-impact-analysis.md)** - Scanner 介面故障時的影響分析
- **[運維監控指南](./docs/monitoring-guide.md)** - 監控指標、告警規則和故障排查
- **[改進建議](./docs/improvement-recommendations.md)** - 系統改進建議（待實施）

## 架構說明

Scanner 服務與 SkillHub 的整合架構：

```
SkillHub Backend
    ↓
SecurityScanService.triggerScan()
    ↓
Redis Stream (skillhub:scan:requests)
    ↓
ScanTaskConsumer
    ↓
SkillScannerAdapter
    ↓
SkillScannerService (HTTP Client)
    ↓
Cisco skill-scanner API
```

## 相關配置

SkillHub 後端的 Scanner 配置位於：

- `server/skillhub-app/src/main/resources/application.yml`
- `deploy/k8s/configmap.yaml`
- `deploy/k8s/secret.yaml`

詳見 [配置說明](./docs/configuration.md)。
