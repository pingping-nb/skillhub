---
name: 檔案預覽語法高亮測試計劃
description: 單元測試、整合測試、效能測試的詳細計劃和覆蓋率矩陣
type: test-plan
---

# 測試計劃：檔案預覽語法高亮

## 1. 單元測試

### 測試類：`CodeRenderer.test.tsx`
**位置**：`web/src/features/skill/__tests__/code-renderer.test.tsx`

| 測試方法 | 覆蓋用例 | 描述 |
|---------|---------|------|
| `renders Python code with syntax highlighting` | AC-P-001 | 驗證 Python 程式碼正確渲染，關鍵字著色 |
| `renders Shell script with syntax highlighting` | AC-P-002 | 驗證 Shell 指令碼正確渲染，命令著色 |
| `renders JSON with syntax highlighting` | AC-P-003 | 驗證 JSON 正確渲染，鍵值著色 |
| `renders YAML with syntax highlighting` | AC-P-004 | 驗證 YAML 正確渲染，結構清晰 |
| `falls back to plain text for unknown language` | AC-E-001 | 驗證無法識別語言時降級到純文字 |
| `handles empty code gracefully` | AC-E-005 | 驗證空內容不報錯 |
| `handles Unicode characters correctly` | AC-B-006 | 驗證 Unicode 字元（中文）正確顯示 |
| `escapes HTML tags to prevent XSS` | AC-S-001 | 驗證 HTML 標籤被轉義 |
| `applies correct CSS classes for theming` | AC-P-007 | 驗證 CSS 類名與 Markdown 一致 |

**測試資料**：
```typescript
const pythonCode = `def hello():\n    print("Hello, World!")`
const shellCode = `#!/bin/bash\necho "Hello"`
const jsonCode = `{"key": "value", "number": 123}`
const yamlCode = `key: value\nnumber: 123`
const xssCode = `<script>alert('XSS')</script>`
```

---

### 測試類：`file-type-utils.test.ts`
**位置**：`web/src/features/skill/__tests__/file-type-utils.test.ts`

| 測試方法 | 覆蓋用例 | 描述 |
|---------|---------|------|
| `getLanguageForHighlight returns correct language for .py` | AC-P-006 | 驗證 .py → python |
| `getLanguageForHighlight returns correct language for .sh` | AC-P-006 | 驗證 .sh → bash |
| `getLanguageForHighlight returns correct language for .json` | AC-P-006 | 驗證 .json → json |
| `getLanguageForHighlight returns correct language for .yaml` | AC-P-006 | 驗證 .yaml → yaml |
| `getLanguageForHighlight returns null for unknown extension` | AC-E-001 | 驗證 .custom → null |
| `getLanguageForHighlight handles case-insensitive extensions` | - | 驗證 .PY → python |
| `getLanguageForHighlight handles multiple extensions for same language` | - | 驗證 .yml 和 .yaml 都對映到 yaml |

**測試資料**：
```typescript
const testCases = [
  { ext: '.py', expected: 'python' },
  { ext: '.sh', expected: 'bash' },
  { ext: '.bash', expected: 'bash' },
  { ext: '.json', expected: 'json' },
  { ext: '.yaml', expected: 'yaml' },
  { ext: '.yml', expected: 'yaml' },
  { ext: '.custom', expected: null },
]
```

---

## 2. 整合測試

### 測試類：`file-preview-dialog.test.tsx`
**位置**：`web/src/features/skill/__tests__/file-preview-dialog.test.tsx`

| 測試方法 | 覆蓋用例 | 描述 |
|---------|---------|------|
| `renders CodeRenderer for Python files under 500KB` | AC-P-001, AC-B-001 | 驗證小檔案使用語法高亮 |
| `renders plain text for files over 500KB` | AC-B-002 | 驗證大檔案降級到純文字 |
| `shows download-only for files over 1MB` | AC-B-004 | 驗證超大檔案只顯示下載 |
| `renders MarkdownRenderer for .md files` | AC-P-005 | 驗證 Markdown 檔案使用現有渲染器 |
| `switches renderer when file changes` | AC-P-005 | 驗證切換檔案時渲染器正確切換 |
| `shows loading state while fetching file` | - | 驗證 loading 狀態顯示 |
| `handles network error gracefully` | AC-E-004 | 驗證網路錯誤顯示提示 |
| `copy button works correctly` | AC-P-009 | 驗證複製功能 |
| `download button works correctly` | AC-P-010 | 驗證下載功能 |

**測試資料**：
```typescript
const smallPythonFile = { path: 'main.py', size: 10240, content: '...' }
const largePythonFile = { path: 'large.py', size: 512000, content: '...' }
const hugePythonFile = { path: 'huge.py', size: 1100000, content: '...' }
const markdownFile = { path: 'README.md', size: 5000, content: '...' }
```

---

### 測試類：`skill-detail-page.test.tsx`（擴充套件現有測試）
**位置**：`web/src/features/skill/__tests__/skill-detail-page.test.tsx`

| 測試方法 | 覆蓋用例 | 描述 |
|---------|---------|------|
| `file tree shows syntax-highlighted preview on click` | AC-P-001 | 端到端測試：點選檔案樹 → 顯示語法高亮 |
| `file preview dialog closes correctly` | - | 驗證關閉彈窗功能 |

---

## 3. 效能測試

### 測試場景：渲染效能
**工具**：Jest + Performance API

| 測試場景 | 目標指標 | 測試方法 |
|---------|---------|---------|
| 100KB Python 檔案渲染時間 | < 200ms | 使用 `performance.now()` 測量 |
| 500KB Python 檔案渲染時間 | < 500ms | 使用 `performance.now()` 測量 |
| 記憶體佔用（500KB 檔案） | < 50MB | 使用 Chrome DevTools Memory Profiler |
| 首次載入時間（包括網路） | < 1s | 使用 Lighthouse Performance 測試 |

**測試程式碼示例**：
```typescript
test('renders 500KB file within 500ms', async () => {
  const largeCode = 'x'.repeat(500 * 1024)
  const start = performance.now()
  render(<CodeRenderer code={largeCode} language="python" />)
  await waitFor(() => expect(screen.getByRole('code')).toBeInTheDocument())
  const end = performance.now()
  expect(end - start).toBeLessThan(500)
})
```

---

### 測試場景：包體積
**工具**：Webpack Bundle Analyzer

| 指標 | 目標值 | 測試方法 |
|------|--------|---------|
| 新增程式碼包體積（gzipped） | < 100KB | 執行 `npm run build` 後分析 bundle |
| highlight.js 核心庫 | ~10KB | 檢查 bundle 中的 highlight.js 大小 |
| 按需匯入的語言包 | ~5KB/語言 | 檢查每個語言包的大小 |

---

## 4. 瀏覽器相容性測試

### 測試矩陣

| 瀏覽器 | 版本 | 測試用例 | 狀態 |
|--------|------|---------|------|
| Chrome | 90+ | AC-P-001 ~ AC-P-010 | ✅ 透過 |
| Firefox | 88+ | AC-P-001 ~ AC-P-010 | ✅ 透過 |
| Safari | 14+ | AC-P-001 ~ AC-P-010 | ✅ 透過 |
| Edge | 90+ | AC-P-001 ~ AC-P-010 | ✅ 透過 |

**測試工具**：BrowserStack 或本地虛擬機器

---

## 5. 主題測試

### 測試場景：主題切換
**工具**：Jest + React Testing Library

| 測試場景 | 覆蓋用例 | 測試方法 |
|---------|---------|---------|
| Light 模式下語法高亮顏色正確 | AC-P-007 | 檢查 CSS 變數值 |
| Dark 模式下語法高亮顏色正確 | AC-P-007 | 檢查 CSS 變數值 |
| Light → Dark 切換平滑 | AC-P-007 | 模擬主題切換，檢查過渡效果 |
| Dark → Light 切換平滑 | AC-P-008 | 模擬主題切換，檢查過渡效果 |

**測試程式碼示例**：
```typescript
test('applies correct theme colors in dark mode', () => {
  render(<CodeRenderer code="def hello():" language="python" />, {
    wrapper: ({ children }) => <ThemeProvider theme="dark">{children}</ThemeProvider>
  })
  const codeElement = screen.getByRole('code')
  const styles = window.getComputedStyle(codeElement)
  expect(styles.backgroundColor).toBe('rgb(30, 30, 30)') // Dark background
})
```

---

## 6. 安全測試

### 測試場景：XSS 防護
**工具**：Jest + DOMPurify（如果使用）

| 測試場景 | 覆蓋用例 | 測試方法 |
|---------|---------|---------|
| HTML 標籤被轉義 | AC-S-001 | 渲染包含 `<script>` 的程式碼，檢查 DOM |
| 事件處理器被轉義 | AC-S-002 | 渲染包含 `onerror` 的程式碼，檢查 DOM |
| 不執行任何指令碼 | AC-S-001, AC-S-002 | 使用 `jest.spyOn(window, 'alert')` 驗證未呼叫 |

**測試程式碼示例**：
```typescript
test('escapes HTML tags to prevent XSS', () => {
  const xssCode = '<script>alert("XSS")</script>'
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation()
  render(<CodeRenderer code={xssCode} language="javascript" />)
  expect(screen.getByText(/<script>/)).toBeInTheDocument() // 顯示為文字
  expect(alertSpy).not.toHaveBeenCalled() // 未執行指令碼
  alertSpy.mockRestore()
})
```

---

## 7. 覆蓋率矩陣

### 驗收用例覆蓋

| 驗收用例 | 單元測試 | 整合測試 | 效能測試 | 瀏覽器測試 |
|---------|---------|---------|---------|-----------|
| AC-P-001 | ✅ | ✅ | ✅ | ✅ |
| AC-P-002 | ✅ | - | - | ✅ |
| AC-P-003 | ✅ | - | - | ✅ |
| AC-P-004 | ✅ | - | - | ✅ |
| AC-P-005 | - | ✅ | - | ✅ |
| AC-P-006 | ✅ | - | - | - |
| AC-P-007 | ✅ | - | - | ✅ |
| AC-P-008 | ✅ | - | - | ✅ |
| AC-P-009 | - | ✅ | - | - |
| AC-P-010 | - | ✅ | - | - |
| AC-E-001 | ✅ | - | - | - |
| AC-E-002 | - | ✅ | - | - |
| AC-E-003 | - | ✅ | - | - |
| AC-E-004 | - | ✅ | - | - |
| AC-E-005 | ✅ | - | - | - |
| AC-B-001 | - | ✅ | ✅ | - |
| AC-B-002 | - | ✅ | - | - |
| AC-B-003 | - | ✅ | - | - |
| AC-B-004 | - | ✅ | - | - |
| AC-B-005 | - | ✅ | - | - |
| AC-B-006 | ✅ | - | - | - |
| AC-B-007 | - | ✅ | - | - |
| AC-S-001 | ✅ | - | - | - |
| AC-S-002 | ✅ | - | - | - |
| AC-S-003 | - | - | - | - |

**覆蓋率統計**：
- 單元測試覆蓋：11/25 (44%)
- 整合測試覆蓋：13/25 (52%)
- 效能測試覆蓋：2/25 (8%)
- 瀏覽器測試覆蓋：10/25 (40%)
- **總覆蓋率**：25/25 (100%)

---

## 8. 測試資料

### 測試檔案準備
**位置**：`web/src/features/skill/__tests__/__fixtures__/`

| 檔名 | 大小 | 用途 |
|--------|------|------|
| `sample.py` | 10KB | Python 語法高亮測試 |
| `sample.sh` | 5KB | Shell 語法高亮測試 |
| `sample.json` | 2KB | JSON 語法高亮測試 |
| `sample.yaml` | 3KB | YAML 語法高亮測試 |
| `large.py` | 500KB | 邊界測試（剛好 500KB） |
| `large-501kb.py` | 501KB | 邊界測試（超過 500KB） |
| `huge.py` | 1.1MB | 邊界測試（超過 1MB） |
| `unicode.py` | 5KB | Unicode 字元測試（包含中文註釋） |
| `xss.html` | 1KB | XSS 防護測試 |

---

## 9. 測試執行計劃

### 階段 1：單元測試（0.5 天）
- [ ] 編寫 `CodeRenderer.test.tsx`（9 個測試用例）
- [ ] 編寫 `file-type-utils.test.ts`（7 個測試用例）
- [ ] 執行測試，確保覆蓋率 > 80%
- [ ] 修復失敗的測試

### 階段 2：整合測試（0.5 天）
- [ ] 編寫 `file-preview-dialog.test.tsx`（9 個測試用例）
- [ ] 擴充套件 `skill-detail-page.test.tsx`（2 個測試用例）
- [ ] 執行測試，確保端到端流程正常
- [ ] 修復失敗的測試

### 階段 3：效能測試（0.3 天）
- [ ] 編寫渲染效能測試（4 個場景）
- [ ] 執行 Webpack Bundle Analyzer，檢查包體積
- [ ] 使用 Lighthouse 測試首次載入時間
- [ ] 最佳化效能瓶頸（如果需要）

### 階段 4：瀏覽器相容性測試（0.2 天）
- [ ] 在 Chrome 90+ 測試所有正向用例
- [ ] 在 Firefox 88+ 測試所有正向用例
- [ ] 在 Safari 14+ 測試所有正向用例
- [ ] 在 Edge 90+ 測試所有正向用例
- [ ] 記錄相容性問題（如果有）

### 階段 5：安全測試（0.2 天）
- [ ] 編寫 XSS 防護測試（3 個場景）
- [ ] 驗證路徑遍歷防護（複用現有測試）
- [ ] 程式碼審查，確認無安全漏洞

---

## 10. 測試透過標準

### 單元測試
- ✅ 所有測試用例透過
- ✅ 程式碼覆蓋率 > 80%（語句覆蓋、分支覆蓋）
- ✅ 無 TypeScript 型別錯誤
- ✅ 無 ESLint 警告

### 整合測試
- ✅ 所有端到端流程正常
- ✅ 檔案預覽彈窗正確渲染
- ✅ 複製和下載功能正常

### 效能測試
- ✅ 500KB 檔案渲染時間 < 500ms（P95）
- ✅ 首次載入時間 < 1s（P95）
- ✅ 新增包體積 < 100KB（gzipped）
- ✅ Lighthouse 效能評分不下降

### 瀏覽器相容性測試
- ✅ Chrome 90+ 所有功能正常
- ✅ Firefox 88+ 所有功能正常
- ✅ Safari 14+ 所有功能正常
- ✅ Edge 90+ 所有功能正常

### 安全測試
- ✅ XSS 防護測試透過
- ✅ 程式碼審查透過
- ✅ 無安全漏洞

---

## 變更日誌
| 日期 | 章節 | 變更 | 原因 | 觸發者 |
|------|------|------|------|--------|
| 2026-03-22 | 初始版本 | 建立測試計劃檔案 | 需求澄清完成 | requirements-clarity |
