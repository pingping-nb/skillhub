# 專案簡介

SkillHub 是一個專為企業打造的自託管 Agent Skill 註冊中心。

在 AI Agent 時代，每個團隊都在積累自己的技能包（Skills）。但這些技能包散落在各處：有的在開發者本地，有的在 Git 倉庫，有的在內部檔案裡。團隊成員很難發現彼此的工作，更難複用已有的能力。

SkillHub 解決了這個問題。它提供了一個**私有、可控、易用**的技能包註冊中心，讓團隊可以像使用 npm、PyPI 一樣管理 Agent Skills。

![專案架構圖](/diagrams/architecture.png)

## 核心價值

- **3 分鐘發布**：從本地開發到全球分發，只需一條命令
- **企業級許可權**：基於名稱空間的 RBAC，支援團隊協作和稽核流程
- **完整生命週期**：版本管理、標籤系統、稽核工作流、歸檔機制
- **開箱即用**：一條 curl 命令啟動完整環境
- **安全掃描**：內建 Skill Scanner，自動檢測安全風險
- **資料主權**：完全自託管，所有資料都在你的防火牆內

## 技術棧

![技術棧圖](/diagrams/tech-stack.png)

| 層級 | 技術 | 說明 |
|------|------|------|
| **前端** | React 19 + Vite + TanStack Router | 現代化 SPA，支援中英文切換 |
| **後端** | Java 21 + Spring Boot 3.2 | 企業級 REST API |
| **資料庫** | PostgreSQL 16 | 全文搜尋、Flyway 自動遷移 |
| **快取** | Redis 7 | 會話管理、熱點快取 |
| **儲存** | MinIO / S3 | 技能包檔案儲存，支援本地和雲端 |
| **部署** | Docker Compose / K8s | 一鍵啟動，支援自託管 |

## 核心功能一覽

| 功能 | 說明 |
|------|------|
| [Skill 發布與版本管理](/guide/skill-publish) | 一鍵發布技能包，語義化版本管理 |
| [Skill 搜尋與發現](/guide/skill-discovery) | 全文搜尋、智慧過濾、許可權感知 |
| [名稱空間與團隊管理](/guide/namespace) | 基於名稱空間的 RBAC 許可權體系 |
| [稽核與治理](/guide/review) | 多級稽核工作流、舉報系統 |
| [安全掃描](/guide/scanner) | 內建 Skill Scanner，多引擎安全分析 |
| [使用者互動與社交](/guide/social) | 星標、評分、通知系統 |
