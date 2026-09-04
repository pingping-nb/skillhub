# Skill 搜尋與發現

## 功能描述

SkillHub 提供了強大的全文搜尋功能，讓使用者可以快速找到需要的技能包。

搜尋不僅支援關鍵詞匹配，還支援按名稱空間、標籤、下載量、評分等多維度過濾和排序。

![概念圖](/diagrams/skill-discovery-concept.png)

**核心特性**：

- **全文搜尋**：搜尋技能包名稱、描述、標籤、作者
- **智慧過濾**：按名稱空間、標籤、可見性過濾
- **多種排序**：按相關性、下載量、評分、更新時間排序
- **許可權感知**：只顯示使用者有權訪問的技能包
- **實時更新**：新發布的技能包立即出現在搜尋結果中

**搜尋演算法**：

SkillHub 使用 PostgreSQL 全文搜尋，支援：
- 中英文分詞
- 模糊匹配
- 權重排序（標題權重 > 描述權重 > 標籤權重）

## 使用場景

**場景一：新成員探索**

新加入團隊的開發者想了解團隊已有哪些可用的技能包。

![操作截圖](/screenshots/skill-discovery-search.png)

**場景二：按需查詢**

開發者需要一個處理 PDF 的技能包，搜尋 "pdf" 關鍵詞。

**場景三：瀏覽熱門**

檢視團隊內下載量最高、評分最好的技能包，學習最佳實踐。

**場景四：按標籤過濾**

只檢視 `data-processing` 標籤的技能包。

## 使用步驟

### 使用 CLI 搜尋和安裝（推薦）

```bash
# 配置註冊中心
export CLAWHUB_REGISTRY=http://localhost:8080

# 搜尋技能包
npx clawhub search pdf

# 安裝技能包
npx clawhub install pdf-parser

# 安裝指定名稱空間的技能包
npx clawhub install my-team--pdf-parser
```

### 使用 Web UI 搜尋

1. **訪問搜尋頁面**

訪問 `http://localhost:3000/search` 或在首頁使用搜尋框。

2. **輸入關鍵詞**

在搜尋框輸入關鍵詞，例如 "pdf parser"。

3. **應用過濾器**

- 選擇名稱空間（例如只看 `iflytek` 名稱空間）
- 選擇標籤（例如 `data-processing`）
- 選擇排序方式（例如按下載量降序）

![流程圖](/diagrams/skill-discovery-flow.png)

4. **檢視結果**

搜尋結果會實時更新，顯示匹配的技能包列表。

5. **檢視詳情**

點選技能包卡片，檢視詳細資訊、版本歷史、檔案列表。

6. **安裝使用**

找到合適的技能包後，使用 CLI 命令安裝或點選「下載」按鈕。

## API 介面

**搜尋技能包**：
```bash
GET /api/web/skills?q=pdf&namespace=iflytek&label=data-processing&sort=downloads&page=0&size=20
```

**引數說明**：
| 引數 | 型別 | 說明 |
|------|------|------|
| q | string | 搜尋關鍵詞（可選） |
| namespace | string | 名稱空間過濾（可選） |
| label | string[] | 標籤過濾（可選，可多選） |
| sort | enum | 排序方式：relevance（相關性）、downloads（下載量）、rating（評分）、updated（更新時間） |
| page | number | 頁碼（從 0 開始） |
| size | number | 每頁數量（預設 20，最大 100） |

**響應示例**：
```json
{
  "content": [
    {
      "id": "skill-123",
      "namespace": "iflytek",
      "slug": "pdf-parser",
      "name": "PDF Parser",
      "description": "Extract text and metadata from PDF files",
      "downloads": 1234,
      "rating": 4.5,
      "starCount": 56,
      "latestVersion": "1.2.3",
      "updatedAt": "2026-03-15T10:30:00Z",
      "labels": ["data-processing", "pdf"]
    }
  ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

## 注意事項

> **許可權控制**：搜尋結果會根據使用者許可權自動過濾。PRIVATE 技能包只對名稱空間成員可見，INTERNAL 技能包只對登入使用者可見。

- **搜尋效能**：SkillHub 使用 PostgreSQL 全文搜尋，支援中英文分詞
- **實時更新**：新發布的技能包會立即出現在搜尋結果中
- **標籤規範**：建議使用統一的標籤命名規範，便於過濾
- **搜尋提示**：支援搜尋建議和自動補全（前端實現）
