---
title: 常見問題
sidebar_position: 1
description: 常見問題解答
---

# 常見問題

## 部署相關

### 如何修改預設埠？

修改 `.env.release` 中的埠配置。

### 如何配置 HTTPS？

建議使用反向代理（Nginx/Ingress）處理 TLS 終止。

### 資料庫如何備份？

使用 PostgreSQL 標準備份工具（pg_dump）。

## 使用相關

### 如何重置管理員密碼？

如果忘記管理員密碼，可透過環境變數重新設定首登管理員，或直接運算元據庫。

### 技能包上傳失敗怎麼辦？

檢查：
1. 檔案大小是否超限
2. 檔案型別是否在白名單內
3. 是否包含必需的 SKILL.md
4. SKILL.md frontmatter 格式是否正確

### 使用 CLI 安裝技能時報 `namespace not found`？

多數情況是 CLI 沒有指向你自己的 SkillHub 例項，或名稱空間格式不對：

1. **配置 registry 並登入**：用環境變數或 `--registry` 指向你的例項，例如
   `clawhub --registry https://skillhub.your-company.com install <skill>`；登入需要先在 Web 控制檯生成 API Token。
2. **名稱空間 slug 格式**：全域性名稱空間的技能直接用名字（如 `my-skill`）；團隊名稱空間要用 `team--skill` 的形式（`@team/skill` → `team--skill`）。
3. 最穩妥的方式是直接在 SkillHub Web 介面點技能的「安裝」按鈕，複製其中已經帶好正確 registry 與名稱空間的命令。

> SkillHub 同時提供 `clawhub` 和 `skillhub` 兩種 CLI，用法見各自 README；透過 OpenClaw 對話安裝技能時，底層同樣呼叫 CLI。

## 開發相關

### 如何擴充套件 OAuth Provider？

參考現有 GitHub 實現，新增新的 OAuth Provider 配置。

### 如何自定義搜尋實現？

實現 `SearchIndexService` 和 `SearchQueryService` 介面。

## 下一步

- [故障排查](./troubleshooting) - 問題診斷
