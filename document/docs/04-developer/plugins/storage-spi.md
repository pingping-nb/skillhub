---
title: 儲存 SPI
sidebar_position: 2
description: 儲存服務提供方擴充套件
---

# 儲存 SPI

## SPI 介面

```java
public interface ObjectStorageService {
    void store(String key, InputStream content, String contentType);
    InputStream retrieve(String key);
    void delete(String key);
    boolean exists(String key);
}
```

## 內建實現

### LocalFileStorageService

本地檔案系統實現，用於開發環境。

### S3StorageService

S3 協議相容實現，支援：
- AWS S3
- MinIO
- 阿里雲 OSS
- 騰訊雲 COS
- 其他 S3 相容儲存

## 配置

### 靜態憑據（Access Key / Secret Key）

```bash
# 選擇儲存提供方
SKILLHUB_STORAGE_PROVIDER=s3

# S3 配置
SKILLHUB_STORAGE_S3_ENDPOINT=https://s3.example.com
SKILLHUB_STORAGE_S3_BUCKET=skillhub
SKILLHUB_STORAGE_S3_ACCESS_KEY=xxx
SKILLHUB_STORAGE_S3_SECRET_KEY=xxx
```

### IAM 認證

部署在 AWS 上時，可以不配置 Access Key / Secret Key，讓 SDK 自動使用 IAM 角色認證（[Default Credentials Provider Chain](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/credentials-chain.html)）：

```bash
SKILLHUB_STORAGE_PROVIDER=s3
SKILLHUB_STORAGE_S3_BUCKET=skillhub
SKILLHUB_STORAGE_S3_REGION=us-east-1
# 留空或不設定 ACCESS_KEY / SECRET_KEY，SDK 自動使用 IAM 認證
SKILLHUB_STORAGE_S3_ACCESS_KEY=
SKILLHUB_STORAGE_S3_SECRET_KEY=
```

支援的 IAM 認證方式（按 SDK 優先順序）：
- 環境變數（`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）
- Java 系統屬性
- Web Identity Token（EKS IRSA）
- AWS 配置檔案（`~/.aws/credentials`）
- EC2 Instance Profile
- ECS Task Role

## 自定義實現

實現 `ObjectStorageService` 介面，註冊為 Spring Bean 即可。

## 下一步

- [常見問題](../../reference/faq) - FAQ
