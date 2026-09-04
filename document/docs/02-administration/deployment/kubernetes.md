---
title: Kubernetes 部署
sidebar_position: 2
description: 在 Kubernetes 叢集中部署 SkillHub
---

# Kubernetes 部署

本文介紹如何在 Kubernetes 叢集中部署 SkillHub。

## 前置要求

- Kubernetes 1.24+
- kubectl 配置完成
- Helm 3.0+（可選）
- 可用的持久化儲存類

## 部署清單

專案提供了 Kubernetes 部署清單：

```bash
cd deploy/k8s

# 1. 建立名稱空間
kubectl create namespace skillhub

# 2. 配置 Secret
cp secret.yaml.example secret.yaml
# 編輯 secret.yaml 填入真實憑證

# 3. 應用配置
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# 4. 部署服務
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f services.yaml

# 5. 配置 Ingress
kubectl apply -f ingress.yaml
```

## 高可用配置

- 後端和前端建議至少部署 2 個副本
- PostgreSQL 使用主從複製
- Redis 使用 Sentinel 或 Cluster 模式
- 儲存使用高可用物件儲存（如 MinIO 叢集或雲廠商 OSS）

## 下一步

- [配置說明](./configuration) - 詳細配置項說明
