---
name: 🌸 HER Hack-Astron 出題
about: 面向企業 Agent Skill 註冊、治理、搜尋與部署發布 HER Hack-Astron 賽題
title: 'HER Hack-Astron #出題｜賽題名稱'
labels: ['HER Hack-Astron']
---

<!-- 替換 {{...}} 後提交；由 @FenjuFu 稽核並分配正式期號。 -->

> **賽題確認：** 本 Issue 初始標題為 `HER Hack-Astron #出題｜賽題名稱`；經 @FenjuFu 改為 `HER Hack-Astron #期號｜賽題名稱` 後正式發布。
>
> **活動標籤：** 模板自動新增 `HER Hack-Astron`，未顯示時由維護者補充。

## 命題背景

- 出題組織：{{組織名稱}}
- 企業技能治理問題：{{發布、發現、稽核、許可權、審計、部署或相容性痛點}}
- 目標角色：{{技能作者 / Namespace 管理員 / 平臺管理員 / Agent 使用者}}

## SkillHub 賽題方向

圍繞**自託管企業 Agent Skill Registry**選擇一個可驗證方向：

- 技能包發布、語義化版本、標籤、推廣和回滾
- Namespace RBAC、稽核流、API Token、安全掃描與審計日誌
- CLI 的 search / install / publish 體驗及 Astron Agent、OpenClaw 等客戶端相容
- 全文搜尋、許可權可見性、排序與可插拔搜尋後端
- PostgreSQL 假設解耦、OceanBase MySQL 模式等資料庫相容和遷移
- Docker / Kubernetes、S3 / MinIO、監控與企業內網部署

靈感參考：[OceanBase MySQL 模式部署支援 #247](https://github.com/iflytek/skillhub/issues/247)。

## 任務定義

- 當前限制：{{程式碼、配置或產品流程中的具體限制}}
- 目標行為：{{使用者可觀察結果}}
- 影響模組：{{server / web / cli / search / storage / deploy / monitoring}}
- API / SDK 影響：{{是否需更新 OpenAPI 與生成型別}}
- 相容與遷移：{{舊資料、舊客戶端和回滾策略}}

## 最低交付物

- 實現程式碼及對應單元 / 整合測試
- 涉及資料庫時提供可重複遷移、乾淨例項啟動和回滾說明
- 涉及 API 時執行 `make generate-api` 並提交同步的生成檔案
- 涉及發布 / 安裝時驗證 publish → review → search → install 核心鏈路
- 部署檔案、配置示例和脫敏演示記錄
- 不提交真實 Token、預設弱密碼或私有 Registry 地址

## 驗收建議

- `make test` 或受影響模組的專案標準檢查透過
- 核心流程在本地開發棧可復現
- Namespace 許可權和全域性推廣邊界不被繞過
- 搜尋結果遵守可見性；升級不破壞已有技能版本
- 新後端 / 資料庫的能力差異和限制有明確檔案

## 提交與參與

1. 先在本 Issue 對齊範圍，再 Fork 並提交 PR
2. PR 標題：`[HER Hack-Astron #期號] 作品名稱 + SkillHub 改進`
3. PR 程式碼記錄中女性貢獻者佔比須 **≥ 50%**，以 commit / `Co-authored-by:` 為準
4. PR 附架構說明、測試命令、結果和遷移風險

## 評審重點

- 企業治理價值與真實使用場景
- 許可權、安全、相容性與資料遷移質量
- API / CLI / Web 契約一致性
- 測試、可觀測性、檔案與部署復現

出題 / 合作 / 發獎諮詢：ifly_opensource@iflytek.com
