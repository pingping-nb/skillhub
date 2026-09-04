# 自定義靜態分析規則

## 概述

Cisco skill-scanner 的靜態分析引擎包含兩種規則型別：

- **Regex 規則**（`signatures.yaml`）：基於正規表示式的模式匹配，按行掃描
- **YARA 規則**（`*.yara`）：基於 YARA 引擎的多模式匹配，支援跨行和組合條件

兩種規則都打包在 `cisco-ai-skill-scanner` 的 Python 包內部，**Scanner HTTP API 不提供執行時載入外部規則的介面**。要注入自定義規則，需要在 Docker 構建或啟動階段覆蓋包內檔案。

## 包內規則路徑

```
/usr/local/lib/python3.11/site-packages/skill_scanner/
├── data/
│   ├── rules/
│   │   └── signatures.yaml          # Regex 規則定義
│   └── yara_rules/
│       ├── code_execution_generic.yara
│       ├── command_injection_generic.yara
│       ├── credential_harvesting_generic.yara
│       ├── prompt_injection_generic.yara
│       ├── ... （共 13 個 .yara 檔案）
│       └── tool_chaining_abuse_generic.yara
└── core/
    └── rules/
        ├── patterns.py               # RuleLoader - 載入 signatures.yaml
        └── yara_scanner.py           # YaraScanner - 載入 *.yara 檔案
```

**載入邏輯**：
- `RuleLoader` 讀取 `data/rules/signatures.yaml`，逐條編譯正規表示式
- `YaraScanner` 讀取 `data/yara_rules/` 目錄下所有 `.yara` 檔案，編譯為 YARA 規則集

兩個載入器都支援透過建構函式傳入自定義路徑，但 HTTP API 層沒有暴露此引數。

---

## 注入自定義規則的方式

### 方案 A：Docker 卷掛載（開發環境推薦）

在 `docker-compose.yml` 中將本地規則目錄掛載到容器內，覆蓋包內檔案：

```yaml
# docker-compose.yml
services:
  skill-scanner:
    build: ./scanner
    ports:
      - "8000:8000"
    volumes:
      # 追加自定義 Regex 規則（覆蓋原有 signatures.yaml）
      - ./scanner/rules/signatures.yaml:/usr/local/lib/python3.11/site-packages/skill_scanner/data/rules/signatures.yaml:ro
      # 追加自定義 YARA 規則（覆蓋整個 yara_rules 目錄）
      - ./scanner/rules/yara/:/usr/local/lib/python3.11/site-packages/skill_scanner/data/yara_rules/:ro
```

**優點**：改規則後重啟容器即可生效，不需要重新構建映象

**缺點**：升級 scanner 版本時，官方新增的規則不會自動包含進來，需要手動合併

### 方案 B：Dockerfile COPY（生產環境推薦）

在 Dockerfile 構建階段把自定義規則 COPY 進映象：

```dockerfile
FROM python:3.11-alpine

WORKDIR /app

RUN apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev && \
    pip install --no-cache-dir cisco-ai-skill-scanner && \
    apk del .build-deps && \
    addgroup -S app && \
    adduser -S app -G app && \
    mkdir -p /tmp/skillhub-scans && \
    chown app:app /tmp/skillhub-scans

# 覆蓋 Regex 規則
COPY rules/signatures.yaml /usr/local/lib/python3.11/site-packages/skill_scanner/data/rules/signatures.yaml

# 覆蓋 YARA 規則目錄
COPY rules/yara/ /usr/local/lib/python3.11/site-packages/skill_scanner/data/yara_rules/

USER app

EXPOSE 8000

CMD ["skill-scanner-api", "--host", "0.0.0.0", "--port", "8000"]
```

**優點**：規則隨映象版本管理，可追溯、可回滾

**缺點**：每次改規則都需要重新構建映象

### 方案 C：追加而非覆蓋（保留官方規則 + 自定義擴充套件）

如果希望保留官方規則並追加自定義規則：

**Regex 規則**：將官方 `signatures.yaml` 的內容複製出來，在末尾追加自定義規則後整體覆蓋。

**YARA 規則**：官方的每個 `.yara` 檔案是獨立的，只需把自定義 `.yara` 檔案放入同一目錄即可。YARA 載入器會自動掃描目錄下所有 `.yara` 檔案。

推薦的目錄結構：

```
scanner/
├── Dockerfile
├── rules/
│   ├── signatures.yaml          # 完整的 Regex 規則（官方 + 自定義）
│   └── yara/
│       ├── code_execution_generic.yara          # 官方規則（保留）
│       ├── command_injection_generic.yara        # 官方規則（保留）
│       ├── credential_harvesting_generic.yara    # 官方規則（保留）
│       ├── ...                                   # 其他官方規則
│       └── skillhub_custom.yara                  # ← 自定義 YARA 規則
└── README.md
```

---

## Regex 規則定義方法（signatures.yaml）

### 格式

```yaml
- id: RULE_UNIQUE_ID           # 唯一識別符號，大寫下劃線命名
  category: <threat_category>  # 威脅分類（見下方列舉）
  severity: <severity_level>   # 嚴重級別（見下方列舉）
  patterns:                    # 正規表示式列表（匹配任一即觸發）
    - "regex_pattern_1"
    - "regex_pattern_2"
  exclude_patterns:            # 排除模式（可選，匹配則跳過）
    - "safe_pattern"
  file_types:                  # 適用的檔案型別（見下方列舉）
    - python
    - bash
  description: "規則描述"      # 檢測到時顯示的說明
  remediation: "修復建議"      # 建議的修復方式
```

### 可用的 category 值

| category | 說明 |
|----------|------|
| `prompt_injection` | Prompt 注入和指令覆蓋 |
| `command_injection` | 命令和程式碼注入 |
| `data_exfiltration` | 資料洩露和隱私違規 |
| `unauthorized_tool_use` | 未授權工具和許可權濫用 |
| `obfuscation` | 程式碼混淆和惡意軟體指標 |
| `hardcoded_secrets` | 硬編碼金鑰和憑證洩露 |
| `social_engineering` | 社會工程和誤導性後設資料 |
| `resource_abuse` | 資源濫用和拒絕服務 |
| `policy_violation` | 策略違規 |

### 可用的 severity 值

| severity | 說明 |
|----------|------|
| `CRITICAL` | 嚴重 — 明確的惡意行為 |
| `HIGH` | 高危 — 高風險安全問題 |
| `MEDIUM` | 中危 — 需要關注的可疑行為 |
| `LOW` | 低危 — 輕微問題或建議 |
| `INFO` | 資訊 — 僅供參考 |

### 可用的 file_types 值

| file_types | 匹配的副檔名 |
|------------|-----------------|
| `python` | `.py` |
| `bash` | `.sh`, `.bash`, `.zsh` |
| `markdown` | `.md` |
| `manifest` | `SKILL.md`（僅掃描 frontmatter） |
| `binary` | 二進位制檔案 |

### 示例：自定義 Regex 規則

```yaml
# ============================================================================
# 自定義規則：SkillHub 特定檢測
# ============================================================================

# 檢測使用 SkillHub 內部 API 的可疑行為
- id: SKILLHUB_INTERNAL_API_ACCESS
  category: data_exfiltration
  severity: HIGH
  patterns:
    - "skillhub\\.internal"
    - "/api/v1/admin"
    - "X-Internal-Token"
  file_types: [python, bash]
  description: "Skill attempts to access SkillHub internal APIs"
  remediation: "Skills should not access internal management APIs"

# 檢測試圖修改其他技能包的行為
- id: SKILLHUB_SKILL_TAMPERING
  category: unauthorized_tool_use
  severity: CRITICAL
  patterns:
    - "skillhub[_-]storage"
    - "/tmp/skillhub-scans"
    - "skill_versions.*UPDATE"
  file_types: [python, bash]
  description: "Skill attempts to tamper with SkillHub storage or other skills"
  remediation: "Remove code that accesses SkillHub internal storage"

# 檢測過大的依賴安裝
- id: SKILLHUB_EXCESSIVE_DEPS
  category: resource_abuse
  severity: MEDIUM
  patterns:
    - "pip install .{200,}"
    - "requirements\\.txt.*\\n.*torch"
    - "pip install.*tensorflow"
  exclude_patterns:
    - "# optional"
    - "# dev only"
  file_types: [python, bash]
  description: "Skill installs very large dependencies that may abuse resources"
  remediation: "Use lightweight alternatives or document why large dependencies are needed"
```

### 正規表示式語法說明

- 使用 Python `re` 模組語法
- `(?i)` — 不區分大小寫
- `\\b` — 單詞邊界
- `(?<!...)` — 反向否定前瞻，如 `(?<!re\\.)\\bcompile` 匹配 `compile()` 但排除 `re.compile()`
- `[^)]*` — 匹配括號內的任意內容
- 每條 pattern 獨立匹配，命中任意一條即觸發該規則

---

## YARA 規則定義方法

### 格式

```yara
rule rule_name {

    meta:
        author = "YourTeam"
        description = "規則描述"
        classification = "harmful"     // harmful | suspicious | info
        threat_type = "THREAT TYPE"    // 大寫，用於分類展示

    strings:
        // 定義要匹配的字串模式
        $pattern_name = /正規表示式/i   // 正則（i=不區分大小寫）
        $literal_str = "固定字串"     // 精確匹配
        $hex_pattern = { 48 65 6C 6C }  // 十六進位制匹配

        // 排除模式
        $safe_pattern = /安全模式/

    condition:
        // 布林邏輯組合
        not $safe_pattern and
        (
            $pattern_name or
            ($literal_str and $hex_pattern)
        )
}
```

### meta 欄位說明

| 欄位 | 必填 | 說明 |
|------|------|------|
| `author` | 是 | 規則作者 |
| `description` | 是 | 規則描述，檢測到時顯示 |
| `classification` | 是 | `harmful`（有害）、`suspicious`（可疑）、`info`（資訊） |
| `threat_type` | 是 | 威脅型別標籤（大寫），如 `CODE EXECUTION`、`CREDENTIAL HARVESTING` |

### strings 模式型別

```yara
strings:
    // 1. 正規表示式（最常用）
    $regex = /pattern/i                 // i = 不區分大小寫
    $regex2 = /multi\nline/s            // s = 跨行匹配

    // 2. 精確字串
    $text = "exact match"               // 區分大小寫
    $nocase = "match" nocase            // 不區分大小寫
    $wide = "match" wide                // 寬字元（UTF-16）

    // 3. 十六進位制模式
    $hex = { E8 ?? ?? ?? FF }           // ?? = 萬用字元
    $hex2 = { E8 [2-4] FF }            // [2-4] = 2到4位元組通配
```

### condition 邏輯運算

```yara
condition:
    // 布林運算
    $a and $b                           // 同時匹配
    $a or $b                            // 匹配任一
    not $a                              // 不匹配
    ($a or $b) and not $c               // 組合

    // 計數
    #a > 3                              // $a 出現超過 3 次
    any of ($pattern*)                  // 任一 $pattern* 匹配
    all of ($required*)                 // 所有 $required* 都匹配
    2 of ($a, $b, $c)                   // 三個中匹配任意兩個

    // 檔案大小
    filesize < 1MB                      // 檔案小於 1MB
```

### 示例：自定義 YARA 規則

將以下內容儲存為 `scanner/rules/yara/skillhub_custom.yara`：

```yara
//////////////////////////////////////////
// SkillHub 自定義檢測規則
// 檢測針對 SkillHub 平臺的特定威脅
//////////////////////////////////////////

rule skillhub_namespace_abuse {

    meta:
        author = "SkillHub Security"
        description = "Detects attempts to manipulate SkillHub namespaces or escalate privileges"
        classification = "harmful"
        threat_type = "PRIVILEGE ESCALATION"

    strings:
        // 嘗試訪問其他名稱空間
        $ns_traversal = /namespace[_\-]?id\s*=\s*['\"][^'\"]+['\"]/i
        $ns_override = /X-Namespace-Override/i

        // 嘗試偽造身份
        $mock_user = /X-Mock-User-Id/i
        $admin_escalation = /role\s*=\s*['\"](admin|super_admin)['"]/i

        // 排除測試程式碼
        $test_file = /def\s+test_/
        $test_import = /import\s+pytest/

    condition:
        not $test_file and
        not $test_import and
        (
            $ns_traversal or
            $ns_override or
            $mock_user or
            $admin_escalation
        )
}

rule skillhub_scan_evasion {

    meta:
        author = "SkillHub Security"
        description = "Detects attempts to evade security scanning"
        classification = "harmful"
        threat_type = "SCAN EVASION"

    strings:
        // 檢測檔案在掃描後執行的延遲載入
        $delayed_import = /importlib\.import_module\s*\(\s*[a-z_]+\s*\)/i
        $dynamic_exec = /getattr\s*\(\s*__import__/i

        // 檢測條件性惡意程式碼（僅在非掃描環境執行）
        $env_check_scanner = /os\.environ\.get\s*\(\s*['"]SCANNER/i
        $env_check_sandbox = /os\.environ\.get\s*\(\s*['"]SANDBOX/i

        // 排除合法用途
        $legitimate_plugin = /plugin_loader|extension_manager/i

    condition:
        not $legitimate_plugin and
        (
            ($delayed_import and $env_check_scanner) or
            ($dynamic_exec and $env_check_sandbox) or
            ($delayed_import and $dynamic_exec)
        )
}
```

---

## 測試自定義規則

### 驗證 Regex 規則語法

```bash
# 在容器內驗證 signatures.yaml 能否被正確解析
docker exec skillhub-skill-scanner-1 python3 -c "
import yaml
with open('/usr/local/lib/python3.11/site-packages/skill_scanner/data/rules/signatures.yaml') as f:
    rules = yaml.safe_load(f)
print(f'Loaded {len(rules)} rules')
for r in rules:
    print(f\"  {r['id']} [{r['severity']}] {r['category']}\")
"
```

### 驗證 YARA 規則語法

```bash
# 在容器內驗證所有 .yara 檔案能否被編譯
docker exec skillhub-skill-scanner-1 python3 -c "
import yara
from pathlib import Path
rules_dir = Path('/usr/local/lib/python3.11/site-packages/skill_scanner/data/yara_rules')
for f in sorted(rules_dir.glob('*.yara')):
    try:
        yara.compile(filepath=str(f))
        print(f'  OK: {f.name}')
    except yara.SyntaxError as e:
        print(f'  FAIL: {f.name} -> {e}')
"
```

### 端到端測試

```bash
# 建立包含可疑程式碼的測試技能包
mkdir -p /tmp/test-custom-rule
cat > /tmp/test-custom-rule/SKILL.md << 'EOF'
---
name: test-custom
description: A test skill for custom rule validation
version: 1.0.0
---
This is a test.
EOF

cat > /tmp/test-custom-rule/main.py << 'EOF'
import os
# 這段程式碼應觸發自定義規則
mock_header = "X-Mock-User-Id: admin"
EOF

cd /tmp/test-custom-rule && zip -r /tmp/test-custom.zip .

# 提交掃描
curl -s -X POST http://localhost:8000/scan-upload \
  -F "file=@/tmp/test-custom.zip" | python3 -m json.tool
```

---

## 注意事項

1. **版本升級**：升級 `cisco-ai-skill-scanner` 時，官方規則會被覆蓋。使用方案 A（卷掛載）時需手動合併新規則；使用方案 B（Dockerfile COPY）時需在 Dockerfile 中重新 COPY。

2. **規則 ID 唯一性**：Regex 規則的 `id` 欄位必須全域性唯一。建議自定義規則使用 `SKILLHUB_` 字首避免與官方規則衝突。

3. **YARA 規則命名**：YARA 檔名作為 namespace，`rule` 名稱必須全域性唯一。建議自定義規則檔案使用 `skillhub_` 字首。

4. **效能影響**：正規表示式過於複雜或 YARA 規則過多會增加掃描時間。建議定期評估規則數量和掃描耗時。

5. **誤報管理**：新增規則後應用測試技能包驗證，關注 `exclude_patterns`（Regex）和 `condition` 中的排除邏輯（YARA），避免誤報。

---

## 相關檔案

- [配置說明](./configuration.md)
- [故障影響分析](./failure-impact-analysis.md)
- [運維監控指南](./monitoring-guide.md)
