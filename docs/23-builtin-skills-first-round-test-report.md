# 內建 Skill 候選第一輪質量與安全實測報告

> 審計日期：2026-07-30
> 審計物件：[內建 Skill 候選池](./22-builtin-skills-candidate-pool.md)中的 70 個候選
> 目標：判斷上游版本能否作為 SkillHub 內建 Skill 原樣分發，以及哪些候選值得適配後進入下一輪

## 1. 結論

不建議把這 70 個候選原樣批次內建。

| 結論 | 數量 | 含義 |
|---|---:|---|
| `include` | 3 | 功能與安全邊界基本成立；補齊來源、許可證和版本後設資料後可進入打包複核 |
| `adapt` | 29 | 場景有價值，但必須先修正文案、許可權、檔案邊界、隱私或依賴問題，再回歸測試 |
| `hold` | 16 | 依賴賬號、CLI、付費 API、私有資料或特定平臺，本輪無法證明可開箱即用 |
| `reject` | 22 | 存在明確安全缺陷、質量失敗、再分發限制，或與 SkillHub 場景明顯不相容 |

最終人工風險分佈為：低風險 13 個、中風險 23 個、高風險 26 個、極高風險 8 個。沒有發現可以認定為惡意軟體的證據，但發現了多項足以阻止內建的真實缺陷。

當前版本只有 A05、A13、B10 三項接近“補後設資料即可打包”。若完成 29 項適配，理論上可保留 32 項；考慮改造成本，建議先收斂出 15–20 個低風險首批包，再擴到 30 個，不要為了數量降低准入線。

## 2. 測試範圍與方法

### 2.1 固定的上游快照

| 來源 | 審計提交 |
|---|---|
| `anthropics/skills` | `b29e7cf65e5cb78a5ac33d582270551bc74a14eb` |
| `github/awesome-copilot` | `be7a1cf734f427d50266335b461b86977299d953` |
| `GarethManning/education-agent-skills` | `32fce5c0d097ec675cf81c750a65a379e4d87e3c` |
| `cosmicstack-labs/mercury-agent-skills` | `4c57cf2eaeb3fb9c0e418615c7a36fe977c88b79` |
| `openclaw/openclaw` | `62cbbcc800214f05cdc4b97debdf7339bfa7c5f4` |
| `NKZ55/research-planner` | `ee4e8753de02cb83df713934597b45f6778f7254` |
| `ailabs-393/ai-labs-claude-skills` | `1a12bc7aadcc7b211f77a7455db454b77a71f827` |
| `openai/plugins` | `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9` |
| `vercel-labs/agent-skills` | `7c180d9044c9ae2b442b567aad4e42a28dd5ed62` |

本輪共檢查 630 個檔案、約 10.96 MB，其中包括 84 個程式碼檔案和 9 個二進位制檔案。

### 2.2 執行的檢查

1. **逐檔案人工審查**：檢查指令碼、引用檔案、模板、二進位制、網路訪問、憑據、隱私資料、外部寫入、檔案覆蓋、動態安裝和宿主繫結。
2. **SkillHub 實際包校驗**：使用專案中的 `SkillPackageValidator` 校驗 70 個目錄；70/70 結構透過，但 3 個包共產生 57 條副檔名警告。
3. **靜態安全掃描**：使用 Cisco AI Skill Scanner 1.0.2 的靜態分析器、官方 balanced YARA 規則，以及 SkillHub 追加的正則規則。
4. **語法與格式檢查**：覆蓋 Python AST、Shell `bash -n`、JSON/YAML、XML/XSD/SVG、Office/ZIP 歸檔及字型解析。
5. **任務級測試**：對無外部副作用的 Skill 做提示詞任務回放、純函式測試或本地檔案測試；天氣查詢和影片抽幀完成了真實端到端執行。
6. **阻斷測試**：涉及真實賬號、私有筆記、瀏覽器 Cookie、攝像頭、付費 API、上傳、部署、推送、刪除或外部發訊息的路徑不執行，只做靜態審查。

“實測”不代表已在所有 Agent 宿主和作業系統完成相容性認證；每項實際覆蓋範圍見下表。

### 2.3 工具限制

- 本地 Docker 掃描服務未執行，因此沒有執行 LLM 行為分析和 VirusTotal 查詢。
- 專案追加的 `scanner/examples/vetter-rules/yara/skillhub_vetter.yara` 無法編譯，錯誤為第 146 行存在未引用的 `$local_storage`。本輪保留了專案追加正則，但 YARA 使用 Cisco 官方規則。
- 自動掃描共給出 98 條發現，其中 53 條只是 frontmatter 缺少 `license`。原始最高嚴重度分佈為：`CRITICAL 4 / HIGH 7 / MEDIUM 8 / INFO 43 / SAFE 8`。
- 自動嚴重度不能作為最終結論：A13 的 `CRITICAL` 來自“忽略外部內容中的指令”這一防護語句；相反，B04、C07、C09、C19、D07、D10 等真實高風險行為被漏報或低估。

## 3. 關鍵安全與質量發現

1. **目錄越界和本地資料洩露**
   - B04 會跟隨檔案或目錄符號連結，把 Skill 目錄外內容打入包。
   - B13 允許惡意 Markdown 用絕對路徑或 `../../` 讀取本地圖片並嵌入 DOCX。

2. **無確認破壞使用者檔案**
   - B14、B15 發現輸出目錄已存在時會直接 `shutil.rmtree` 整棵刪除。
   - B16、A14 等會覆蓋現有輸出，缺少 no-clobber 或確認機制。

3. **執行、上傳和憑據邊界過寬**
   - C07 可啟動任意 stdio 命令、連線任意 URL，並讓模型自動呼叫工具。
   - C09 會把大部分專案原始碼上傳到非官方中轉服務。
   - C19 明確匯入 Chrome Cookie；D07 會顯示和搜尋部署 token；D10 涉及攝像頭憑據、區域網發現和任意 action。
   - C20 允許透過 `OPENAI_BASE_URL` 把 API key 與音訊傳送到任意端點。

4. **遠端提示與不可信內容**
   - C11 每次執行都下載未固定提交和雜湊的遠端 Markdown，並把它作為指令執行。
   - B17 會把輸入中的 `<script>` 原樣帶入 HTML。
   - 多個網頁、會議稿、CI 日誌和研究類 Skill 沒有把外部內容明確隔離為“不執行的輸入資料”。

5. **再分發和包相容性**
   - D03–D06 的許可證明確禁止複製和再分發，不能作為 SkillHub 內建包發布。
   - B03 的 54 個 `.ttf`、C09 的 `Archive.zip`、D08 的兩個 `.lobster` 檔案會觸發 SkillHub 副檔名警告；當前校驗器只警告、不阻斷。
   - 53 個 Skill 的 frontmatter 未宣告 `license`。即使來源倉庫有許可證，正式包仍應附帶許可證、上游提交、作者、修改說明和歸屬資訊。

## 4. 逐項測試結果

質量評分：5 為完整、準確且可複用；3 為可用但需明顯修正；1 為核心功能或安全邊界不成立。

### A：優先實測

| ID | Skill | Q | 風險 | 測試 | 結論 | 主要證據 |
|---|---|---:|---|---|---|---|
| A01 | `internal-comms` | 3 | 高 | 任務回放透過 | adapt | 3P 週報輸出正確；其他模板會廣泛讀取 Slack、郵箱、Drive、日曆，需限制資料範圍並在發布前確認。 |
| A02 | `meeting-minutes` | 3 | 中 | 任務回放透過 | adapt | 決策、負責人和日期提取正確；固定 12 節與“一頁內”衝突，建立任務或發布必須顯式授權。 |
| A03 | `brag-sheet` | 4 | 中 | 任務回放透過 | adapt | 能保持指標與證據；Backfill 會掃描 Copilot session、Git 和登入態 `gh`，需改成使用者指定來源。 |
| A04 | `convert-plaintext-to-md` | 2 | 中 | 任務回放部分透過 | reject | 能整理文字，但規則過重、檔案操作語義不一致，並繫結 Copilot `#tool:fetch`，重寫成本高於保留價值。 |
| A05 | `exam-ready` | 4 | 低 | 任務回放透過 | include | 輸出未越出課程材料，輸入和產出邊界清楚；正式包補許可證和外部內容防注入說明。 |
| A06 | `spaced-practice-scheduler` | 3 | 低 | 任務回放透過 | adapt | 4 周 12 課安排可執行；“24 小時遺忘 70%”及 40% 重教閾值表述過度。 |
| A07 | `ai-claim-checker` | 4 | 低 | 任務回放透過 | adapt | 能識別“季節由近日點造成”的錯誤；需修正來源示例並弱化強制流程。 |
| A08 | `decision-matrix` | 3 | 中 | 計算實測透過 | adapt | 實測計算可復現，但內建示例總分算錯；高分不應直接決定高風險選擇。 |
| A09 | `storytelling-advisor` | 3 | 低 | 任務回放透過 | adapt | 故事結構有效；內建示例會從稀疏輸入虛構姓名、規模、週期和使用者數。 |
| A10 | `linkedin-post-formatter` | 3 | 低 | 任務回放透過 | adapt | 字元對映正確且不會自動發布；Unicode 樣式影響無障礙，平臺演算法規則容易過期。 |
| A11 | `documentation-writer` | 3 | 低 | 任務回放部分透過 | adapt | Diátaxis 分類清楚；即使輸入充分仍強制提問和等待大綱批准，影響一次性交付。 |
| A12 | `diagram-maker` | 3 | 中 | HTML/SVG 實測透過 | adapt | 獨立 SVG 的結構、箭頭和遠端資源檢查透過；預設寫 `diagram.html` 需防覆蓋。 |
| A13 | `weather` | 4 | 低 | 真實網路查詢透過 | include | `wttr.in` JSON 可解析三日預報，已有外部內容防注入和嚴重天氣改查官方來源的邊界。 |
| A14 | `video-frames` | 3 | 中 | 本地端到端透過 | adapt | 從合成影片成功抽出 PNG，錯誤輸入能失敗；`--index` 缺顯式數值校驗，且 `ffmpeg -y` 會覆蓋輸出。 |
| A15 | `frontend-design` | 4 | 中 | 任務回放透過 | adapt | 設計約束與可訪問性要求有效；必須刪除“讀取 human memory”並只用本次授權上下文。 |

### B：擴充套件實測

| ID | Skill | Q | 風險 | 測試 | 結論 | 主要證據 |
|---|---|---:|---|---|---|---|
| B01 | `theme-factory` | 3 | 低 | 渲染部分透過 | adapt | 主題展示可渲染，PDF 無指令碼或表單；兩個主題對比度不足，缺 WCAG 校驗和應用機制。 |
| B02 | `algorithmic-art` | 3 | 中 | 靜態 | adapt | 依賴無 SRI/CSP 的外部 p5.js 和字型，模板仍有待填骨架，且缺檔案聲稱的下載按鈕。 |
| B03 | `canvas-design` | 3 | 高 | 54 字型解析透過 | adapt | 字型檔案有效；允許任意下載字型、許可不完整，且 54 個 TTF 觸發包警告。 |
| B04 | `skill-creator` | 4 | 極高 | 靜態安全失敗 | reject | 存在 symlink 越界打包、本地報告 XSS、無確認終止埠程式和預設高併發外發模型資料。 |
| B05 | `webapp-testing` | 3 | 高 | 幫助透過，依賴阻斷 | hold | 缺 Playwright；runner 使用 `shell=True`、程式組處理不完整，還可能誤認同埠的既有服務。 |
| B06 | `daily-standup-journal` | 4 | 中 | 任務回放透過 | adapt | 日常站會產出清楚；滾動日誌和跨日情緒推斷缺同意、儲存位置及刪除機制。 |
| B07 | `time-blocking-scheduler` | 3 | 低 | 任務回放透過 | adapt | 能安排重點任務與緩衝；“深度工作永遠在中午前”等絕對規則不適合所有使用者。 |
| B08 | `resume-writing` | 2 | 中 | 任務回放不充分 | hold | 僅給出泛化 STAR/CAR 建議，缺事實保真、崗位證據對映和作品集流程。 |
| B09 | `interview-prep` | 2 | 低 | 任務回放不充分 | hold | 只能生成泛化清單，缺計劃、模擬評分和崗位校準；正文沒有 description 聲稱的談薪內容。 |
| B10 | `retrieval-practice-generator` | 5 | 低 | 任務回放透過 | include | 題型、難度、糾錯、侷限和驗證要求完整；按 CC BY-SA 補齊歸屬、同許可及修改宣告。 |
| B11 | `study-strategy-selector` | 4 | 低 | 任務回放透過 | adapt | 能組合檢索、間隔和交錯練習；部分學習科學結論被寫成絕對規律。 |
| B12 | `research-planner` | 4 | 中 | 任務回放透過 | adapt | 32 個模板覆蓋目標、招募、同意和時間線；需移除安裝動作並加強研究隱私與法律複核。 |
| B13 | `md-to-docx` | 2 | 高 | 語法透過，依賴阻斷 | hold | 無 lockfile 且依賴未安裝；圖片路徑未限制在輸入目錄，惡意 Markdown 可讀取本地檔案並打包。 |
| B14 | `convert-word-to-md` | 3 | 極高 | AST/help 透過，依賴阻斷 | reject | 已存在輸出目錄會被無確認遞迴刪除。 |
| B15 | `convert-pdf-to-md` | 3 | 極高 | AST/help 透過，依賴阻斷 | reject | 與 B14 相同會刪除整個輸出目錄，依賴範圍也未鎖定。 |
| B16 | `convert-excel-to-md` | 3 | 高 | AST/help 透過，依賴阻斷 | hold | 會刪除現有 `img/` 並覆蓋 Markdown，缺少確認和 no-clobber。 |
| B17 | `markdown-to-html` | 2 | 高 | Pandoc 本地實測失敗 | reject | 輸入 `<script>` 被原樣保留；單個 Skill 混合多套工具、全域性安裝、`@latest`、外掛執行和公網監聽。 |
| B18 | `ad-campaign-analyzer` | 3 | 中 | 任務回放部分透過 | adapt | 能定位 CPA 異常；固定樣本門檻和線性預算推斷可能誤導花費決策。 |
| B19 | `gtm-positioning-strategy` | 3 | 中 | 任務回放部分透過 | adapt | 結構可用；效果門檻缺統計依據，還要求直接冷郵件觸達，必須改成只起草並確認傳送。 |
| B20 | `competitor-ad-intelligence` | 3 | 高 | 聯網路徑阻斷 | reject | 任意 URL 抓取帶來 SSRF、惡意網頁和提示注入面，核心業務推斷缺可靠依據。 |
| B21 | `blogwatcher` | 2 | 高 | CLI 缺失 | hold | 只是第三方 CLI 速查，安裝使用未固定的 Go `@latest`，不可復現。 |
| B22 | `openai-whisper` | 3 | 中 | CLI/模型缺失 | hold | 本地轉寫有價值，但首次下載大型模型；缺音訊隱私、資源上限、版本和快取刪除策略。 |
| B23 | `songsee` | 2 | 高 | CLI 缺失 | hold | 依賴第三方 Homebrew tap 和隱式 ffmpeg，當前只有命令速查，無法證明開箱可用。 |
| B24 | `meeting-note-summarizer` | 3 | 中 | 任務回放事實性失敗 | adapt | 格式清晰；示例會把試探日期固化，並憑空增加時長、任務、負責人和截止日。 |
| B25 | `travel-planner` | 2 | 高 | 本地核心測試失敗 | reject | 不同目的地生成相同佔位行程；程式碼仍有 TODO，並把飲食、無障礙和歷史行程明文存入 `~/.claude`。 |

### C：條件候選

| ID | Skill | Q | 風險 | 測試 | 結論 | 主要證據 |
|---|---|---:|---|---|---|---|
| C01 | `notion-knowledge-capture` | 4 | 中 | 賬號/寫入阻斷 | hold | 模板完整；會搜尋、建立和更新私有 Notion 頁面，缺最小範圍和最終寫入確認。 |
| C02 | `notion-meeting-intelligence` | 4 | 中 | 賬號/寫入阻斷 | hold | 會聚合內部會議、OKR、規格和參會者上下文，並建立或更新頁面。 |
| C03 | `notion-research-documentation` | 4 | 中 | 賬號/寫入阻斷 | hold | 研究和引用流程完整；跨私有頁面彙總併發布前需限定讀取範圍和確認。 |
| C04 | `notion-spec-to-implementation` | 4 | 中 | 賬號/寫入阻斷 | hold | 規格拆解成熟；會批次建立計劃、任務和狀態，缺數量預覽和最終確認。 |
| C05 | `gh-address-comments` | 4 | 中 | 純函式實測透過 | adapt | 兩頁分頁模擬透過，“無限迴圈”為誤報；需增加頁數/遊標保護並限制私有評論輸出。 |
| C06 | `gh-fix-ci` | 4 | 高 | 解析實測透過 | adapt | Run/job URL 和失敗片段解析正確；輸出 CI 日誌前缺 token、密碼等敏感資訊脫敏。 |
| C07 | `mcp-builder` | 3 | 極高 | 外部執行阻斷 | reject | 可啟動任意命令、連線任意 URL、自動呼叫 MCP 工具並把結果傳送給 Anthropic；掃描器誤判 SAFE。 |
| C08 | `slack-gif-creator` | 3 | 中 | 純函式透過，依賴阻斷 | adapt | `Image.open` 外傳告警為誤報；需限制輸出覆蓋、圖片解壓炸彈並鎖定依賴。 |
| C09 | `deploy-to-vercel` | 2 | 極高 | 語法透過，上傳阻斷 | reject | 會把大部分專案上傳到非官方中轉端點，排除規則不足以保護原始碼和金鑰；ZIP 還觸發包警告。 |
| C10 | `vercel-react-best-practices` | 5 | 低 | 靜態透過 | adapt | 70 條規則完整；需刪除記錄原始 session cookie、快取認證 cookie 等危險示例，並補 CSP 說明。 |
| C11 | `writing-guidelines` | 2 | 高 | 遠端指令阻斷 | reject | 每次下載未固定 commit/hash 的遠端 Markdown 並當成指令，存在供應鏈與遠端提示注入風險。 |
| C12 | `summarize` | 4 | 高 | CLI/外部上傳阻斷 | adapt | 會把 URL、本地檔案或媒體發往模型、Firecrawl、Apify；應預設關閉第三方 fallback 並披露目的地。 |
| C13 | `goplaces` | 3 | 高 | API/計費阻斷 | hold | 需要計費 Google API，可能傳送精確經緯度；缺費用和位置隱私確認。 |
| C14 | `obsidian` | 4 | 高 | 私有資料/寫入阻斷 | hold | 可讀取私有 vault 和配置，並支援刪除、外掛過載及 `eval`；伺服器部署通常也不可用。 |
| C15 | `notion` | 4 | 高 | 賬號/寫入阻斷 | reject | 支援建立、更新、trash、上傳和 raw curl，安全邊界弱於 C01–C04 且功能重複。 |
| C16 | `apple-notes` | 3 | 高 | 私有資料/寫入阻斷 | reject | 第三方 CLI 可編輯、刪除、移動和匯出私人筆記，macOS 專屬且缺確認。 |
| C17 | `apple-reminders` | 4 | 高 | 私有資料/寫入阻斷 | hold | 日常價值較高，但能讀取私人計劃並強制刪除；應拆成預設只讀版並逐項確認。 |
| C18 | `trello` | 2 | 高 | 憑據/寫入阻斷 | reject | 完整賬號 token 放在 URL 查詢串中，並直接建立、移動、評論和歸檔，無確認。 |
| C19 | `spotify-player` | 3 | 極高 | Cookie 訪問阻斷 | reject | 明確要求從 Chrome 匯入 Spotify Cookie，觸及瀏覽器憑據邊界。 |
| C20 | `openai-whisper-api` | 3 | 高 | Shell/help 透過，上傳阻斷 | adapt | 任意 `OPENAI_BASE_URL` 可接收 key 與音訊；還缺 `curl --fail`、25 MB 預檢和防覆蓋。 |

### D：原計劃不納入

| ID | Skill | Q | 風險 | 測試 | 結論 | 主要證據 |
|---|---|---:|---|---|---|---|
| D01 | `yeet` | 4 | 高 | Git/外部寫入阻斷 | adapt | Git 範圍防護較好；但會安裝依賴並 stage、commit、push、建 PR，安裝和 push 前必須確認。 |
| D02 | `chatgpt-app-submission` | 4 | 中 | 靜態 | hold | 稽核清單成熟且只寫本地檔案；場景窄、繫結 OpenAI/MCP，不適合作為首批通用內建。 |
| D03 | `docx` | 4 | 高 | 語法/靜態透過 | reject | 許可證禁止再分發；還會動態編譯並 `LD_PRELOAD` socket shim，LibreOffice 超時可能誤報成功。 |
| D04 | `pdf` | 4 | 中 | 純函式部分透過 | reject | 自動“外傳”告警為本地讀取誤報，但許可證禁止再分發，且不可信 PDF 有解析與資源風險。 |
| D05 | `pptx` | 4 | 高 | 語法/靜態透過 | reject | 提示注入告警為詞法誤報；真實工具鏈會修改檔案並使用 LibreOffice/LD_PRELOAD，且禁止再分發。 |
| D06 | `xlsx` | 4 | 高 | 語法/靜態透過 | reject | 掃描器誤判 SAFE；會原地重寫工作簿，`--force` 可破壞外部連結，且禁止再分發。 |
| D07 | `vercel-cli-with-tokens` | 3 | 極高 | 憑據/部署阻斷 | reject | 指示顯示 token、搜尋 `.env`，幷包含全域性安裝、部署、域名變更及真實付費操作。 |
| D08 | `taskflow` | 3 | 高 | YAML/示例解析透過 | reject | 示例允許任意命令、PR 操作和 Slack/Telegram 外發，完全繫結 OpenClaw；`.lobster` 觸發包警告。 |
| D09 | `taskflow-inbox-triage` | 3 | 高 | 靜態 | reject | 分類私人收件箱、持久化狀態並向 Slack 路由內容，依賴 D08 且缺隱私最小化和外發確認。 |
| D10 | `camsnap` | 2 | 極高 | 攝像頭路徑阻斷 | reject | 攝像頭賬號密碼出現在命令列，支援區域網發現、抓圖、錄影和任意 `--action`；掃描器完全漏報。 |

## 5. 建議的下一步

第一批最終選定以下 15 項：

- 近似可直接打包：A05、A13、B10。
- 低成本修正後複測：A07、A08、A09、A10、A11、A12、A14、A15、B06、B07、B11、B24。

這批覆蓋 4 個學習與研究、5 個辦公與個人效率、4 個內容與設計、2 個日常出行與媒體 Skill。
完成統一許可證後設資料、外部內容隔離、no-clobber 和宿主去繫結後，再進行第二輪打包與迴歸測試。

未選擇 A06，是因為它與 B10、B11 的學習流程重疊；未選擇 B01，是因為主題對比度和實際應用機制
尚未成立；未選擇 C10，是因為首批已有 A15，且 C10 仍有 cookie 示例和許可證問題。B25 的旅行
規劃實測失敗，不因旅行場景暫時缺少候選而降低准入標準。

其餘 `adapt` 項不要與首批並行鋪開：先逐項明確替代哪個首批候選、所需依賴、資料邊界和驗收用例。所有 `hold` 項應在隔離環境和測試賬號中完成端到端驗證；所有 `reject` 項預設不進入內建目錄。

## 6. 第一批 15 個適配包複測

上述第一輪報告檢查的是固定上游快照。完成首批適配後，又對倉庫
`builtin-skills/skills/` 中的最終版本做了一輪發布前複測：

| 檢查 | 結果 |
|---|---|
| 目錄、後設資料、來源和許可證 | 15/15 透過；每包包含 `SKILL.md`、`LICENSE.txt` 和 `NOTICE.md` |
| SkillHub 生產包校驗器 | 15/15 透過，0 error、0 warning |
| 確定性打包 | 連續兩次構建的 15 個 ZIP 逐位元組一致；符號連結輸入被拒絕 |
| 靜態安全掃描 | Cisco AI Skill Scanner 1.0.2 官方 balanced YARA + SkillHub 追加正則：15/15 `SAFE`，0 finding |
| `video-frames` 真實執行 | FFmpeg 合成影片抽幀成功；非法索引、衝突引數和覆蓋已有輸出均被拒絕 |
| 人工內容複核 | 已檢查事實保真、外部內容隔離、隱私、隱藏記憶、檔案覆蓋和未經授權的外部寫操作 |

適配後重點刪除或收緊了固定日程模板、套娃提示詞、暗中虛構、跨會話記憶、過度確定的學習效果
表述和宿主專屬路徑。`weather` 仍需要聯網，`video-frames` 仍需要本機 FFmpeg；其餘首批 Skill
沒有執行時賬號或金鑰依賴。

本輪結論不等於所有 Agent 宿主和所有模型都已認證。未執行 LLM 行為掃描和 VirusTotal；發布
前仍需在最終支援的宿主中用 `builtin-skills/evals.json` 的 15 個任務做一次行為迴歸，並在乾淨
SkillHub 例項驗證遠端同步、下載和安裝。
