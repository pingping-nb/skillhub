# SkillHub 落地頁重新設計

## 設計理念

採用"技術編織"（Tech Weave）美學風格，透過以下元素傳達 SkillHub 作為企業級技能註冊中心的專業性和創新性：

### 視覺特點

1. **動態粒子系統**
   - Canvas 實現的粒子連線動畫
   - 象徵技能之間的連線和協作
   - 80個粒子節點，動態連線效果

2. **配色方案**
   - 深藍紫色基調（slate-950, indigo-950）
   - 霓虹青色點綴（cyan-500）
   - 紫羅蘭色輔助（violet-500）
   - 營造科技感和未來感

3. **字型選擇**
   - 標題：Syne（幾何感強，現代）
   - 正文：IBM Plex Sans（技術感，易讀）
   - 程式碼：JetBrains Mono

4. **動效設計**
   - 漸入動畫（fade-up, fade-in）
   - 懸浮卡片效果（hover:scale-105）
   - 漸變光暈（gradient glow）
   - 脈衝動畫（pulse）

### 內容結構

1. **Hero 區域**
   - 大標題 + 漸變文字效果
   - 搜尋欄（帶光暈效果）
   - CTA 按鈕（探索技能 / 發布技能）
   - 統計資料展示（技能包、下載量、團隊）

2. **特性展示**
   - 6個核心特性卡片
   - 圖示 + 標題 + 描述
   - 懸浮互動效果

3. **CTA 區域**
   - 快速開始指引
   - 命令列示例
   - 行動按鈕

4. **頁尾**
   - 版權資訊
   - 導航連結

## 技術實現

- React + TypeScript
- TailwindCSS
- Canvas API（粒子動畫）
- TanStack Router

## 檔案變更

- 新增：`web/src/pages/landing.tsx` - 新的落地頁元件
- 修改：`web/src/app/router.tsx` - 路由配置，將 landing 設為首頁
- 修改：`web/index.html` - 更新字型引用
- 修改：`web/src/index.css` - 更新字型配置

## 本地預覽

```bash
cd web
npm install --legacy-peer-deps
npm run dev
```

訪問 `http://localhost:5173` 檢視新的落地頁。
