# Kubernetes 部署指南

本檔案說明如何在 Kubernetes 叢集中部署 SkillHub。

## 前置條件

- Kubernetes 叢集 (v1.24+)
- kubectl 已配置並連線到叢集
- nginx ingress controller 已安裝（可選，用於域名訪問）
- 預設 StorageClass 已配置（用於 PVC）

## 目錄結構

```
deploy/k8s/
├── base/                          # 基礎配置（所有場景共用）
│   ├── kustomization.yaml
│   ├── configmap.yaml
│   ├── secret.yaml.example
│   ├── services.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── scanner-deployment.yaml
│   └── ingress.yaml
│
└── overlays/
    ├── with-infra/                # 完整部署（包含內建資料庫）
    │   ├── kustomization.yaml
    │   ├── postgres-statefulset.yaml
    │   └── redis-statefulset.yaml
    │
    └── external/                  # 外部資料庫
        └── kustomization.yaml
```

## 快速開始

### 1. 建立名稱空間

```bash
kubectl create namespace skillhub
```

### 2. 配置 Secret

```bash
cd deploy/k8s/base

# 複製示例檔案
cp secret.yaml.example secret.yaml

# 編輯 secret.yaml，修改敏感配置
```

**Secret 配置項**：

| 鍵 | 說明 | 必填 |
|---|---|---|
| spring-datasource-url | PostgreSQL 連線 URL | 是 |
| spring-datasource-username | 資料庫使用者名稱 | 是 |
| spring-datasource-password | 資料庫密碼 | 是 |
| redis-password | Redis 資料節點密碼 | 否 |
| redis-sentinel-password | Redis Sentinel 獨立密碼 | 否 |
| bootstrap-admin-password | 管理員密碼 | 是 |
| oauth2-github-client-id | GitHub OAuth ID | 否 |
| oauth2-github-client-secret | GitHub OAuth 金鑰 | 否 |
| skill-scanner-llm-api-key | LLM API 金鑰 | 否 |
| skill-scanner-llm-base-url | 本地/自定義 LLM 服務地址 | 否 |
| skill-scanner-llm-model | Scanner 使用的 LLM 模型名 | 否 |

### 3. 選擇部署方式

**方式一：完整部署（包含 PostgreSQL + Redis）**

適合全新環境，自動部署資料庫：

```bash
kubectl apply -k overlays/with-infra/
```

**方式二：使用外部資料庫**

適合已有 PostgreSQL 和 Redis 的環境：

1. 修改 `base/configmap.yaml` 中的 Redis 配置：
```yaml
redis-host: your-redis-host
redis-port: "6379"
```

連線外部 Redis Cluster 時改為配置節點列表。保留 `redis-host`/`redis-port`
不會影響 Cluster 選擇：

```yaml
redis-cluster-nodes: "redis-0.example.com:6379,redis-1.example.com:6379,redis-2.example.com:6379"
redis-cluster-max-redirects: "5"
redis-username: "skillhub"
redis-ssl-enabled: "true"
redis-connect-timeout: "5s"
redis-timeout: "3s"
redis-client-name: "skillhub"
```

所有 Cluster 節點通告的地址都必須能從 Server Pod 訪問。Redis Cluster 只支援
資料庫 `0`。

連線外部 Redis Sentinel 時配置 master、節點和獨立 ACL；Sentinel 配置優先於
Cluster 和單機 host/port：

```yaml
redis-username: "skillhub"
redis-sentinel-master: "mymaster"
redis-sentinel-nodes: "sentinel-0.example.com:26379,sentinel-1.example.com:26379,sentinel-2.example.com:26379"
redis-sentinel-username: "sentinel-user"
redis-sentinel-check-list: "true"
```

2. 修改 `base/secret.yaml` 中的資料庫和 Redis 憑據：
```yaml
spring-datasource-url: jdbc:postgresql://your-postgres-host:5432/skillhub
redis-password: your-redis-password
redis-sentinel-password: your-sentinel-password
```

3. 部署：
```bash
kubectl apply -k overlays/external/
```

### 4. 驗證部署

```bash
# 檢查 Pod 狀態
kubectl get pods -n skillhub

# 等待所有 Pod 就緒
kubectl wait --for=condition=ready pod --all -n skillhub --timeout=300s
```

### 5. 訪問服務

**方式一：埠轉發（推薦本地測試）**

```bash
# 前端
kubectl port-forward svc/skillhub-web -n skillhub 8080:80

# 後端 API
kubectl port-forward svc/skillhub-server -n skillhub 8081:8080
```

訪問 http://localhost:8080

**方式二：Ingress 域名訪問**

修改 `base/ingress.yaml` 中的域名：
```yaml
spec:
  rules:
    - host: your-domain.com  # 修改為你的域名
```

```bash
kubectl apply -k overlays/with-infra/  # 或 overlays/external/
```

## 部署架構

```
┌─────────────────────────────────────────────────────────────┐
│                        skillhub namespace                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ skillhub-web│  │skillhub-    │  │ skillhub-scanner    │  │
│  │   (前端)    │  │  server     │  │    (掃描器)         │  │
│  │   :80       │  │  (後端)     │  │     :8000           │  │
│  └─────────────┘  │   :8080     │  └─────────────────────┘  │
│                   └──────┬──────┘                            │
│                          │                                   │
│         ┌────────────────┴────────────────┐                  │
│         │         with-infra only          │                 │
│         │  ┌─────────────┐  ┌───────────┐ │                 │
│         │  │  postgres-0 │  │  redis-0  │ │                 │
│         │  │   :5432     │  │   :6379   │ │                 │
│         │  └─────────────┘  └───────────┘ │                 │
│         └─────────────────────────────────┘                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              PersistentVolumeClaims                      │ │
│  │  - skillhub-storage-pvc (10Gi)                          │ │
│  │  - postgres-data-0 (10Gi) - with-infra only             │ │
│  │  - redis-data-0 (5Gi) - with-infra only                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 配置說明

### ConfigMap 配置項

| 鍵 | 預設值 | 說明 |
|---|---|---|
| redis-host | redis | Redis 主機地址 |
| redis-port | 6379 | Redis 埠 |
| redis-cluster-nodes | 未設定 | 外部 Redis Cluster 節點，逗號分隔的 `host:port` |
| redis-cluster-max-redirects | 未設定 | Cluster MOVED/ASK 最大重定向次數 |
| redis-sentinel-master | 未設定 | Sentinel master set 名稱 |
| redis-sentinel-nodes | 未設定 | Sentinel 節點，逗號分隔的 `host:port` |
| redis-sentinel-username | 未設定 | Sentinel ACL 使用者名稱 |
| redis-sentinel-check-list | true | 是否校驗 Sentinel 返回的節點列表 |
| redis-username | 未設定 | Redis ACL 使用者名稱 |
| redis-ssl-enabled | 未設定 | 是否使用 TLS |
| redis-connect-timeout | 未設定 | Redis 建連超時 |
| redis-timeout | 未設定 | Redis 命令超時 |
| redis-client-name | 未設定 | Redis 客戶端名稱 |
| storage-base-path | /var/lib/skillhub/storage | 技能儲存路徑 |
| skillhub-storage-provider | local | 儲存型別（local/s3） |
| skill-scanner-enabled | true | 是否啟用掃描器 |
| skill-scanner-url | http://skillhub-scanner:8000 | 掃描器地址 |
| skill-scanner-mode | upload | 掃描模式 |
| bootstrap-admin-enabled | true | 是否建立預設管理員 |
| bootstrap-admin-user-id | docker-admin | 管理員使用者 ID |
| bootstrap-admin-username | admin | 管理員使用者名稱 |
| bootstrap-admin-display-name | Platform Admin | 管理員顯示名稱 |
| bootstrap-admin-email | admin@example.com | 管理員郵箱 |
| session-cookie-secure | false | HTTPS 環境設為 true |

### Secret 配置項

| 鍵 | 說明 | 必填 |
|---|---|---|
| spring-datasource-url | PostgreSQL 連線 URL | 是 |
| spring-datasource-username | 資料庫使用者名稱 | 是 |
| spring-datasource-password | 資料庫密碼 | 是 |
| redis-password | Redis 資料節點密碼 | 否 |
| redis-sentinel-password | Redis Sentinel 獨立密碼 | 否 |
| bootstrap-admin-password | 管理員密碼 | 是 |
| oauth2-github-client-id | GitHub OAuth ID | 否 |
| oauth2-github-client-secret | GitHub OAuth 金鑰 | 否 |
| skill-scanner-llm-api-key | LLM API 金鑰 | 否 |
| skill-scanner-llm-base-url | 本地/自定義 LLM 服務地址 | 否 |
| skill-scanner-llm-model | LLM 模型名稱 | 否 |

### 儲存配置

**本地儲存（預設）**

預設使用本地檔案儲存，資料儲存在 PVC `skillhub-storage-pvc` 中。

**S3/OSS 儲存**

生產環境建議使用 S3 相容的物件儲存：

1. 修改 ConfigMap：
```yaml
skillhub-storage-provider: s3
```

2. 在 Secret 中新增：
```yaml
skillhub-storage-s3-access-key: your-access-key
skillhub-storage-s3-secret-key: your-secret-key
```

3. 在 backend-deployment.yaml 中新增環境變數：
```yaml
- name: SKILLHUB_STORAGE_S3_ENDPOINT
  value: https://oss-cn-shanghai.aliyuncs.com
- name: SKILLHUB_STORAGE_S3_BUCKET
  value: skillhub-prod
- name: SKILLHUB_STORAGE_S3_REGION
  value: cn-shanghai
```

### 持久化儲存

| PVC | 大小 | 說明 |
|-----|------|------|
| skillhub-storage-pvc | 10Gi | 技能檔案儲存 |
| postgres-data-0 | 10Gi | PostgreSQL 資料（with-infra only） |
| redis-data-0 | 5Gi | Redis 資料（with-infra only） |

#### PostgreSQL 資料目錄相容性

`with-infra` 會在啟動時檢查 PostgreSQL PVC 根目錄：如果已存在 `PG_VERSION`，繼續使用根目錄中的舊叢集；否則在 `pgdata/` 子目錄初始化新叢集，避免新 ext4 卷中的 `lost+found` 阻止 `initdb`。升級現有部署不需要行動資料庫檔案。

回滾到不包含該檢測邏輯的舊清單時，如果叢集位於 `pgdata/`，必須保留當前啟動命令，或顯式設定 `PGDATA=/var/lib/postgresql/data/pgdata`。不要把正在執行的資料庫目錄手動移動到 PVC 根目錄。

## 映象說明

| 元件 | 映象 |
|---|---|
| 後端服務 | ghcr.io/iflytek/skillhub-server:latest |
| 前端服務 | ghcr.io/iflytek/skillhub-web:latest |
| 掃描器 | ghcr.io/iflytek/skillhub-scanner:latest |
| PostgreSQL | postgres:16-alpine |
| Redis | redis:7-alpine |

## 預設管理員

首次啟動時，如果 `bootstrap-admin-enabled` 為 `true`，系統會自動建立管理員賬戶：

- 使用者名稱：`admin`
- 密碼：在 `secret.yaml` 的 `bootstrap-admin-password` 中配置

**安全建議**：首次登入後，請立即修改預設密碼。

## 常見問題

### Pod 一直 Pending

```bash
# 檢查 PVC 是否繫結
kubectl get pvc -n skillhub

# 檢查節點資源
kubectl describe node <node-name>
```

### 映象拉取失敗

如果映象私有，需要建立拉取憑證：

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<GitHub使用者名稱> \
  --docker-password=<GitHub Token> \
  -n skillhub
```

### 資料庫連線失敗

```bash
# 檢查 PostgreSQL 是否就緒
kubectl logs postgres-0 -n skillhub

# 檢查 Secret 配置
kubectl get secret skillhub-secret -n skillhub -o yaml
```

### 檢視日誌

```bash
# 後端日誌
kubectl logs -l app.kubernetes.io/name=skillhub-server -n skillhub -f

# 前端日誌
kubectl logs -l app.kubernetes.io/name=skillhub-web -n skillhub -f

# 掃描器日誌
kubectl logs -l app.kubernetes.io/name=skillhub-scanner -n skillhub -f
```

## 清理

```bash
# 刪除所有資源
kubectl delete -k overlays/with-infra/  # 或 overlays/external/

# 刪除名稱空間
kubectl delete namespace skillhub
```
