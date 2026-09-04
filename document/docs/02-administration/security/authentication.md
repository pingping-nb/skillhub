---
title: 認證配置
sidebar_position: 1
description: 配置使用者認證方式
---

# 認證配置

SkillHub 支援多種認證方式，滿足不同企業的安全需求。

## OAuth2 登入

### GitHub OAuth

1. 在 GitHub 建立 OAuth App
2. 配置環境變數：
   ```bash
   OAUTH2_GITHUB_CLIENT_ID=your-client-id
   OAUTH2_GITHUB_CLIENT_SECRET=your-client-secret
   ```

### 擴充套件 OAuth Provider

架構支援擴充套件其他 OAuth Provider，如 GitLab、Gitee 等。

## 本地賬號登入

開發環境支援本地賬號登入，生產環境預設關閉。

## 企業 SSO 整合

支援透過擴充套件點整合企業 SSO（SAML/OIDC）。

## 下一步

- [許可權管理](./authorization) - 配置許可權控制
