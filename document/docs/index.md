---
title: SkillHub 檔案中心
sidebar_position: 1
description: 企業級 AI 技能登入檔 - 安全可控的技能發布、發現與管理平臺
---

# SkillHub

<section className="hero-section">
  <div className="container">
    <h1 className="hero-section__title">🏢 企業級 AI 技能登入檔</h1>
    <p className="hero-section__tagline">
      安全可控的技能發布、發現與管理平臺，保障企業資料主權
    </p>
    <div className="hero-section__cta">
      <a href="/getting-started/quick-start" className="btn-primary">立即部署</a>
      <a href="/getting-started/overview" className="btn-secondary">瞭解更多</a>
    </div>
  </div>
</section>

---

## 企業價值

<div className="row" style={{ marginTop: '40px', marginBottom: '40px' }}>
  <div className="col col--3">
    <div className="enterprise-value-card">
      <div className="enterprise-value-card__icon">🔐</div>
      <h3 className="enterprise-value-card__title">資料主權可控</h3>
      <p className="enterprise-value-card__description">
        自託管部署，資料不離開企業網路；支援私有 S3/MinIO 儲存；完整審計鏈路
      </p>
    </div>
  </div>
  <div className="col col--3">
    <div className="enterprise-value-card">
      <div className="enterprise-value-card__icon">🏢</div>
      <h3 className="enterprise-value-card__title">治理體系完善</h3>
      <p className="enterprise-value-card__description">
        名稱空間隔離；雙層稽核機制；細粒度 RBAC 許可權控制
      </p>
    </div>
  </div>
  <div className="col col--3">
    <div className="enterprise-value-card">
      <div className="enterprise-value-card__icon">🔌</div>
      <h3 className="enterprise-value-card__title">整合能力強</h3>
      <p className="enterprise-value-card__description">
        相容 ClawHub CLI；標準 REST API；OAuth2 企業 SSO 整合
      </p>
    </div>
  </div>
  <div className="col col--3">
    <div className="enterprise-value-card">
      <div className="enterprise-value-card__icon">📊</div>
      <h3 className="enterprise-value-card__title">可觀測性完善</h3>
      <p className="enterprise-value-card__description">
        完整審計日誌；Prometheus 指標；操作追蹤與溯源
      </p>
    </div>
  </div>
</div>

---

## 核心功能特性

<div style={{ textAlign: 'center', marginTop: '40px' }}>
  <div className="feature-tags">
    <span className="feature-tag">版本控制</span>
    <span className="feature-tag">全文搜尋</span>
    <span className="feature-tag">名稱空間</span>
    <span className="feature-tag">稽核流程</span>
    <span className="feature-tag">語義化版本</span>
    <span className="feature-tag">多維度篩選</span>
    <span className="feature-tag">RBAC 許可權</span>
    <span className="feature-tag">審計日誌</span>
  </div>
</div>

---

## 快速開始

<div style={{ textAlign: 'center', marginTop: '40px' }}>
  <div className="quick-start-code">
    <code>$ curl -fsSL https://raw.githubusercontent.com/iflytek/skillhub/main/scripts/runtime.sh | sh -s -- up</code>
  </div>
  <p style={{ marginTop: '16px', color: 'var(--ifm-font-color-secondary)' }}>
    訪問 <a href="http://localhost:3000">http://localhost:3000</a> 開始使用
  </p>
</div>

---

## 下一步

- [快速開始](./getting-started/quick-start) - 一鍵啟動 SkillHub
- [產品概述](./getting-started/overview) - 瞭解更多產品特性
- [部署指南](./administration/deployment/single-machine) - 生產環境部署
