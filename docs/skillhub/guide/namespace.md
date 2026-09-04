# 名稱空間與團隊管理

## 功能描述

名稱空間（Namespace）是 SkillHub 的核心組織單元。每個名稱空間代表一個團隊或專案，擁有獨立的成員、許可權和技能包。

![概念圖](/diagrams/namespace-concept.png)

**名稱空間的作用**：

- **隔離**：不同團隊的技能包互不幹擾
- **許可權**：基於角色的訪問控制（RBAC）
- **協作**：團隊成員可以共同管理技能包
- **治理**：管理員可以稽核、歸檔、凍結技能包

**角色體系**：

| 角色 | 許可權 |
|------|------|
| **Owner** | 完全控制，包括刪除名稱空間、管理所有成員 |
| **Admin** | 管理成員、稽核技能包、修改設定 |
| **Member** | 發布技能包、檢視私有技能包 |

**名稱空間狀態**：

- **Active**：正常執行
- **Frozen**：凍結狀態，無法發布新技能包
- **Archived**：歸檔狀態，從搜尋結果中隱藏

## 使用場景

**場景一：建立團隊名稱空間**

團隊負責人建立一個新的名稱空間，用於管理團隊的技能包。

![操作截圖](/screenshots/namespace-create.png)

**場景二：新增團隊成員**

管理員邀請新成員加入名稱空間，分配合適的角色。

![操作截圖](/screenshots/namespace-members.png)

**場景三：許可權管理**

調整成員角色，控制誰可以發布、稽核、管理技能包。

**場景四：名稱空間凍結**

發現名稱空間有安全問題，臨時凍結所有發布操作。

## 使用步驟

**建立名稱空間**：

1. 訪問 `/dashboard/namespaces`
2. 點選「建立名稱空間」
3. 填寫資訊：
   - 名稱：團隊名稱（例如 "iFlytek AI Team"）
   - Slug：URL 識別符號（例如 "iflytek"）
   - 描述：簡要說明團隊職責和技能包範圍

![流程圖](/diagrams/namespace-create-flow.png)

4. 提交建立，系統自動將你設為 Owner

**新增成員**：

1. 進入名稱空間詳情頁
2. 點選「成員」標籤
3. 點選「新增成員」
4. 搜尋使用者（支援按使用者名稱、郵箱搜尋）
5. 選擇角色（Owner / Admin / Member）
6. 確認新增

**管理許可權**：

1. 在成員列表中找到目標使用者
2. 點選「修改角色」
3. 選擇新角色並確認
4. 系統會記錄許可權變更到審計日誌

**凍結名稱空間**：

1. 進入名稱空間設定
2. 點選「凍結名稱空間」
3. 填寫凍結原因（可選）
4. 確認凍結

> 凍結後，名稱空間內的所有技能包無法發布新版本，但已有版本仍可下載。

## API 介面

**建立名稱空間**：
```bash
POST /api/v1/namespaces
Content-Type: application/json

{
  "name": "iFlytek AI Team",
  "slug": "iflytek",
  "description": "iFlytek's AI agent skills"
}
```

**引數說明**：
| 引數 | 型別 | 說明 |
|------|------|------|
| name | string | 名稱空間名稱（必需，2-50 字元） |
| slug | string | URL 識別符號（必需，唯一，2-64 字元，只能包含小寫字母、數字、連字元） |
| description | string | 描述（可選，最多 500 字元） |

**獲取名稱空間詳情**：
```bash
GET /api/v1/namespaces/{slug}
```

**更新名稱空間**：
```bash
PUT /api/v1/namespaces/{slug}
Content-Type: application/json

{
  "name": "iFlytek AI Team (Updated)",
  "description": "Updated description"
}
```

**新增成員**：
```bash
POST /api/v1/namespaces/{slug}/members
Content-Type: application/json

{
  "userId": "user-123",
  "role": "MEMBER"
}
```

**更新成員角色**：
```bash
PUT /api/v1/namespaces/{slug}/members/{userId}/role
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**移除成員**：
```bash
DELETE /api/v1/namespaces/{slug}/members/{userId}
```

**凍結名稱空間**：
```bash
POST /api/v1/namespaces/{slug}/freeze
Content-Type: application/json

{
  "reason": "Security investigation"
}
```

**解凍名稱空間**：
```bash
POST /api/v1/namespaces/{slug}/unfreeze
```

## 注意事項

> **Slug 唯一性**：名稱空間 slug 在全域性範圍內必須唯一，且建立後不可修改。建議使用團隊或專案的簡短識別符號。

- **Owner 許可權**：每個名稱空間至少需要一個 Owner，最後一個 Owner 無法被移除
- **角色繼承**：名稱空間成員自動擁有該名稱空間下所有技能包的訪問許可權
- **凍結機制**：管理員可以凍結名稱空間，凍結後無法發布新技能包
- **歸檔機制**：歸檔的名稱空間會從搜尋結果中隱藏，但已有技能包仍可訪問
- **審計日誌**：所有成員變更、許可權調整都會記錄到審計日誌
