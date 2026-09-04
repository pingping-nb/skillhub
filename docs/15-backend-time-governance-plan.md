# skillhub 後端日期時間治理計劃

## 1. 當前結論

當前主系統已經基本完成 UTC 語義收口：

- 核心業務時間欄位大多已遷到 `Instant`
- 核心事件時間列大多已遷到 `TIMESTAMPTZ`
- 服務層“當前時間”大多已統一走注入 `Clock`
- 普通 API 和後臺 DTO 的絕對時間已基本統一輸出 UTC ISO-8601

系統當前保留的已經不是大範圍混用，而是少量相容尾項。剩餘風險主要集中在：

- 個別舊介面仍允許無時區字串輸入
- 新增程式碼如果重新引入 `LocalDateTime.now()`，可能把系統帶回預設時區依賴
- 缺少跨時區自動化迴歸時，仍可能遺漏邊界問題

## 2. 目標

治理目標不是“所有地方都只用一種型別”，而是統一時間語義：

- 絕對時間點：統一使用 UTC 語義，Java 使用 `Instant`
- 面向業務輸入的本地時間：只有在需求明確要求“本地日曆時間”時才允許保留 `LocalDateTime`
- 資料庫儲存絕對時間點時，統一使用 `TIMESTAMPTZ`
- 對外 API 返回絕對時間點時，統一輸出 ISO-8601 UTC 字串，例如 `2026-03-18T06:30:00Z`
- 不再把沒有時區語義的 `LocalDateTime` 繼續向領域層傳播

這裡要明確區分：

- i18n 解決的是語言、文案、本地化展示
- 時間統一到 UTC 解決的是跨時區一致性

## 3. 目標模型

建議把後端時間欄位分成三類管理：

### 3.1 系統事件時間

適用欄位：

- `createdAt`
- `updatedAt`
- `publishedAt`
- `submittedAt`
- `reviewedAt`
- `hiddenAt`
- `yankedAt`
- `lastUsedAt`
- `revokedAt`
- `readAt`
- `handledAt`
- `tokenExpiresAt`

約束：

- Java 型別統一為 `Instant`
- 資料庫列統一為 `TIMESTAMPTZ`
- 讀寫都按 UTC 絕對時間處理

進度登記：

- `audit_log.created_at` 已透過 V42 遷移到 `TIMESTAMPTZ`，詳見 `docs/16-backend-time-inventory.md` §3.1

### 3.2 業務輸入時間

適用場景：

- 使用者手工輸入一個“到某天某時截止”的欄位
- 規則明確繫結某個業務時區，而不是系統時區

約束：

- 如果該時間代表真實絕對時刻，入口就應要求帶時區或明確時區來源，然後在服務層立刻轉換為 `Instant`
- 不允許把使用者輸入的裸 `yyyy-MM-ddTHH:mm:ss` 長期儲存在核心領域模型中

### 3.3 純日期欄位

適用場景：

- 生日
- 賬期
- 結算日
- 自然日統計

約束：

- 使用 `LocalDate`
- 不參與 UTC/時區轉換

## 4. 現狀問題

### 4.1 歷史問題已基本清理

此前系統的主要問題包括：

- 領域層大量使用 `LocalDateTime`
- 服務層散落 `LocalDateTime.now()`
- 資料庫 DDL 大量使用 `TIMESTAMP`
- 相容層存在隱式 UTC 假設和衝突解釋

當前這些問題在主鏈程式碼中已基本完成治理，保留它們主要是為了說明為什麼遷移順序必須先做基礎設施，再做模型與資料庫。

### 4.2 當前仍存在的實際問題

- `ApiTokenService` 仍相容裸時間字串輸入
- 尚未建立靜態約束來阻止未來重新引入 `LocalDateTime.now()`
- 尚未形成系統性的跨時區迴歸基線

## 5. 治理原則

- 先統一新增程式碼，再遷移存量程式碼
- 先統一領域模型，再遷移資料庫，再收口 API
- 所有“當前時間”獲取統一從 `Clock` 注入，禁止繼續散落 `now()`
- 遷移期間優先保證 API 相容，避免前端和 CLI 同時破壞
- 對外只暴露明確語義的時間格式，不暴露“無時區但又預設是 UTC”的灰色狀態

## 6. 分階段計劃

### Phase 0：基線審計

產出：

- 全量時間欄位清單
- `LocalDateTime` / `Instant` / `LocalDate` 使用清單
- `TIMESTAMP` / `TIMESTAMPTZ` 列清單
- API 請求與響應中的時間欄位清單
- 相容層中所有 epoch 轉換點清單

當前狀態：

- 已完成初版盤點
- 已同步到當前程式碼真實進展

### Phase 1：統一規範與基礎設施

執行內容：

- 新增全域性 UTC `Clock`
- 配置 Hibernate JDBC 時區為 UTC
- 配置 Jackson UTC 輸出
- 建立“絕對時間用 `Instant`”規範

當前狀態：

- 已完成

### Phase 2：程式碼層遷移到 `Instant`

執行內容：

- 實體欄位改為 `Instant`
- `LocalDateTime.now()` 改為 `Instant.now(clock)`
- 比較邏輯統一為 `Instant`
- DTO 與服務同步遷移

當前狀態：

- 主鏈已基本完成
- 生產程式碼中僅剩極少數相容解析程式碼保留 `LocalDateTime`

### Phase 3：資料庫遷移到 `TIMESTAMPTZ`

執行內容：

- 為核心表新增 Flyway migration
- 明確歷史 `TIMESTAMP` 資料按 UTC 解釋

當前狀態：

- 主鏈核心事件時間列已基本完成
- 已落地 migration `V13` 到 `V23`

### Phase 4：API 契約收口

執行內容：

- 普通 JSON API 中所有絕對時間欄位統一輸出 UTC 字串
- 禁止介面返回裸 `LocalDateTime.toString()`
- 逐步淘汰無時區輸入

當前狀態：

- 普通 API 與後臺 DTO 已基本完成 UTC 輸出收口
- 剩餘相容重點是舊介面對裸時間字串輸入的處理策略

### Phase 5：清理與強約束

執行內容：

- 清理遺留相容時區假設
- 增加 ArchUnit 或靜態掃描規則
- 增加跨時區測試，例如 `UTC` 與 `Asia/Shanghai`

當前狀態：

- 尚未完成
- 這是下一階段最有價值的工作

## 7. 重點技術決策

### 7.1 為什麼用 `Clock` 而不是隻用 `Instant.now()`

- `Instant` 解決“時間如何表達”
- `Clock` 解決“當前時間從哪裡來”
- 推薦組合是 `Instant.now(clock)`

這使服務層可測試、可固定時間、可避免機器本地時區幹擾。

### 7.2 是否統一引入 `OffsetDateTime`

本專案更適合以 `Instant` 作為核心絕對時間型別，原因是：

- 多數字段表達的是事件發生時刻
- 業務側通常不需要保留原始 offset
- `Instant` 更能防止“看起來像本地時間”的誤解

只有在必須保留呼叫方原始 offset 的場景下，才考慮 `OffsetDateTime`。

### 7.3 `expiresAt` 這類使用者輸入欄位怎麼處理

長期目標：

- API 約定輸入為 RFC 3339 / ISO-8601 帶時區時間
- 服務層解析後立即轉換為 `Instant`

短期相容：

- 舊介面若仍接受裸字串，應在 controller 或 service 邊界集中兜底
- 必須明確記錄這是相容邏輯，而不是長期契約

## 8. 風險與應對

| 風險 | 應對 |
|------|------|
| 歷史 `TIMESTAMP` 資料真實語義不一致 | 先做抽樣和資料畫像，必要時分批遷移 |
| 前端或 CLI 已依賴不帶時區的舊格式 | 保留短期相容解析，同時明確廢棄計劃 |
| 新程式碼繼續引入 `LocalDateTime.now()` | 加靜態掃描和 review 規則阻斷 |
| 缺少跨時區迴歸導致邊界問題漏檢 | 增加 `UTC` / `Asia/Shanghai` 雙時區測試矩陣 |

## 9. 推薦後續順序

1. 為 `LocalDateTime.now()` 和實體層 `LocalDateTime` 增加靜態約束
2. 增加跨時區迴歸測試
3. 梳理並逐步淘汰裸時間字串輸入相容
4. 對生產歷史資料做一次抽樣校驗，確認所有 `TIMESTAMPTZ` 遷移都符合 UTC 解釋假設
