# 快速開始

## 一鍵部署

使用 curl 命令快速部署 SkillHub（包含所有服務：Web UI、Backend API、PostgreSQL、Redis、MinIO、Skill Scanner）：

```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up
```

**國內使用者（阿里雲映象）：**
```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --aliyun
```

**自定義引數**：
```bash
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up \
  --version v0.2.0 \
  --home /opt/skillhub \
  --aliyun
```

**引數說明**：
| 引數 | 說明 | 示例 |
|------|------|------|
| `--version <tag>` | 指定版本 | `--version v0.2.0` |
| `--aliyun` | 使用阿里雲映象（國內推薦） | `--aliyun` |
| `--home <dir>` | 指定安裝目錄 | `--home /opt/skillhub` |
| `--no-scanner` | 禁用安全掃描服務 | `--no-scanner` |
| `--mirror-registry <url>` | 自定義映象倉庫 | `--mirror-registry registry.example.com` |

**其他命令**：
```bash
# 停止服務
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- down

# 檢視服務狀態
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- ps

# 檢視日誌
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- logs

# 清理所有資料
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- clean
```

部署成功後訪問：
- **Web UI**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API 檔案**: http://localhost:8080/swagger-ui.html
- **Skill Scanner**: http://localhost:8000

## 本地開發

如果需要從原始碼啟動開發環境：

```bash
# 克隆倉庫
git clone https://github.com/iflytek/skillhub.git
cd skillhub

# 啟動所有服務（包含 Scanner）
make dev-all
```

### 國內開發者注意事項

如果 `make dev-all` 後端啟動失敗，常見原因：

1. **Maven 依賴下載超時**

   專案已內建阿里雲映象配置（`server/.mvn/settings.xml`），但 Maven 不會自動讀取專案級配置。需要手動配置：

   ```bash
   # 方式一：複製到使用者目錄（推薦）
   mkdir -p ~/.m2
   cp server/.mvn/settings.xml ~/.m2/settings.xml

   # 方式二：每次構建時指定
   cd server && ./mvnw -s .mvn/settings.xml package
   ```

2. **Java 版本不匹配**

   SkillHub 要求 Java 21+：
   ```bash
   java -version
   ```

3. **埠衝突**

   檢查 8080 埠是否被佔用：
   ```bash
   lsof -i :8080
   ```

詳細的錯誤排查步驟，請檢視 [常見問題](faq.md#本地開發啟動失敗)。

## 登入系統

### 方式一：使用內建管理員賬號

SkillHub 內建了一個超級管理員賬號，可以直接登入：

- **使用者名稱**：`admin`
- **密碼**：`ChangeMe!2026`

> **安全提示**：生產環境部署後，請立即修改預設密碼。

### 方式二：註冊新賬號

訪問 http://localhost:3000/register 註冊新賬號。

### 方式三：使用 Mock 使用者（僅本地開發）

本地開發時，可以使用 Mock 使用者頭快速登入：

```bash
# 普通使用者
curl -H "X-Mock-User-Id: local-user" http://localhost:8080/api/v1/auth/me

# 超級管理員
curl -H "X-Mock-User-Id: local-admin" http://localhost:8080/api/v1/auth/me
```

在瀏覽器中，可以透過瀏覽器外掛（如 ModHeader）新增 `X-Mock-User-Id` 請求頭。

## 安裝 CLI 工具

推薦使用第一方 SkillHub CLI 管理技能包：

```bash
# 安裝並配置 SkillHub 註冊中心地址
npm install -g @astron-team/skillhub
export SKILLHUB_REGISTRY=http://localhost:8080

# 搜尋技能包
skillhub search email

# 安裝技能包
skillhub install my-skill

# 發布技能包
skillhub publish ./my-skill --namespace my-team
```

已有 ClawHub 工作流仍可透過相容層進行搜尋和安裝；新流程及發布操作優先使用 SkillHub CLI。

## 發布第一個技能包

### 使用 CLI 工具發布（推薦）

1. **準備技能包**

建立一個簡單的技能包目錄：

```
my-skill/
├── skill.md          # 技能描述
├── package.json      # 後設資料
└── scripts/          # 指令碼檔案
    └── main.py
```

2. **使用 CLI 發布**

```bash
# 配置註冊中心
export SKILLHUB_REGISTRY=http://localhost:8080

# 發布到指定名稱空間
skillhub publish ./my-skill --namespace my-team
```

3. **等待安全掃描**

發布後，Skill Scanner 會自動掃描技能包，檢測潛在的安全問題：
- 惡意程式碼檢測
- 敏感資訊洩露
- 依賴漏洞掃描
- 行為分析

掃描結果會顯示在技能包詳情頁。

4. **等待稽核**（如果名稱空間開啟了稽核）

管理員會收到通知，稽核透過後技能包正式發布。

### 使用 Web UI 發布

1. 訪問 http://localhost:3000/dashboard/publish
2. 選擇名稱空間（如果沒有，先建立一個）
3. 上傳 zip 檔案
4. 選擇可見性（PUBLIC / PRIVATE / INTERNAL）
5. 點選「發布」

## 搜尋和下載技能包

### 使用 CLI 工具

```bash
# 搜尋技能包
skillhub search pdf

# 安裝技能包
skillhub install pdf-parser

# 安裝指定名稱空間的技能包
skillhub install pdf-parser --namespace my-team
```

### 使用 Web UI

1. 訪問 http://localhost:3000/search
2. 輸入關鍵詞搜尋
3. 點選技能包檢視詳情
4. 點選「下載」或複製安裝命令

## 升級 SkillHub

使用 curl 命令升級到最新版本：

```bash
# 升級到最新版本
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- pull
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- down
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up

# 升級到指定版本
curl -fsSL https://imageless.oss-cn-beijing.aliyuncs.com/runtime.sh | sh -s -- up --version v0.2.0
```

> **注意**：升級前建議備份資料庫和物件儲存。
