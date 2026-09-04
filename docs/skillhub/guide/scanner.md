# Skill Scanner 安全掃描

## 功能描述

SkillHub 內建了 **Skill Scanner** 安全掃描服務，在技能包發布時自動檢測潛在的安全風險。這是保障企業內部技能包安全的重要防線。

每個技能包在發布後都會經過安全掃描，掃描結果會影響稽核決策，幫助管理員快速判斷技能包是否安全可靠。

**核心特性**：

- **自動觸發**：技能包發布後自動觸發安全掃描，無需手動操作
- **多引擎分析**：支援行為分析、LLM 分析、後設資料分析等多種引擎
- **策略可配**：內建 balanced 策略預設，支援自定義掃描策略
- **嚴重級別閾值**：可配置在哪個嚴重級別自動阻止發布
- **掃描報告**：詳細的掃描結果展示在技能包詳情頁

**分析引擎**：

| 引擎 | 說明 | 預設狀態 |
|------|------|----------|
| **後設資料分析** | 檢查包結構、檔案型別、大小等 | 啟用 |
| **行為分析** | 分析程式碼行為模式，檢測惡意操作 | 可選 |
| **LLM 分析** | 使用大模型分析程式碼安全性 | 可選 |
| **AI Defense** | Cisco AI Defense 整合 | 可選 |
| **VirusTotal** | VirusTotal 病毒掃描 | 可選 |

## 使用場景

**場景一：發布時自動掃描**

開發者發布技能包後，Scanner 自動在後臺執行掃描，無需額外操作。

**場景二：管理員檢視掃描報告**

管理員在稽核技能包時，可以檢視掃描報告，幫助做出稽核決策。

**場景三：自定義掃描策略**

企業管理員可以根據安全需求，配置掃描策略和嚴重級別閾值。

## 工作流程

```
開發者發布技能包
    ↓
SkillHub 後端接收上傳
    ↓
觸發安全掃描（透過 Redis Stream）
    ↓
Skill Scanner 執行多引擎分析
    ↓
掃描結果寫入資料庫
    ↓
技能包詳情頁展示掃描報告
    ↓
管理員結合掃描結果進行稽核
```

## 配置說明

### 基礎配置

在 `.env` 檔案或環境變數中配置：

| 環境變數 | 說明 | 預設值 |
|----------|------|--------|
| `SKILLHUB_SECURITY_SCANNER_ENABLED` | 啟用安全掃描 | `true` |
| `SKILLHUB_SECURITY_SCANNER_URL` | Scanner 服務地址 | `http://localhost:8000` |
| `SKILLHUB_SECURITY_SCANNER_MODE` | 掃描模式（local / upload） | `local` |
| `SKILLHUB_SCANNER_POLICY_PRESET` | 策略預設 | `balanced` |
| `SKILLHUB_SCANNER_FAIL_ON_SEVERITY` | 自動阻止的嚴重級別 | `high` |

### LLM 分析配置（可選）

啟用 LLM 分析引擎可以提高安全檢測的準確性：

| 環境變數 | 說明 | 預設值 |
|----------|------|--------|
| `SKILLHUB_SCANNER_USE_LLM` | 啟用 LLM 分析 | `false` |
| `SKILLHUB_SCANNER_LLM_PROVIDER` | LLM 提供商（anthropic / openai / azure） | `anthropic` |
| `SKILL_SCANNER_LLM_API_KEY` | LLM API 金鑰 | - |
| `SKILL_SCANNER_LLM_BASE_URL` | 本地/自定義 LLM 服務地址 | - |
| `SKILL_SCANNER_LLM_MODEL` | LLM 模型名稱 | - |

### 部署說明

使用一鍵部署時，Scanner 服務預設啟用。如果不需要安全掃描，可以透過 `--no-scanner` 引數禁用：

```bash
# 部署時禁用 Scanner
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --no-scanner
```

## 注意事項

> **掃描不阻塞發布**：安全掃描是非同步執行的，不會阻塞技能包的上傳流程。掃描結果會在完成後更新到技能包詳情頁。

- **掃描耗時**：根據技能包大小和啟用的引擎數量，掃描可能需要幾秒到幾分鐘
- **LLM 分析成本**：啟用 LLM 分析會產生 API 呼叫費用，建議在生產環境中評估成本
- **策略調優**：`balanced` 策略適合大多數場景，企業可以根據安全需求自定義策略
- **健康檢查**：透過 `GET http://localhost:8000/health` 檢查 Scanner 服務狀態
