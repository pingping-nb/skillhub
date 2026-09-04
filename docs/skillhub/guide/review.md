# 稽核與治理

## 功能描述

SkillHub 提供了完整的稽核工作流，確保發布到註冊中心的技能包符合團隊規範。

稽核機制分為兩層：
- **名稱空間稽核**：團隊管理員稽核本名稱空間的技能包
- **平臺稽核**：平臺管理員稽核推廣到全域性的技能包

![概念圖](/diagrams/review-concept.png)

**稽核流程**：

1. 開發者發布技能包 → 進入「待稽核」狀態
2. 管理員收到通知 → 檢視技能包詳情
3. 管理員決策 → 批准或拒絕
4. 批准後 → 技能包正式發布
5. 拒絕後 → 開發者收到反饋，可修改後重新提交

**稽核狀態**：

| 狀態 | 說明 |
|------|------|
| **PENDING** | 待稽核 |
| **APPROVED** | 已批准 |
| **REJECTED** | 已拒絕 |
| **WITHDRAWN** | 已撤回 |

**治理功能**：

- **稽核工作流**：多級稽核、批次稽核
- **舉報系統**：使用者可以舉報不當技能包
- **推廣管理**：將名稱空間技能包推���到全域性
- **審計日誌**：記錄所有治理操作

## 使用場景

**場景一：名稱空間管理員稽核**

團隊管理員稽核成員提交的技能包，確保符合團隊規範。

![操作截圖](/screenshots/review-list.png)

**場景二：平臺管理員稽核推廣**

平臺管理員稽核從名稱空間推廣到全域性的技能包。

**場景三：舉報處理**

使用者舉報不當技能包，管理員調查並處理。

**場景四：批次稽核**

管理員批次批准多個符合規範的技能包。

## 使用步驟

**提交稽核**：

1. 發布技能包時，系統自動建立稽核任務
2. 開發者可以在「我的提交」中檢視稽核狀態
3. 等待管理���稽核

**稽核技能包**：

1. 訪問 `/dashboard/reviews`
2. 檢視待稽核列表
3. 點選技能包檢視詳情：
   - 檢視後設資料（名稱、描述、版本）
   - 瀏覽檔案列表
   - 線上檢視檔案內容
   - 下載完整包進行本地測試
   - 檢視合規宣告快照和相對上一發布版本的差異

![流程圖](/diagrams/review-flow.png)

4. 做出決策：
   - **批准**：技能包正式發布，開發者收到通知
   - **拒絕**：填寫拒絕原因，開發者可修改後重新提交

5. 新增稽核意見（可選）

**稽核合規宣告**：

如果待稽核版本包含 `x-astron-compliance`，稽核詳情會展示版本級合規快照和差異摘要：

- 新增宣告：待審版本新增了標準、控制項或證據。
- 刪除宣告：待審版本移除了上一發布版本已有的宣告。
- 修改宣告：標準、控制項標題或證據發生變化。
- 摘要變化：`complianceSnapshot.digest` 變化，表示規範化後的宣告內容發生變化。

稽核建議：

1. 確認宣告是否與技能實際能力相關。例如安全響應技能宣告 MITRE ATT&CK 技術編號時，應能在說明或證據檔案中看到對應依據。
2. 點選差異項檢視證據路徑、外部連結和摘要，不只看宣告標題。
3. 對刪除或大範圍修改的宣告提高稽核優先順序，因為這會影響下游審計系統引用。
4. 如果證據缺失、路徑不可訪問、宣告明顯不匹配技能能力，建議拒絕並要求作者修正。

SkillHub 能保證的是結構正確、證據可追溯、版本快照不可變；不能替作者保證“真的合規”。

**撤回稽核**：

開發者發現問題，可以在稽核透過前撤回提交：

1. 訪問「我的提交」
2. 找到待稽核的技能包
3. 點選「撤回」
4. 確認撤回

**處理舉報**：

1. 訪問 `/dashboard/reports`
2. 檢視舉報列表
3. 調查舉報內容
4. 採取行動（歸檔技能包、警告使用者等）

## API 介面

**提交稽核**：
```bash
POST /api/v1/reviews
Content-Type: application/json

{
  "skillVersionId": "version-123"
}
```

**批准稽核**：
```bash
POST /api/v1/reviews/{id}/approve
Content-Type: application/json

{
  "comment": "Looks good! Approved."
}
```

**拒絕稽核**：
```bash
POST /api/v1/reviews/{id}/reject
Content-Type: application/json

{
  "comment": "Please fix the documentation and add more examples."
}
```

**引數說明**：
| 引數 | 型別 | 說明 |
|------|------|------|
| id | string | 稽核任務 ID（路徑引數） |
| comment | string | 稽核意見（可選，最多 1000 字元） |

**列出待稽核任務**：
```bash
GET /api/v1/reviews/pending?namespaceId=ns-123&page=0&size=20
```

**列出我的提交**：
```bash
GET /api/v1/reviews/my-submissions?page=0&size=20
```

**獲取稽核詳情**：
```bash
GET /api/v1/reviews/{id}
```

**獲取稽核中的技能包詳情**：
```bash
GET /api/v1/reviews/{id}/skill-detail
```

**下載稽核包**：
```bash
GET /api/v1/reviews/{id}/download
```

**撤回稽核**：
```bash
POST /api/v1/reviews/{id}/withdraw
```

**舉報技能包**：
```bash
POST /api/v1/skills/{namespace}/{slug}/reports
Content-Type: application/json

{
  "reason": "INAPPROPRIATE_CONTENT",
  "details": "This skill contains malicious code"
}
```

## 注意事項

> **稽核許可權**：只有名稱空間的 Admin 和 Owner 可以稽核本名稱空間的技能包。平臺管理員可以稽核所有技能包。

- **稽核時效**：建議在 24 小時內完成稽核，避免阻塞開發者
- **稽核記錄**：所有稽核操作都會記錄到審計日誌
- **合規審計**：合規宣告以版本快照形式記錄。稽核透過或拒絕時，應結合差異摘要判斷風險，但 Agent 執行 trace 不由 SkillHub 記錄
- **批次稽核**：管理員可以批次批准多個技能包
- **稽核意見**：拒絕時建議提供詳細的改進建議
- **撤回限制**：只有待稽核狀態的技能包可以撤回
